import type { NextRequest } from "next/server";
import { createElement } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { chargerLogo, erreurPdf, reponsePdf } from "@/lib/pdf/render";
import { capaciteServeur, messageCapacite } from "@/lib/abonnement-serveur";
import { eurPdf } from "@/lib/pdf/document";
import { accentAtelier, COMMUN, COULEURS, PiedPage as PiedPageCommun, stylePage, type LogoSource } from "@/lib/pdf/styles";
import { POLICE } from "@/lib/pdf/polices";
import { dateFr, libelleBain } from "@/lib/utils";
import { normaliserSeuils, resumeSeuils, resumeValeurs, typesControleActifs, verdictLabel, TYPE_CONTROLE_LABEL } from "@/lib/qualite";
import { certificationDeReference, labelOpposable } from "@/lib/certificat";
import type { Atelier, Certification, Controle, ControleBain, NonConformite, ReferentielQualite } from "@/lib/types";

// @react-pdf/renderer produit un Buffer et s'appuie sur des API Node : le runtime Edge ne convient pas.
export const runtime = "nodejs";
// Le contenu dépend de la session (RLS) et de la période demandée : jamais de cache ni de pré-rendu.
export const dynamic = "force-dynamic";

const h = createElement;

function dateHeure(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Mentions d'identité de l'émetteur — même règle que sur les devis/factures (art. R.123-237 du code
 * de commerce). Dupliquée ici plutôt qu'importée : `identiteEmetteur` n'est pas exportée par
 * lib/pdf/document.tsx, fichier partagé avec d'autres écrans de l'application.
 */
function identiteEmetteur(a: Atelier) {
  return [
    a.forme_juridique,
    a.siren ? `SIREN ${a.siren}` : null,
    a.siret && !a.siren ? `SIRET ${a.siret}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const styles = StyleSheet.create({
  page: stylePage({ paddingTop: 36, paddingBottom: 50, paddingHorizontal: 34, fontSize: 8, lineHeight: 1.4 }),
  entete: { ...COMMUN.entete, marginBottom: 16 },
  enteteGauche: COMMUN.enteteGauche,
  logo: { width: 40, height: 40, marginRight: 8, objectFit: "contain" },
  emetteurNom: { ...COMMUN.emetteurNom, fontSize: 12 },
  petit: { ...COMMUN.petit, fontSize: 7 },
  titre: { ...COMMUN.titre, fontSize: 15, marginBottom: 2 },
  sousTitre: { ...COMMUN.sousTitre, fontSize: 8, marginBottom: 14 },
  section: { ...COMMUN.section, marginTop: 14, marginBottom: 4, fontSize: 10, paddingBottom: 3 },
  thead: { ...COMMUN.theadLeger, marginTop: 4 },
  th: { ...COMMUN.th, fontSize: 6.5, letterSpacing: 0.4 },
  tr: { ...COMMUN.tr, paddingVertical: 3, alignItems: "flex-start" },
  vide: { ...COMMUN.vide, fontSize: 8, marginTop: 4, marginBottom: 4 },
  conforme: COMMUN.conforme,
  nonConforme: COMMUN.nonConforme,
});

function Entete({ atelier, logo, from, to, label }: { atelier: Atelier; logo: LogoSource | null; from: string; to: string; label: string | null }) {
  const accent = accentAtelier(atelier);
  return h(View, { style: styles.entete },
    h(View, { style: styles.enteteGauche },
      logo ? h(Image, { src: logo, style: styles.logo }) : null,
      h(View, {},
        h(Text, { style: styles.emetteurNom }, atelier.nom),
        atelier.adresse ? h(Text, { style: styles.petit }, `${atelier.adresse}${atelier.code_postal || atelier.ville ? `, ${[atelier.code_postal, atelier.ville].filter(Boolean).join(" ")}` : ""}`) : null,
        identiteEmetteur(atelier) ? h(Text, { style: styles.petit }, identiteEmetteur(atelier)) : null,
      ),
    ),
    h(View, { style: { alignItems: "flex-end" } },
      label ? h(Text, { style: [styles.petit, { fontWeight: 700, color: accent }] }, label) : null,
      h(Text, { style: styles.petit }, `Période du ${dateFr(from)} au ${dateFr(to)}`),
    ),
  );
}

function VerdictTexte({ conforme }: { conforme: boolean | null }) {
  return h(Text, { style: conforme === false ? styles.nonConforme : conforme === true ? styles.conforme : undefined }, verdictLabel(conforme));
}

function SectionControles({ controles }: { controles: Controle[] }) {
  return h(View, {},
    h(Text, { style: styles.section }, `Contrôles produit (${controles.length})`),
    controles.length === 0
      ? h(Text, { style: styles.vide }, "Aucun contrôle enregistré sur cette période.")
      : h(View, {},
          h(View, { style: styles.thead, fixed: false },
            h(Text, { style: [styles.th, { width: "14%" }] }, "Date"),
            h(Text, { style: [styles.th, { width: "12%" }] }, "Type"),
            h(Text, { style: [styles.th, { width: "20%" }] }, "Projet"),
            h(Text, { style: [styles.th, { width: "26%" }] }, "Valeurs"),
            h(Text, { style: [styles.th, { width: "12%" }] }, "Verdict"),
            h(Text, { style: [styles.th, { width: "16%" }] }, "Opérateur"),
          ),
          ...controles.map((c) => h(View, { key: c.id, style: styles.tr, wrap: false },
            h(Text, { style: { width: "14%" } }, dateHeure(c.mesure_at)),
            h(Text, { style: { width: "12%" } }, TYPE_CONTROLE_LABEL[c.type]),
            h(Text, { style: { width: "20%" } }, c.projets ? `${c.projets.numero ? `${c.projets.numero} — ` : ""}${c.projets.nom}` : "—"),
            h(Text, { style: { width: "26%" } }, resumeValeurs(c.type, c.valeurs)),
            h(View, { style: { width: "12%" } }, h(VerdictTexte, { conforme: c.conforme })),
            h(Text, { style: { width: "16%" } }, c.users?.nom ?? "—"),
          )),
        ),
  );
}

/**
 * Barèmes réellement appliqués sur la période, tirés de la copie figée portée par chaque contrôle.
 * Un verdict sans son barème ne se vérifie pas — et si l'atelier a changé de seuils en cours de
 * période, l'auditeur doit voir les deux, pas seulement le réglage du jour de l'export.
 */
function SectionSeuils({ controles }: { controles: Controle[] }) {
  const baremes = new Map<string, { nom: string; texte: string; nombre: number }>();
  for (const c of controles) {
    const texte = resumeSeuils(normaliserSeuils(c.seuils));
    const nom = c.referentiel_nom ?? "Référentiel non renseigné";
    const cle = `${nom}|${texte}`;
    const existant = baremes.get(cle);
    if (existant) existant.nombre += 1;
    else baremes.set(cle, { nom, texte, nombre: 1 });
  }
  if (baremes.size === 0) return null;
  return h(View, { style: { marginTop: 8 } },
    h(Text, { style: { fontSize: 7, color: "#6b7280", marginBottom: 2 } },
      "Barèmes appliqués sur la période (figés à la mesure — modifier un référentiel ne réévalue aucun contrôle déjà enregistré) :"),
    ...[...baremes.values()].map((b) =>
      h(Text, { key: `${b.nom}-${b.texte}`, style: { fontSize: 7, color: "#374151" } },
        `• ${b.nom} — ${b.texte} (${b.nombre} contrôle${b.nombre > 1 ? "s" : ""})`)),
  );
}

function SectionBains({ bains }: { bains: ControleBain[] }) {
  return h(View, {},
    h(Text, { style: styles.section }, `Registre des bains (${bains.length})`),
    bains.length === 0
      ? h(Text, { style: styles.vide }, "Aucun relevé de bain sur cette période.")
      : h(View, {},
          h(View, { style: styles.thead },
            h(Text, { style: [styles.th, { width: "14%" }] }, "Date"),
            h(Text, { style: [styles.th, { width: "18%" }] }, "Bain"),
            h(Text, { style: [styles.th, { width: "10%" }] }, "pH"),
            h(Text, { style: [styles.th, { width: "12%" }] }, "Conduct."),
            h(Text, { style: [styles.th, { width: "10%" }] }, "Temp."),
            h(Text, { style: [styles.th, { width: "10%" }] }, "Titrage"),
            h(Text, { style: [styles.th, { width: "10%" }] }, "Verdict"),
            h(Text, { style: [styles.th, { width: "16%" }] }, "Action"),
          ),
          ...bains.map((b) => h(View, { key: b.id, style: styles.tr, wrap: false },
            h(Text, { style: { width: "14%" } }, dateHeure(b.mesure_at)),
            h(Text, { style: { width: "18%" } }, `${libelleBain(b.bain)}${b.renouvele ? " (renouvelé)" : ""}`),
            h(Text, { style: { width: "10%" } }, b.ph != null ? String(b.ph) : "—"),
            h(Text, { style: { width: "12%" } }, b.conductivite != null ? String(b.conductivite) : "—"),
            h(Text, { style: { width: "10%" } }, b.temperature != null ? String(b.temperature) : "—"),
            h(Text, { style: { width: "10%" } }, b.titrage != null ? String(b.titrage) : "—"),
            h(View, { style: { width: "10%" } }, h(VerdictTexte, { conforme: b.conforme })),
            h(Text, { style: { width: "16%" } }, b.action ?? "—"),
          )),
        ),
  );
}

function SectionNonConformites({ ncs }: { ncs: NonConformite[] }) {
  const coutTotal = ncs.reduce((s, nc) => s + (nc.cout_estime ?? 0), 0);
  return h(View, {},
    h(Text, { style: styles.section }, `Non-conformités (${ncs.length}${coutTotal ? ` · ${eurPdf(coutTotal)}` : ""})`),
    ncs.length === 0
      ? h(Text, { style: styles.vide }, "Aucune non-conformité déclarée sur cette période.")
      : h(View, {},
          h(View, { style: styles.thead },
            h(Text, { style: [styles.th, { width: "12%" }] }, "Date"),
            h(Text, { style: [styles.th, { width: "18%" }] }, "Défaut"),
            h(Text, { style: [styles.th, { width: "16%" }] }, "Projet"),
            h(Text, { style: [styles.th, { width: "14%" }] }, "Cause"),
            h(Text, { style: [styles.th, { width: "26%" }] }, "Action corrective"),
            h(Text, { style: [styles.th, { width: "8%" }] }, "Coût"),
            h(Text, { style: [styles.th, { width: "6%" }] }, "Statut"),
          ),
          ...ncs.map((nc) => h(View, { key: nc.id, style: styles.tr, wrap: false },
            h(Text, { style: { width: "12%" } }, dateHeure(nc.detectee_at)),
            h(Text, { style: { width: "18%" } }, nc.defaut),
            h(Text, { style: { width: "16%" } }, nc.projets ? `${nc.projets.numero ? `${nc.projets.numero} — ` : ""}${nc.projets.nom}` : "—"),
            h(Text, { style: { width: "14%" } }, nc.cause ?? "—"),
            h(Text, { style: { width: "26%" } }, nc.action_corrective ?? "—"),
            h(Text, { style: { width: "8%" } }, nc.cout_estime != null ? eurPdf(nc.cout_estime) : "—"),
            h(Text, { style: { width: "6%" } }, nc.rebut ? "Rebut" : nc.retouche ? "Retouche" : "—"),
          )),
        ),
  );
}

/** Le pied commun, aux marges de ce registre (paddingBottom 50, paddingHorizontal 34). */
function PiedPage() {
  return h(PiedPageCommun, { gauche: "Propulsé par Thermogestion", bas: 20, marge: 34 });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erreurPdf("Vous devez être connecté pour accéder à ce document.", 401);

  const { data: membre } = await supabase.from("users").select("atelier_id").maybeSingle();
  if (!membre) return erreurPdf("Atelier introuvable.", 404);

  // Le droit de formule est rejoué ici : une route PDF ne passe pas par le trigger d'écriture,
  // et une URL connue ne doit pas ouvrir un document que la formule ne couvre pas.
  if (!(await capaciteServeur(supabase, "qualite"))) return erreurPdf(messageCapacite("qualite"), 402);

  const url = new URL(req.url);
  const debutMois = new Date();
  debutMois.setDate(1);
  const from = url.searchParams.get("from") || debutMois.toISOString().slice(0, 10);
  const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return erreurPdf("Période invalide : indiquez des dates au format AAAA-MM-JJ.", 400);
  }

  const { data: atelier } = await supabase.from("ateliers").select("*").eq("id", membre.atelier_id).maybeSingle();
  if (!atelier) return erreurPdf("Atelier introuvable.", 404);

  const debut = `${from}T00:00:00`;
  const fin = `${to}T23:59:59`;

  const [controlesRes, bainsRes, ncsRes, certifsRes, refRes] = await Promise.all([
    supabase.from("controles").select("*, projets(numero, nom), users:operateur_id(nom)").gte("mesure_at", debut).lte("mesure_at", fin).order("mesure_at"),
    supabase.from("controles_bains").select("*").gte("mesure_at", debut).lte("mesure_at", fin).order("mesure_at"),
    supabase.from("non_conformites").select("*, projets(numero, nom)").gte("detectee_at", debut).lte("detectee_at", fin).order("detectee_at"),
    supabase.from("certifications").select("*").eq("actif", true),
    supabase.from("referentiels_qualite").select("*").eq("actif", true).order("par_defaut", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const controles = (controlesRes.data as unknown as Controle[]) ?? [];
  const bains = (bainsRes.data as unknown as ControleBain[]) ?? [];
  const ncs = (ncsRes.data as unknown as NonConformite[]) ?? [];

  const typesPratiques = typesControleActifs(refRes.data as ReferentielQualite | null);

  // Une certification expirée n'a pas sa place en en-tête d'un registre présenté à un auditeur.
  const certification = certificationDeReference((certifsRes.data as unknown as Certification[]) ?? []);
  const label = labelOpposable(certification?.label ?? null, certification?.expire_le ?? null);

  const logo = await chargerLogo(atelier.logo_url);
  const atelierTyped = atelier as Atelier;

  const document = h(Document,
    { title: `Registre des contrôles qualité — ${from} au ${to}`, author: atelierTyped.nom, creator: "Thermogestion", producer: "Thermogestion" },
    h(Page, { size: "A4", style: styles.page },
      h(Entete, { atelier: atelierTyped, logo, from, to, label }),
      h(Text, { style: styles.titre }, "Registre des contrôles qualité"),
      // Le sous-titre annonçait les six contrôles quoi qu'il arrive : sur un atelier qui n'en
      // pratique que deux, il promettait à l'auditeur des mesures introuvables plus bas.
      h(Text, { style: styles.sousTitre },
        `${typesPratiques.map((t) => TYPE_CONTROLE_LABEL[t].toLowerCase()).join(", ")}, ` +
          "bains de prétraitement et non-conformités."),
      h(SectionControles, { controles }),
      h(SectionSeuils, { controles }),
      h(SectionBains, { bains }),
      h(SectionNonConformites, { ncs }),
      h(PiedPage, {}),
    ),
  );

  return reponsePdf(document, `registre-controles-${from}-au-${to}`);
}
