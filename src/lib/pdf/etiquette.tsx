import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { enregistrerPolices } from "@/lib/pdf/polices";
import { accentAtelier, COMMUN, COULEURS, PiedPage, stylePage, type LogoSource } from "@/lib/pdf/styles";
import { dateFr, nombreFr } from "@/lib/utils";
import type { Atelier, Client, Etape, Poudre, Projet } from "@/lib/types";

enregistrerPolices();

/**
 * Fiche suiveuse A5 paysage (B5) — le papier qui accompagne la pièce dans l'atelier.
 *
 * `projets/[id]` promettait déjà « Imprimez ce QR sur la fiche suiveuse » sans que la route
 * existe : sans papier sur la pièce, personne ne scanne ; sans scan, pas de pointage ; sans
 * pointage, le prix de revient reste théorique. A5 pour tenir sur la moitié d'une feuille A4
 * pliée en deux et glissée dans une pochette plastique en cabine ; paysage pour un numéro et un
 * QR lisibles de loin, gants de sablage compris.
 */

const styles = StyleSheet.create({
  page: stylePage({ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 28, fontSize: 9, lineHeight: 1.35 }),
  entete: { ...COMMUN.entete, marginBottom: 10 },
  enteteGauche: COMMUN.enteteGauche,
  logo: { width: 32, height: 32, marginRight: 8, objectFit: "contain" },
  emetteurNom: { ...COMMUN.emetteurNom, fontSize: 10 },
  numero: { fontWeight: 700, fontSize: 34 },
  qr: { width: 78, height: 78 },

  corps: { flexDirection: "row", marginTop: 4, gap: 14 },
  colonneGauche: { flex: 1 },
  colonneDroite: { width: 150 },

  bloc: { ...COMMUN.bloc, padding: 8, marginBottom: 8 },
  blocLabel: { ...COMMUN.blocLabel, fontSize: 7, marginBottom: 2 },
  gras: { ...COMMUN.gras, fontSize: 11 },
  petit: { ...COMMUN.petit, fontSize: 8 },

  etape: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  case: { width: 11, height: 11, borderWidth: 1, borderColor: COULEURS.filetFort, borderRadius: 2, marginRight: 6 },
  caseCochee: { backgroundColor: COULEURS.encre },
  etapeLibelle: { fontSize: 9 },
  etapeLibelleFaite: { color: COULEURS.secondaire, textDecoration: "line-through" },
});

export function EtiquetteProjetDocument({
  projet,
  client,
  atelier,
  poudre,
  logo,
  qrDataUrl,
}: {
  projet: Projet;
  client: Client;
  atelier: Atelier;
  poudre: Poudre | null;
  logo: LogoSource | null;
  /** QR déjà encodé en data URL (`qrcode` génère côté serveur, pas de requête réseau au rendu). */
  qrDataUrl: string;
}) {
  const accent = accentAtelier(atelier);
  const etapes = (projet.etapes ?? []) as Etape[];
  // « Pièces » : `DevisEditor`/`FactureEditor` posent le détail dans les lignes du devis d'origine,
  // pas sur le projet lui-même (hors périmètre B5) — la fiche imprime donc ce que le projet sait
  // réellement de lui-même : son nom, éventuellement complété par la désignation du devis si elle
  // a été recopiée dans les notes à la création.
  const designation = projet.nom;

  return (
    <Document title={`Fiche suiveuse ${projet.numero ?? ""}`} author={atelier.nom} creator="Thermogestion" producer="Thermogestion">
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.entete}>
          <View style={styles.enteteGauche}>
            {logo && <Image src={logo} style={styles.logo} />}
            <Text style={styles.emetteurNom}>{atelier.nom}</Text>
          </View>
          <Text style={[styles.numero, { color: accent }]}>{projet.numero ?? "—"}</Text>
        </View>

        <View style={styles.corps}>
          <View style={styles.colonneGauche}>
            <View style={styles.bloc}>
              <Text style={styles.blocLabel}>Client</Text>
              <Text style={styles.gras}>{client.nom}</Text>
            </View>
            <View style={styles.bloc}>
              <Text style={styles.blocLabel}>Désignation</Text>
              <Text style={styles.gras}>{designation}</Text>
              <Text style={styles.petit}>
                {[
                  poudre ? `${poudre.reference}${poudre.ral ? ` (RAL ${poudre.ral})` : ""}` : null,
                  poudre?.finition ?? null,
                  projet.teinte_origine ? `origine : ${projet.teinte_origine}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Teinte non renseignée"}
              </Text>
            </View>
            <View style={[styles.bloc, { flexDirection: "row", justifyContent: "space-between" }]}>
              <View>
                <Text style={styles.blocLabel}>Surface</Text>
                <Text style={styles.gras}>{projet.surface_m2 != null ? `${nombreFr(projet.surface_m2, 2)} m²` : "—"}</Text>
              </View>
              <View>
                <Text style={styles.blocLabel}>Couches</Text>
                <Text style={styles.gras}>{projet.couches}</Text>
              </View>
              <View>
                <Text style={styles.blocLabel}>Promis le</Text>
                <Text style={styles.gras}>{projet.date_promise ? dateFr(projet.date_promise) : "—"}</Text>
              </View>
            </View>

            <Text style={styles.blocLabel}>Étapes</Text>
            {etapes.map((e) => (
              <View key={e.code} style={styles.etape}>
                <View style={[styles.case, e.done_at ? styles.caseCochee : undefined]} />
                <Text style={[styles.etapeLibelle, e.done_at ? styles.etapeLibelleFaite : undefined]}>
                  {e.libelle}{e.done_at ? ` — ${dateFr(e.done_at)}` : ""}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.colonneDroite}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer n'a pas d'attribut alt */}
            <Image src={qrDataUrl} style={styles.qr} />
            <Text style={[styles.petit, { marginTop: 4 }]}>
              Scanner à chaque étape validée : pointage automatique, sans passer par un poste.
            </Text>
          </View>
        </View>

        <PiedPage gauche={`${atelier.nom} — fiche suiveuse ${projet.numero ?? ""}`} bas={16} marge={28} />
      </Page>
    </Document>
  );
}
