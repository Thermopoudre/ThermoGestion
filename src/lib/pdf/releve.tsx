import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { enregistrerPolices } from "@/lib/pdf/polices";
import { accentAtelier, COMMUN, COULEURS, PiedPage, stylePage, type LogoSource } from "@/lib/pdf/styles";
import { dateFr, eur } from "@/lib/utils";
import type { Atelier, Client } from "@/lib/types";

enregistrerPolices();

/**
 * Relevé de compte et lettre de relance (lot C, C3) — mêmes briques que les autres documents
 * (`pdf/styles.ts` : en-tête, bloc client, pied de page unique), adaptées à deux besoins que le
 * produit n'avait pas encore : dire à un client TOUT ce qu'il doit d'un coup d'œil, et lui envoyer
 * une lettre de relance qui tient debout devant un tribunal (mentions L441-10 du code de commerce).
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

  thead: COMMUN.thead,
  th: { ...COMMUN.th, fontSize: 7 },
  tr: { ...COMMUN.tr, paddingVertical: 5 },
  colNumero: { width: "22%" },
  colEcheance: { width: "20%" },
  colRetard: { width: "18%", textAlign: "right" },
  colDu: { width: "20%", textAlign: "right" },
  colTranche: { width: "20%", textAlign: "right" },

  totalLigne: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COULEURS.filetFort, marginTop: 4, paddingTop: 6, fontSize: 11 },

  note: { ...COMMUN.bloc, padding: 9, fontSize: 8, color: "#4b5563", marginTop: 16 },
  mentions: { ...COMMUN.mentions, paddingTop: 10, marginTop: 22 },
  mentionsTexte: COMMUN.mentionsTexte,
});

function Entete({ atelier, logo, titre }: { atelier: Atelier; logo: LogoSource | null; titre: string }) {
  return (
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
      <Text style={[styles.titre, { color: accentAtelier(atelier) }]}>{titre}</Text>
    </View>
  );
}

export type LigneReleve = {
  numero: string | null;
  due_date: string;
  total_ttc: number;
  reste_du: number;
  retard_jours: number;
};

// ── Relevé de compte ─────────────────────────────────────────────────────────

export function ReleveCompteDocument({
  client,
  atelier,
  logo,
  lignes,
  genere_le,
}: {
  client: Client;
  atelier: Atelier;
  logo: LogoSource | null;
  lignes: LigneReleve[];
  genere_le: string;
}) {
  const total = lignes.reduce((s, l) => s + l.reste_du, 0);

  return (
    <Document title={`Relevé de compte — ${client.nom}`} author={atelier.nom} creator="Thermogestion" producer="Thermogestion">
      <Page size="A4" style={styles.page}>
        <Entete atelier={atelier} logo={logo} titre="Relevé de compte" />
        <Text style={styles.sousTitre}>Édité le {dateFr(genere_le)}</Text>

        <View style={styles.bloc}>
          <Text style={styles.blocLabel}>Client</Text>
          <Text style={styles.gras}>{client.nom}</Text>
        </View>

        <View>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colNumero]}>Facture</Text>
            <Text style={[styles.th, styles.colEcheance]}>Échéance</Text>
            <Text style={[styles.th, styles.colRetard]}>Retard</Text>
            <Text style={[styles.th, styles.colDu]}>Reste dû</Text>
          </View>
          {lignes.length === 0 ? (
            <Text style={{ marginTop: 8, color: COULEURS.secondaire }}>Aucune facture impayée à ce jour.</Text>
          ) : (
            lignes.map((l, i) => (
              <View key={i} style={styles.tr} wrap={false}>
                <Text style={styles.colNumero}>{l.numero ?? "—"}</Text>
                <Text style={styles.colEcheance}>{dateFr(l.due_date)}</Text>
                <Text style={styles.colRetard}>{l.retard_jours > 0 ? `${l.retard_jours} j` : "à échoir"}</Text>
                <Text style={styles.colDu}>{eur(l.reste_du)}</Text>
              </View>
            ))
          )}
        </View>

        {lignes.length > 0 && (
          <View style={styles.totalLigne}>
            <Text>Total dû</Text>
            <Text style={styles.gras}>{eur(total)}</Text>
          </View>
        )}

        <View style={styles.mentions}>
          <Text style={styles.mentionsTexte}>
            Ce relevé récapitule les factures émises et non soldées à la date d&apos;édition ci-dessus. Il
            ne se substitue à aucune des factures qu&apos;il liste.
          </Text>
        </View>

        <PiedPage gauche={atelier.nom} bas={24} marge={40} />
      </Page>
    </Document>
  );
}

// ── Lettre de relance ────────────────────────────────────────────────────────

export function LettreRelanceDocument({
  client,
  atelier,
  logo,
  numero,
  due_date,
  reste_du,
  retard_jours,
  genere_le,
}: {
  client: Client;
  atelier: Atelier;
  logo: LogoSource | null;
  numero: string | null;
  due_date: string;
  reste_du: number;
  retard_jours: number;
  genere_le: string;
}) {
  // L441-10 du code de commerce : indemnité forfaitaire de recouvrement, fixe, quel que soit le
  // montant de la créance — ce n'est pas un pourcentage, c'est un forfait légal identique partout
  // dans le produit (déjà imprimé sur chaque facture, cf. lib/pdf/document.tsx).
  const INDEMNITE_FORFAITAIRE = 40;
  const penalites = Math.round((reste_du * (atelier.penalites_taux ?? 0) / 100) * (retard_jours / 365) * 100) / 100;

  return (
    <Document title={`Relance — ${numero ?? "facture"}`} author={atelier.nom} creator="Thermogestion" producer="Thermogestion">
      <Page size="A4" style={styles.page}>
        <Entete atelier={atelier} logo={logo} titre="Lettre de relance" />
        <Text style={styles.sousTitre}>Le {dateFr(genere_le)}</Text>

        <View style={styles.bloc}>
          <Text style={styles.blocLabel}>Destinataire</Text>
          <Text style={styles.gras}>{client.nom}</Text>
          {client.adresse ? <Text style={styles.petit}>{client.adresse}, {[client.code_postal, client.ville].filter(Boolean).join(" ")}</Text> : null}
        </View>

        <Text style={{ marginBottom: 10 }}>Madame, Monsieur,</Text>
        <Text style={{ marginBottom: 10 }}>
          Malgré nos précédents rappels éventuels, la facture {numero ?? ""}, d&apos;un montant de{" "}
          {eur(reste_du)} TTC, échue le {dateFr(due_date)}, demeure impayée à ce jour — soit{" "}
          {retard_jours} jour{retard_jours > 1 ? "s" : ""} de retard.
        </Text>
        <Text style={{ marginBottom: 10 }}>
          Nous vous demandons de bien vouloir procéder au règlement de cette somme dans les meilleurs
          délais. À défaut de règlement sous 8 jours, nous nous réservons le droit d&apos;engager toute
          action utile au recouvrement de cette créance.
        </Text>

        <View style={styles.note}>
          <Text>
            Conformément à l&apos;article L441-10 du code de commerce, tout retard de paiement entraîne de
            plein droit, outre les pénalités de retard au taux annuel de {atelier.penalites_taux ?? 0} %
            (soit {eur(penalites)} à ce jour), une indemnité forfaitaire pour frais de recouvrement de{" "}
            {eur(INDEMNITE_FORFAITAIRE)}, due sans qu&apos;un rappel soit nécessaire.
          </Text>
        </View>

        <Text style={{ marginTop: 16 }}>Nous vous prions d&apos;agréer, Madame, Monsieur, nos salutations distinguées.</Text>
        <Text style={{ marginTop: 20 }}>{atelier.nom}</Text>

        <PiedPage gauche={atelier.nom} bas={24} marge={40} />
      </Page>
    </Document>
  );
}
