import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { enregistrerPolices } from "@/lib/pdf/polices";
import { accentAtelier, COMMUN, COULEURS, PiedPage, stylePage, type LogoSource } from "@/lib/pdf/styles";
import { dateFr, nombreFr } from "@/lib/utils";
import { ETATS_JANTE, OPERATIONS_JANTE, POSITIONS_JANTE, libelleJeu } from "@/lib/jantes";
import type { Atelier, Client, Jante, JeuJantes, Vehicule } from "@/lib/types";

enregistrerPolices();

/**
 * Bon de prise en charge d'un jeu de jantes, jante par jante, avec ses photos.
 *
 * C'est le document du métier qu'aucun logiciel généraliste ne produit — et le seul qui protège
 * l'atelier. Une jante vaut cher à l'unité : « ma jante était intacte à l'arrivée » se conteste
 * avec une photo datée de CETTE jante, pas d'un tas de quatre.
 *
 * Le PDF est produit côté serveur pour la même raison que le devis et la facture : le rendu ne
 * dépend d'aucun poste, il est archivable en l'état, et il est opposable.
 */

export type PhotoPdf = { data: Buffer; format: "png" | "jpg" };

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

  jante: { ...COMMUN.cadre, padding: 8, marginBottom: 8 },
  janteEntete: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  pastille: { backgroundColor: COULEURS.filet, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6, fontSize: 8, fontWeight: 700 },
  photos: { flexDirection: "row", flexWrap: "wrap", marginTop: 5 },
  photo: { width: 108, height: 81, marginRight: 5, marginBottom: 5, objectFit: "cover", borderRadius: 2 },

  reserve: { borderWidth: 0.5, borderColor: "#fcd34d", backgroundColor: "#fffbeb", borderRadius: 3, padding: 8, marginBottom: 14 },
  signature: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end" },
  cadreSignature: { ...COMMUN.cadre, width: 240, padding: 10, minHeight: 92 },
  imgSignature: { height: 52, objectFit: "contain", marginTop: 4 },

  mentions: { ...COMMUN.mentions, paddingTop: 10, marginTop: 18 },
  mentionsTexte: COMMUN.mentionsTexte,
});

export function BonJantesDocument({
  jeu,
  jantes,
  vehicule,
  client,
  atelier,
  logo,
  photos,
}: {
  jeu: JeuJantes;
  jantes: Jante[];
  vehicule: Vehicule | null;
  client: Client;
  atelier: Atelier;
  logo: LogoSource | null;
  /** Photos déjà téléchargées, indexées par `jante_id`. @react-pdf n'ira chercher aucune URL. */
  photos: Record<string, PhotoPdf[]>;
}) {
  const accent = accentAtelier(atelier);
  const teinteOrigine = !!jeu.teinte && jeu.teinte === vehicule?.teinte_origine;
  const titre = libelleJeu({
    nbJantes: jeu.nb_jantes,
    diametre: Number(jeu.diametre_pouces),
    finition: jeu.finition,
    teinte: jeu.teinte,
    teinteReference: teinteOrigine ? vehicule?.teinte_reference : null,
    teinteOrigine,
    vehicule,
  });

  return (
    <Document title={`Prise en charge ${jeu.numero ?? ""}`} author={atelier.nom} creator="Thermogestion" producer="Thermogestion">
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
            <Text style={[styles.titre, { color: accent }]}>Prise en charge</Text>
            <Text style={styles.petit}>{jeu.numero ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.sousTitre}>Déposé le {dateFr(jeu.created_at)}</Text>

        <View style={styles.bloc}>
          <Text style={styles.blocLabel}>Client</Text>
          <Text style={styles.gras}>{client.nom}</Text>
          {jeu.depose_par ? <Text style={styles.petit}>Remis par {jeu.depose_par}</Text> : null}
          <Text style={{ marginTop: 6 }}>{titre}</Text>
          <Text style={styles.petit}>
            {[
              vehicule?.immatriculation,
              jeu.largeur_pouces != null ? `${nombreFr(jeu.largeur_pouces, 1)}J` : null,
              jeu.pneus_montes ? "pneus montés" : "jantes nues",
              jeu.tpms ? "capteurs TPMS" : null,
              jeu.date_promise ? `à rendre le ${dateFr(jeu.date_promise)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        {jeu.reserves ? (
          <View style={styles.reserve}>
            <Text style={[styles.blocLabel, { color: "#92400e" }]}>Réserves à la prise en charge</Text>
            <Text style={{ color: "#78350f" }}>{jeu.reserves}</Text>
          </View>
        ) : null}

        {jantes.map((r) => {
          const position = POSITIONS_JANTE.find((p) => p.code === r.position);
          const etats = (r.etat_constate ?? []) as string[];
          const ops = (r.operations ?? []) as string[];
          return (
            <View key={r.id} style={styles.jante} wrap={false}>
              <View style={styles.janteEntete}>
                <Text style={styles.pastille}>{position?.court ?? r.position}</Text>
                <Text style={styles.gras}>{position?.libelle ?? r.position}</Text>
              </View>
              <Text>
                {etats.length ? etats.map((e) => ETATS_JANTE[e] ?? e).join(", ") : "Aucun défaut relevé"}
                {r.voile_mm != null ? ` · voile ${nombreFr(r.voile_mm, 1)} mm` : ""}
              </Text>
              {ops.length ? (
                <Text style={styles.petit}>
                  À réaliser : {ops.map((o) => OPERATIONS_JANTE[o as keyof typeof OPERATIONS_JANTE] ?? o).join(", ")}
                </Text>
              ) : null}
              {r.reserves ? <Text style={[styles.petit, { color: "#92400e" }]}>{r.reserves}</Text> : null}
              {(photos[r.id] ?? []).length ? (
                <View style={styles.photos}>
                  {(photos[r.id] ?? []).slice(0, 6).map((p, i) => (
                    <Image key={i} src={p} style={styles.photo} />
                  ))}
                </View>
              ) : (
                <Text style={[styles.petit, { color: "#b45309" }]}>Aucune photo — l&apos;état ci-dessus n&apos;est appuyé par aucune preuve datée.</Text>
              )}
            </View>
          );
        })}

        <View style={styles.signature}>
          <View style={styles.cadreSignature}>
            <Text style={styles.blocLabel}>Bon pour accord sur l&apos;état constaté</Text>
            <Text style={styles.petit}>{jeu.depose_par ?? client.nom}</Text>
            {jeu.signature && typeof (jeu.signature as { image?: string }).image === "string" && (jeu.signature as { image?: string }).image?.startsWith("data:image/png") ? (
              <Image src={(jeu.signature as { image: string }).image} style={styles.imgSignature} />
            ) : null}
            {jeu.signed_at ? <Text style={styles.petit}>Signé le {dateFr(jeu.signed_at)}</Text> : null}
          </View>
        </View>

        <View style={styles.mentions}>
          <Text style={styles.mentionsTexte}>
            Ce document constate l&apos;état des jantes au moment de leur dépôt. Les défauts non mentionnés
            ci-dessus sont réputés absents à la prise en charge.
          </Text>
          <Text style={styles.mentionsTexte}>
            Les capteurs de pression (TPMS) sont des pièces d&apos;usure fragiles. Leur remplacement,
            s&apos;il s&apos;avère nécessaire au remontage, fait l&apos;objet d&apos;un accord préalable du client.
          </Text>
        </View>

        {/* Le pied commun : plus de « Page 1 / 1 » sur un bon d'une seule page. */}
        <PiedPage gauche={atelier.nom} bas={24} marge={40} />
      </Page>
    </Document>
  );
}
