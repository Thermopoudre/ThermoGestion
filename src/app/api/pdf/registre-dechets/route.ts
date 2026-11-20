import type { NextRequest } from "next/server";
import { createElement } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { chargerLogo, erreurPdf, reponsePdf } from "@/lib/pdf/render";
import { capaciteServeur, messageCapacite } from "@/lib/abonnement-serveur";
import { accentAtelier, COMMUN, COULEURS, PiedPage, stylePage, type LogoSource } from "@/lib/pdf/styles";
import { POLICE } from "@/lib/pdf/polices";
import { dateFr, nombreFr } from "@/lib/utils";
import { CONSERVATION_REGISTRE_ANNEES, bordereauManquant, totauxDechets, type LigneDechet } from "@/lib/environnement";
import type { Atelier } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const h = createElement;

/**
 * Registre chronologique des déchets sortants, prêt à présenter à l'inspection des installations
 * classées. Les colonnes reprennent les mentions de l'arrêté du 31 mai 2021 dans l'ordre où
 * l'inspecteur les lit : date d'expédition, nature et code, quantité, bordereau, transporteur,
 * installation de destination, code de traitement.
 */
const styles = StyleSheet.create({
  page: stylePage({ paddingTop: 36, paddingBottom: 50, paddingHorizontal: 34, fontSize: 8, lineHeight: 1.4 }),
  entete: { ...COMMUN.entete, marginBottom: 16 },
  enteteGauche: COMMUN.enteteGauche,
  logo: { width: 40, height: 40, marginRight: 8, objectFit: "contain" },
  emetteurNom: { ...COMMUN.emetteurNom, fontSize: 12 },
  petit: { ...COMMUN.petit, fontSize: 7 },
  titre: { ...COMMUN.titre, fontSize: 15, marginBottom: 2 },
  sousTitre: { ...COMMUN.sousTitre, fontSize: 8, marginBottom: 12 },
  synthese: { flexDirection: "row", marginBottom: 10 },
  case: { width: "25%" },
  caseTitre: { ...COMMUN.blocLabel, fontSize: 6.5, letterSpacing: 0.4 },
  caseValeur: { fontSize: 12, fontWeight: 700 },
  thead: { ...COMMUN.theadLeger, marginTop: 4 },
  th: { ...COMMUN.th, fontSize: 6.5, letterSpacing: 0.4 },
  tr: { ...COMMUN.tr, paddingVertical: 3, alignItems: "flex-start" },
  vide: { ...COMMUN.vide, fontSize: 8, marginTop: 6 },
  alerte: COMMUN.nonConforme,
  mentions: { ...COMMUN.mentions, paddingTop: 8, marginTop: 16, fontSize: 7, color: COULEURS.secondaire, lineHeight: 1.5 },
});

function identiteEmetteur(a: Atelier) {
  return [a.forme_juridique, a.siren ? `SIREN ${a.siren}` : null, a.code_ape ? `APE ${a.code_ape}` : null].filter(Boolean).join(" · ");
}

