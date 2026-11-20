import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { enregistrerPolices } from "@/lib/pdf/polices";
import { accentAtelier, COMMUN, COULEURS, PiedPage, stylePage, type LogoSource } from "@/lib/pdf/styles";
import { dateFr } from "@/lib/utils";
import { ETAT_RECEPTION } from "@/lib/types";
import type { Atelier, Client, Reception } from "@/lib/types";

enregistrerPolices();

/**
 * Bon de prise en charge hors jantes (B6) — même gabarit visuel que `pdf/jantes.tsx`
 * (`pdf/styles.ts` partagé : en-tête, bloc client, encadré réserves, cadre de signature, pied de
 * page unique) adapté à une réception de pièces classiques : le module jantes avait déjà le sien,
 * le thermolaquage courant non.
 */

const styles = StyleSheet.create({
  page: stylePage({ paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9, lineHeight: 1.45 }),
  entete: { ...COMMUN.entete, marginBottom: 18 },
  enteteGauche: COMMUN.enteteGauche,
  logo: { width: 46, height: 46, marginRight: 10, objectFit: "contain" },
  emetteurNom: { ...COMMUN.emetteurNom, fontSize: 13 },
  petit: { ...COMMUN.petit, fontSize: 8 },
  titre: { ...COMMUN.titre, fontSize: 17 },
  sousTitre: { ...COMMUN.sousTitre, fontSize: 9, marginBottom: 14 },

  bloc: { ...COMMUN.bloc, padding: 10, marginBottom: 14 },
  blocLabel: { ...COMMUN.blocLabel, fontSize: 7, marginBottom: 2 },
  gras: COMMUN.gras,

  etatLigne: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  pastille: { borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, fontWeight: 700 },

  reserve: { borderWidth: 0.5, borderColor: "#fcd34d", backgroundColor: "#fffbeb", borderRadius: 3, padding: 8, marginBottom: 14 },
  signature: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end" },
  cadreSignature: { ...COMMUN.cadre, width: 240, padding: 10, minHeight: 92 },
  imgSignature: { height: 52, objectFit: "contain", marginTop: 4 },

  mentions: { ...COMMUN.mentions, paddingTop: 10, marginTop: 18 },
  mentionsTexte: COMMUN.mentionsTexte,
});

const TON_ETAT: Record<Reception["etat_constate"], { fond: string; texte: string }> = {
  bon: { fond: "#dcfce7", texte: "#166534" },
  rayures: { fond: "#fef3c7", texte: "#92400e" },
  chocs: { fond: "#fee2e2", texte: "#991b1b" },
  corrosion: { fond: "#fee2e2", texte: "#991b1b" },
  ancien_revetement: { fond: "#fef3c7", texte: "#92400e" },
  autre: { fond: "#e5e7eb", texte: "#374151" },
};

export function ReceptionDocument({
  reception,
  client,
  atelier,
  logo,
}: {
  reception: Reception;
  client: Client;
  atelier: Atelier;
  logo: LogoSource | null;
}) {
  const accent = accentAtelier(atelier);
  const ton = TON_ETAT[reception.etat_constate] ?? TON_ETAT.autre;
  const signature = reception.signature as { image?: string } | null;

  return (
    <Document title={`Réception ${reception.numero ?? ""}`} author={atelier.nom} creator="Thermogestion" producer="Thermogestion">
      <Page size="A4" style={styles.page}>
        <View style={styles.entete}>
          <View style={styles.enteteGauche}>
            {logo && <Image src={logo} style={styles.logo} />}
            <View>
              <Text style={styles.emetteurNom}>{atelier.nom}</Text>
              {atelier.adresse ? (
                <Text style={styles.petit}>
                  {atelier.adresse}
                  {[atelier.code_postal, atelier.ville].filter(Boolean).length ? `, ${[atelier.code_postal, atelier.ville].filter(Boolean).join(" ")}` : ""}
                </Text>
              ) : null}
              {[atelier.telephone, atelier.email].filter(Boolean).length ? (
                <Text style={styles.petit}>{[atelier.telephone, atelier.email].filter(Boolean).join(" · ")}</Text>
              ) : null}
            </View>
          </View>
          <View>
            <Text style={[styles.titre, { color: accent }]}>Bon de prise en charge</Text>
            <Text style={styles.petit}>{reception.numero ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.sousTitre}>Reçu le {dateFr(reception.created_at)}</Text>

        <View style={styles.bloc}>
          <Text style={styles.blocLabel}>Client</Text>
          <Text style={styles.gras}>{client.nom}</Text>
          {reception.depose_par ? <Text style={styles.petit}>Remis par {reception.depose_par}</Text> : null}
          <Text style={{ marginTop: 6 }}>
            {reception.nb_pieces} pièce{reception.nb_pieces > 1 ? "s" : ""}
            {reception.designation ? ` — ${reception.designation}` : ""}
          </Text>
          <View style={styles.etatLigne}>
            <Text style={styles.blocLabel}>État constaté à la réception : </Text>
            <Text style={[styles.pastille, { backgroundColor: ton.fond, color: ton.texte }]}>
              {ETAT_RECEPTION[reception.etat_constate]}
            </Text>
          </View>
        </View>

        {reception.reserves ? (
          <View style={styles.reserve}>
            <Text style={[styles.blocLabel, { color: "#92400e" }]}>Réserves à la prise en charge</Text>
            <Text style={{ color: "#78350f" }}>{reception.reserves}</Text>
          </View>
        ) : null}

        <View style={styles.signature}>
          <View style={styles.cadreSignature}>
            <Text style={styles.blocLabel}>Bon pour accord sur l&apos;état constaté</Text>
            <Text style={styles.petit}>{reception.depose_par ?? client.nom}</Text>
            {signature?.image && typeof signature.image === "string" && signature.image.startsWith("data:image/png") ? (
              <Image src={signature.image} style={styles.imgSignature} />
            ) : null}
            {reception.signed_at ? <Text style={styles.petit}>Signé le {dateFr(reception.signed_at)}</Text> : null}
          </View>
        </View>

        <View style={styles.mentions}>
          <Text style={styles.mentionsTexte}>
            Ce document constate l&apos;état des pièces au moment de leur dépôt. Les défauts non
            mentionnés ci-dessus sont réputés absents à la prise en charge. Les photographies prises à
            la réception, référence datée s&apos;il y a lieu, sont conservées dans le dossier de
            l&apos;atelier.
          </Text>
        </View>

        {/* Le pied commun : plus de « Page 1 / 1 » sur un bon d'une seule page. */}
        <PiedPage gauche={atelier.nom} bas={24} marge={40} />
      </Page>
    </Document>
  );
}
