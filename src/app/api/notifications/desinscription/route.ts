import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Désabonnement du courriel du matin, en un clic depuis le message.
 *
 * POURQUOI sans session. Le lien est cliqué depuis une boîte mail, souvent sur un téléphone,
 * souvent sans être connecté à Thermogestion. Un désabonnement qui exige d'abord de se connecter
 * n'est pas un désabonnement : c'est une raison de mettre l'expéditeur en indésirable, et à partir
 * de là le logiciel n'envoie plus rien du tout.
 *
 * Le jeton est un UUID aléatoire porté par `recap_destinataires`, sans rapport avec l'identifiant
 * du compte, et il ne donne accès à rien d'autre : il ne permet ni de lire une donnée, ni de se
 * réabonner à la place de quelqu'un. Il coupe, c'est tout — la réactivation se fait dans
 * Réglages → Alertes, où il faut être connecté.
 *
 * POURQUOI la clé de service. `recap_destinataires` est fermée à `anon` : personne ne doit pouvoir
 * balayer la table de jetons depuis l'extérieur. La route est donc le seul chemin, et elle
 * n'accepte qu'une action, sur une seule ligne, désignée par un jeton non devinable.
 */

function page(titre: string, texte: string, statut: number) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${titre}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:48px 24px;background:#f9fafb;color:#111827">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
<h1 style="font-size:20px;margin:0 0 10px">${titre}</h1>
<p style="font-size:15px;line-height:1.5;color:#374151;margin:0 0 18px">${texte}</p>
<a href="/reglages?onglet=alertes" style="display:inline-block;background:#147085;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px">Ouvrir mes réglages d'alerte</a>
</div></body></html>`;
  return new Response(html, {
    status: statut,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t")?.trim();
  // Un jeton absent ou qui n'est pas un UUID : on répond la même chose qu'un jeton inconnu, sans
  // rien apprendre à qui essaierait d'en deviner un.
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return page(
      "Ce lien n'est plus valable",
      "Le lien de désabonnement a peut-être été tronqué par votre messagerie. Vous pouvez couper le récapitulatif depuis vos réglages.",
      400,
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("recap_destinataires")
    .update({ actif: false, desinscrit_at: new Date().toISOString() })
    .eq("token", token)
    .select("user_id")
    .maybeSingle();

  if (error) {
    return page(
      "Nous n'avons pas pu enregistrer votre demande",
      "Réessayez dans un instant, ou coupez le récapitulatif depuis vos réglages — le résultat est le même.",
      500,
    );
  }
  if (!data) {
    return page(
      "Ce lien n'est plus valable",
      "Vous êtes peut-être déjà désabonné. Vos réglages vous diront où vous en êtes.",
      404,
    );
  }

  return page(
    "C'est fait : vous ne recevrez plus le récapitulatif du matin",
    "Rien d'autre ne change — vos collègues continuent de le recevoir s'ils y sont abonnés, et les messages envoyés à vos clients ne sont pas concernés. Vous pouvez revenir sur cette décision à tout moment.",
    200,
  );
}