function Case({ titre, valeur, alerte }: { titre: string; valeur: string; alerte?: boolean }) {
  return h(View, { style: styles.case },
    h(Text, { style: styles.caseTitre }, titre),
    h(Text, { style: [styles.caseValeur, alerte ? styles.alerte : undefined] }, valeur),
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  const { data: membre } = await supabase.from("users").select("atelier_id").maybeSingle();
  if (!membre) return erreurPdf("Atelier introuvable.", 404);

  // Le droit de formule est rejoué ici : une route PDF ne passe pas par le trigger d'écriture,
  // et une URL connue ne doit pas ouvrir un document que la formule ne couvre pas.
  if (!(await capaciteServeur(supabase, "registre_dechets"))) return erreurPdf(messageCapacite("registre_dechets"), 402);

  const annee = req.nextUrl.searchParams.get("annee") ?? String(new Date().getFullYear());
  if (!/^\d{4}$/.test(annee)) return erreurPdf("Année invalide : indiquez une année à quatre chiffres.", 400);

  const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", membre.atelier_id).maybeSingle();
  if (!atelier) return erreurPdf("Atelier introuvable.", 404);

  const { data } = await supabase
    .from("dechets")
    .select("*")
    .gte("date_sortie", `${annee}-01-01`)
    .lte("date_sortie", `${annee}-12-31`)
    .order("date_sortie");

  const lignes = (data as LigneDechet[]) ?? [];
  const totaux = totauxDechets(lignes);
  const logo = await chargerLogo(atelier.logo_url);
  const a = atelier as Atelier;

  const document = h(Document,
    { title: `Registre des déchets ${annee}`, author: a.nom, creator: "Thermogestion", producer: "Thermogestion" },
    h(Page, { size: "A4", orientation: "landscape", style: styles.page },
      h(View, { style: styles.entete },
        h(View, { style: styles.enteteGauche },
          logo ? h(Image, { src: logo as LogoSource, style: styles.logo }) : null,
          h(View, {},
            h(Text, { style: styles.emetteurNom }, a.nom),
            a.adresse ? h(Text, { style: styles.petit }, `${a.adresse}${a.code_postal || a.ville ? `, ${[a.code_postal, a.ville].filter(Boolean).join(" ")}` : ""}`) : null,
            identiteEmetteur(a) ? h(Text, { style: styles.petit }, identiteEmetteur(a)) : null,
          ),
        ),
        h(View, { style: { alignItems: "flex-end" } },
          h(Text, { style: [styles.petit, { fontWeight: 700, color: accentAtelier(a) }] }, "ICPE 2940"),
          h(Text, { style: styles.petit }, `Exercice ${annee}`),
        ),
      ),
      h(Text, { style: styles.titre }, "Registre chronologique des déchets sortants"),
      h(Text, { style: styles.sousTitre },
        "Art. R.541-43 du code de l'environnement et arrêté du 31 mai 2021. Registre tenu par l'exploitant et conservé " +
          `${CONSERVATION_REGISTRE_ANNEES} ans.`),

      h(View, { style: styles.synthese },
        h(Case, { titre: "Déchets dangereux", valeur: `${nombreFr(totaux.dangereux)} kg` }),
        h(Case, { titre: "Déchets non dangereux", valeur: `${nombreFr(totaux.nonDangereux)} kg` }),
        h(Case, { titre: "Total", valeur: `${nombreFr(totaux.total)} kg` }),
        h(Case, { titre: "Sorties enregistrées", valeur: String(lignes.length) }),
      ),

      lignes.length === 0
        ? h(Text, { style: styles.vide }, `Aucune sortie de déchets enregistrée sur l'exercice ${annee}.`)
        : h(View, {},
            h(View, { style: styles.thead, fixed: true },
              h(Text, { style: [styles.th, { width: "9%" }] }, "Date"),
              h(Text, { style: [styles.th, { width: "24%" }] }, "Nature du déchet"),
              h(Text, { style: [styles.th, { width: "9%" }] }, "Code"),
              h(Text, { style: [styles.th, { width: "8%" }] }, "Classement"),
              h(Text, { style: [styles.th, { width: "8%" }] }, "Quantité"),
              h(Text, { style: [styles.th, { width: "12%" }] }, "Bordereau"),
              h(Text, { style: [styles.th, { width: "13%" }] }, "Transporteur"),
              h(Text, { style: [styles.th, { width: "12%" }] }, "Destination"),
              h(Text, { style: [styles.th, { width: "5%" }] }, "Trait."),
            ),
            ...lignes.map((l) => h(View, { key: l.id, style: styles.tr, wrap: false },
              h(Text, { style: { width: "9%" } }, dateFr(l.date_sortie)),
              h(Text, { style: { width: "24%" } }, l.nature),
              h(Text, { style: { width: "9%" } }, l.code_dechet ?? "—"),
              h(Text, { style: [{ width: "8%" }, l.dangereux ? styles.alerte : undefined] }, l.dangereux ? "Dangereux" : "Non dang."),
              h(Text, { style: { width: "8%" } }, `${nombreFr(l.quantite_kg)} kg`),
              h(Text, { style: [{ width: "12%" }, bordereauManquant(l) ? styles.alerte : undefined] }, l.bordereau ?? (l.dangereux ? "MANQUANT" : "—")),
              h(Text, { style: { width: "13%" } }, l.transporteur ?? "—"),
              h(Text, { style: { width: "12%" } }, l.destination ?? "—"),
              h(Text, { style: { width: "5%" } }, l.traitement ?? "—"),
            )),
          ),

      totaux.sansBordereau > 0
        ? h(Text, { style: [styles.mentions, styles.alerte] },
            `${totaux.sansBordereau} sortie(s) de déchet dangereux sans numéro de bordereau de suivi. ` +
              "Le bordereau (BSD / Trackdéchets) est obligatoire dès l'expédition et doit être joint au registre.")
        : null,

      h(Text, { style: styles.mentions },
        "Ce registre est produit par Thermogestion à partir des saisies de l'atelier. Il ne se substitue " +
          "ni aux bordereaux de suivi de déchets dangereux, ni à la déclaration annuelle des émissions et " +
          "des transferts de polluants et de déchets, qui restent à la charge de l'exploitant."),

      h(PiedPage, { gauche: `${a.nom} — registre des déchets ${annee}`, bas: 20, marge: 34 }),
    ),
  );

  return reponsePdf(document, `registre-dechets-${annee}`);
}
