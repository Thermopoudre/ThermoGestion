<?php
// Thermogestion - relais d'emails transactionnels (appelé par Supabase pg_net)
//
// 20/11/2026 :
// 1. Rotation du jeton. L'ancien était écrit en clair dans le dépôt GitHub (public) : n'importe
//    qui pouvait envoyer un mail « Thermogestion <thermogestion@thermopoudre.fr> » à n'importe qui.
//    Le nouveau jeton vit dans le coffre Supabase (vault, nom tg_mailer_token) ; ce fichier ne
//    garde que son empreinte SHA-256, qui ne permet pas de le retrouver.
// 2. L'expéditeur affiché et l'adresse de réponse sont ceux de l'atelier (sender_name, reply_to,
//    envoyés depuis la migration 53 mais ignorés jusqu'ici) : le client qui répond à sa facture
//    écrit à son atelier, pas à Thermopoudre. Repli sur Thermogestion / contact@ si vides.
// 3. Enveloppe (-f) alignée sur l'adresse d'expédition, pour le SPF.
header('Content-Type: application/json');
const EMPREINTE_JETON = 'd70d17b614b97e192aaceed1bdce473be279d29875b697095ed5d0ccba76a02b';
$raw = file_get_contents('php://input');
$d = json_decode($raw, true);
$jeton = is_array($d) ? (string) ($d['token'] ?? '') : '';
if ($jeton === '' || !hash_equals(EMPREINTE_JETON, hash('sha256', $jeton))) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'err' => 'forbidden']);
    exit;
}
$to = filter_var($d['to'] ?? '', FILTER_VALIDATE_EMAIL);
$subject = trim(str_replace(["\r", "\n"], ' ', (string) ($d['subject'] ?? '')));
$html = (string) ($d['html'] ?? '');
if (!$to || $subject === '' || $html === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'err' => 'bad request']);
    exit;
}
$nom = trim(preg_replace('/[\r\n"<>]+/', ' ', (string) ($d['sender_name'] ?? '')));
if ($nom === '') $nom = 'Thermogestion';
$reponse = filter_var(trim((string) ($d['reply_to'] ?? '')), FILTER_VALIDATE_EMAIL) ?: 'contact@thermopoudre.fr';
function tg_enc($s) { return '=?UTF-8?B?' . base64_encode($s) . '?='; }

// 21/11/2026 : envoi par Brevo quand la clé est posée sur le serveur. Le domaine thermopoudre.fr
// est authentifié chez Brevo (DKIM brevo1/brevo2, SPF include:spf.brevo.com) ; un mail() part de
// l'IP du serveur, absente du SPF en -all, sans signature : indésirables ou refus probables.
// Clé : /home/thermopoudre/tp_secrets/brevo_tg.json = {"api_key":"xkeysib-…"}, posée par Alexis,
// jamais dans ce fichier. Sans clé, ou si Brevo refuse, repli sur mail() comme avant.
$voie = 'mail';
$ok = false;
$cle = (string) (json_decode((string) @file_get_contents('/home/thermopoudre/tp_secrets/brevo_tg.json'), true)['api_key'] ?? '');
if ($cle !== '' && function_exists('curl_init')) {
    $corps = json_encode([
        'sender' => ['name' => $nom . ' via Thermogestion', 'email' => 'thermogestion@thermopoudre.fr'],
        'to' => [['email' => $to]],
        'replyTo' => ['email' => $reponse],
        'subject' => $subject,
        'htmlContent' => $html,
    ]);
    $c = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($c, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $corps,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['api-key: ' . $cle, 'Content-Type: application/json', 'Accept: application/json'],
    ]);
    $rep = curl_exec($c);
    $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    if ($code >= 200 && $code < 300) { $ok = true; $voie = 'brevo'; }
    else { $voie = 'mail (brevo ' . $code . ')'; }
}
if (!$ok) {
    $headers = 'From: ' . tg_enc($nom . ' via Thermogestion') . " <thermogestion@thermopoudre.fr>\r\n"
             . "Reply-To: $reponse\r\n"
             . "MIME-Version: 1.0\r\n"
             . "Content-Type: text/html; charset=UTF-8\r\n";
    $ok = mail($to, tg_enc($subject), $html, $headers, '-fthermogestion@thermopoudre.fr');
}
file_put_contents(__DIR__ . '/../tg-mailer.log', date('c') . " to=$to subject=$subject voie=$voie ok=" . ($ok ? '1' : '0') . "\n", FILE_APPEND);
echo json_encode(['ok' => $ok, 'voie' => $voie === 'brevo' ? 'brevo' : 'mail']);
