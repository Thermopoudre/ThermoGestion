"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Upload, Download, FileText, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Empty, Input, PageTitle, Spinner, Textarea } from "@/components/ui";
import { Filtres, Pagination, useListePaginee } from "@/components/Pagination";
import { useEtatUrl } from "@/lib/urlState";
import { useTitreDocument } from "@/lib/titre";
import { useToast } from "@/components/Toast";
import { ecrire } from "@/lib/db";
import { errorFr } from "@/lib/errors";
import { dateFr, eur, nombreFr } from "@/lib/utils";
import { usePlan } from "@/components/PlanProvider";
import {
  FORMAT_SOURCE_FACTURE_RECUE,
  PROVENANCE_FACTURE_RECUE,
  STATUT_FACTURE_RECUE,
  type FactureRecue,
  type StatutFactureRecue,
} from "@/lib/types";
import { ingererFactureRecue } from "@/lib/reception";

/**
 * `/factures-recues` — amélioration n°1 (07/09/2026).
 *
 * Ce que cet écran fait, et ce qu'il ne fait pas :
 *  - il enregistre et affiche les factures fournisseurs REÇUES, avec extraction automatique quand
 *    le fournisseur envoie un Factur-X, un CII ou un UBL, et saisie manuelle sinon (« PDF simple ») ;
 *  - il ne relie PAS ces factures à la comptabilité fournisseur (achats, rapprochement bancaire) :
 *    hors périmètre de Thermogestion, comme les autres écrans du produit ;
 *  - il ne parle à AUCUNE plateforme agréée : le dépôt est manuel, la case « plateforme agréée »
 *    du barème de `provenance` est prête pour le jour où Alexis aura choisi son partenaire, mais
 *    rien ici n'appelle de service externe (voir `src/lib/reception/index.ts`).
 */

const COLONNES =
  "id, provenance, format_source, statut, motif_refus, fournisseur_nom, fournisseur_siren, " +
  "fournisseur_tva, numero, date_emission, date_echeance, total_ht, total_tva, total_ttc, devise, " +
  "xml_brut, storage_path_pdf, nom_fichier_origine, taille_octets, created_at, updated_at";

const FILTRES = [
  { valeur: "a_traiter", libelle: "À traiter" },
  { valeur: "traitee", libelle: "Traitées" },
  { valeur: "refusee", libelle: "Refusées" },
  { valeur: "tous", libelle: "Toutes" },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];
const VALEURS_FILTRE: readonly Filtre[] = FILTRES.map((f) => f.valeur);

const DUREE_URL_SIGNEE_S = 300;

function montantFr(montant: number | null, devise: string): string {
  if (montant == null) return "—";
  return devise === "EUR" ? eur(montant) : `${nombreFr(montant, 2, 2)} ${devise}`;
}

/** Ce que l'atelier peut compléter ou corriger à la main sur une fiche. */
type Brouillon = {
  fournisseur_nom: string;
  numero: string;
  date_emission: string;
  date_echeance: string;
  total_ht: string;
  total_tva: string;
  total_ttc: string;
};

function versBrouillon(f: FactureRecue): Brouillon {
  return {
    fournisseur_nom: f.fournisseur_nom ?? "",
    numero: f.numero ?? "",
    date_emission: f.date_emission ?? "",
    date_echeance: f.date_echeance ?? "",
    total_ht: f.total_ht != null ? String(f.total_ht) : "",
    total_tva: f.total_tva != null ? String(f.total_tva) : "",
    total_ttc: f.total_ttc != null ? String(f.total_ttc) : "",
  };
}

export default function FacturesRecuesContenu() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const { commercial, role } = usePlan();
  const [filtre, setFiltre] = useEtatUrl<Filtre>("filtre", "a_traiter", VALEURS_FILTRE);
  const [atelierId, setAtelierId] = useState("");
  const [depose, setDepose] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [motifRefus, setMotifRefus] = useState("");
  const [busyLigne, setBusyLigne] = useState(false);
  const [liensPdf, setLiensPdf] = useState<Record<string, string>>({});
  const inputFichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("ateliers").select("id").maybeSingle().then(({ data }) => setAtelierId((data as { id: string } | null)?.id ?? ""));
  }, [supabase]);

  const charger = useCallback((de: number, a: number) => {
    let requete = supabase.from("factures_recues").select(COLONNES, { count: "exact" });
    if (filtre !== "tous") requete = requete.eq("statut", filtre);
    return requete.order("created_at", { ascending: false }).range(de, a);
  }, [supabase, filtre]);

  const liste = useListePaginee<FactureRecue>(charger, filtre);

  useTitreDocument("Factures reçues");

  // ── Dépôt (glisser-déposer et bouton), owner/bureau seulement ────────────────

  async function deposer(fichiers: FileList | File[]) {
    if (!atelierId) return;
    setEnvoi(true);
    let ajoutees = 0;
    for (const fichier of Array.from(fichiers)) {
      try {
        const octets = new Uint8Array(await fichier.arrayBuffer());
        const { data: moi } = await supabase.auth.getUser();
        const resultat = await ingererFactureRecue({
          supabase,
          atelierId,
          provenance: "depot_manuel",
          document: { nom: fichier.name, mime: fichier.type, octets },
          utilisateurId: moi.user?.id ?? null,
        });
        ajoutees += 1;
        for (const a of resultat.avertissements) toast(a, "error");
      } catch (e) {
        // `errorFr` et non `e.message` : l'ingestion relaie l'erreur de la base telle quelle, si
        // bien que le visiteur de la démonstration lisait « DEMO_LECTURE_SEULE » — un code de
        // trigger, le seul écran du produit à en montrer un. Tous les refus connus (démonstration,
        // essai terminé, borne de taille, RLS) ont déjà leur phrase française dans `errors.ts` ;
        // ce qui reste inconnu retombe sur la phrase générique d'`errorFr`, qui rend toujours du
        // français — inutile de prévoir un repli ici.
        toast(errorFr(e), "error");
      }
    }
    setEnvoi(false);
    setDepose(false);
    if (ajoutees > 0) {
      toast(ajoutees > 1 ? `${ajoutees} factures déposées` : "Facture déposée");
      liste.recharger();
    }
  }

  // ── Détail d'une fiche ─────────────────────────────────────────────────────

  async function ouvrir(f: FactureRecue) {
    if (ouverte === f.id) { setOuverte(null); return; }
    setOuverte(f.id);
    setBrouillon(versBrouillon(f));
    setMotifRefus(f.motif_refus ?? "");
    if (f.storage_path_pdf && !liensPdf[f.id]) {
      const { data } = await supabase.storage.from("documents").createSignedUrl(f.storage_path_pdf, DUREE_URL_SIGNEE_S);
      if (data?.signedUrl) setLiensPdf((l) => ({ ...l, [f.id]: data.signedUrl }));
    }
  }

  function telechargerXml(f: FactureRecue) {
    if (!f.xml_brut) return;
    const blob = new Blob([f.xml_brut], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${f.numero ?? f.id}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function enregistrer(f: FactureRecue) {
    if (!brouillon) return;
    setBusyLigne(true);
    const ok = await ecrire(
      supabase.from("factures_recues").update({
        fournisseur_nom: brouillon.fournisseur_nom.trim() || null,
        numero: brouillon.numero.trim() || null,
        date_emission: brouillon.date_emission || null,
        date_echeance: brouillon.date_echeance || null,
        total_ht: brouillon.total_ht.trim() === "" ? null : Number(brouillon.total_ht.replace(",", ".")),
        total_tva: brouillon.total_tva.trim() === "" ? null : Number(brouillon.total_tva.replace(",", ".")),
        total_ttc: brouillon.total_ttc.trim() === "" ? null : Number(brouillon.total_ttc.replace(",", ".")),
      }).eq("id", f.id),
      toast,
      "Fiche enregistrée",
    );
    setBusyLigne(false);
    if (ok) liste.recharger();
  }

  async function changerStatut(f: FactureRecue, statut: StatutFactureRecue, motif?: string) {
    setBusyLigne(true);
    const ok = await ecrire(
      supabase.from("factures_recues").update({ statut, motif_refus: statut === "refusee" ? (motif?.trim() || "Non précisé") : null }).eq("id", f.id),
      toast,
      statut === "traitee" ? "Marquée traitée" : statut === "refusee" ? "Facture refusée" : "Remise à traiter",
    );
    setBusyLigne(false);
    if (ok) { setOuverte(null); liste.recharger(); }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Factures reçues</PageTitle>

      {/* Amélioration n°1 : une phrase, toujours visible, plutôt qu'un renvoi vers une page d'aide
          que personne n'ouvre avant d'en avoir besoin. */}
      <Card className="border-brand/30 bg-brand-light/40 text-sm text-gray-700">
        Depuis le 1ᵉʳ septembre 2026, toute entreprise assujettie à la TVA doit pouvoir recevoir ses
        factures fournisseurs sous forme électronique. Le partenaire (une Plateforme Agréée) n&apos;est
        pas encore branché : en attendant, déposez ici le PDF ou le XML reçu par mail — Thermogestion
        lit automatiquement les factures au format Factur-X, CII ou UBL, et vous laisse compléter les
        autres à la main.
      </Card>

      <Filtres label="Filtrer les factures reçues" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />

      {commercial && (
        <Card
          className={depose ? "border-brand bg-brand-light/30" : undefined}
          ariaLabel="Déposer une facture reçue"
        >
          <div
            onDragOver={(e) => { e.preventDefault(); setDepose(true); }}
            onDragLeave={() => setDepose(false)}
            onDrop={(e) => { e.preventDefault(); setDepose(false); if (e.dataTransfer.files.length) deposer(e.dataTransfer.files); }}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-center"
          >
            <Upload size={22} aria-hidden className="text-gray-400" />
            <p className="text-sm text-gray-600">
              Glissez-déposez le PDF ou le XML d&apos;une facture fournisseur, ou
            </p>
            <Button variant="secondary" onClick={() => inputFichier.current?.click()} disabled={envoi || !atelierId} loading={envoi}>
              Choisir un fichier
            </Button>
            <input
              ref={inputFichier}
              type="file"
              accept="application/pdf,.pdf,text/xml,application/xml,.xml"
              multiple
              className="sr-only"
              onChange={(e) => { if (e.target.files?.length) deposer(e.target.files); e.target.value = ""; }}
            />
          </div>
        </Card>
      )}

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}

      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty icon={<Inbox size={28} />}>
          {role === "comptable"
            ? "Aucune facture reçue pour l'instant."
            : filtre === "a_traiter"
              ? "Aucune facture à traiter pour l'instant : déposez ici le prochain PDF ou XML reçu d'un fournisseur, dès son arrivée."
              : "Aucune facture avec ce filtre."}
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {liste.lignes.map((f) => (
            <Card key={f.id} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => ouvrir(f)}
                className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{f.fournisseur_nom ?? "Fournisseur non identifié"} {f.numero ? `· ${f.numero}` : ""}</div>
                  <div className="text-xs text-gray-500">
                    {dateFr(f.date_emission)} · {montantFr(f.total_ttc, f.devise)} TTC · {FORMAT_SOURCE_FACTURE_RECUE[f.format_source]}
                    {f.provenance === "plateforme_agreee" ? ` · ${PROVENANCE_FACTURE_RECUE[f.provenance]}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUT_FACTURE_RECUE[f.statut].ton}>{STATUT_FACTURE_RECUE[f.statut].label}</Badge>
                  {ouverte === f.id ? <EyeOff size={18} aria-hidden className="text-gray-400" /> : <Eye size={18} aria-hidden className="text-gray-400" />}
                </div>
              </button>

              {ouverte === f.id && brouillon && (
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                  {f.motif_refus && f.statut === "refusee" && (
                    <p className="rounded-lg bg-danger-light p-2 text-xs text-danger-dark">Motif du refus : {f.motif_refus}</p>
                  )}

                  {f.storage_path_pdf && (
                    liensPdf[f.id]
                      ? <iframe src={liensPdf[f.id]} title={`Aperçu de la facture ${f.numero ?? f.id}`} className="h-72 w-full rounded-lg border border-gray-200" />
                      : <Spinner taille="sm" />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {f.storage_path_pdf && liensPdf[f.id] && (
                      <a href={liensPdf[f.id]} download={f.nom_fichier_origine ?? "facture.pdf"} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-50">
                        <Download size={16} aria-hidden /> Télécharger le PDF
                      </a>
                    )}
                    {f.xml_brut && (
                      <Button variant="secondary" onClick={() => telechargerXml(f)}>
                        <span className="inline-flex items-center gap-1.5"><FileText size={16} aria-hidden /> Télécharger le XML</span>
                      </Button>
                    )}
                    {!f.storage_path_pdf && !f.xml_brut && (
                      <p className="text-xs text-gray-500">Aucun document conservé pour cette fiche.</p>
                    )}
                  </div>

                  {commercial && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input label="Fournisseur" value={brouillon.fournisseur_nom} onChange={(e) => setBrouillon((b) => b && { ...b, fournisseur_nom: e.target.value })} />
                        <Input label="Numéro de facture" value={brouillon.numero} onChange={(e) => setBrouillon((b) => b && { ...b, numero: e.target.value })} />
                        <Input label="Date d'émission" type="date" value={brouillon.date_emission} onChange={(e) => setBrouillon((b) => b && { ...b, date_emission: e.target.value })} />
                        <Input label="Date d'échéance" type="date" value={brouillon.date_echeance} onChange={(e) => setBrouillon((b) => b && { ...b, date_echeance: e.target.value })} />
                        <Input label="Total HT" type="number" value={brouillon.total_ht} onChange={(e) => setBrouillon((b) => b && { ...b, total_ht: e.target.value })} />
                        <Input label="Total TVA" type="number" value={brouillon.total_tva} onChange={(e) => setBrouillon((b) => b && { ...b, total_tva: e.target.value })} />
                        <Input label="Total TTC" type="number" value={brouillon.total_ttc} onChange={(e) => setBrouillon((b) => b && { ...b, total_ttc: e.target.value })} />
                      </div>
                      <Button variant="secondary" onClick={() => enregistrer(f)} disabled={busyLigne} loading={busyLigne}>Enregistrer les corrections</Button>

                      {f.statut === "refusee" ? (
                        <Button variant="secondary" onClick={() => changerStatut(f, "a_traiter")} disabled={busyLigne}>Remettre à traiter</Button>
                      ) : (
                        <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                          {f.statut === "a_traiter" && (
                            <Button onClick={() => changerStatut(f, "traitee")} disabled={busyLigne}>Marquer traitée</Button>
                          )}
                          <Textarea
                            label="Motif de refus (doublon, mauvais destinataire…)"
                            value={motifRefus}
                            onChange={(e) => setMotifRefus(e.target.value)}
                          />
                          <Button variant="danger" onClick={() => changerStatut(f, "refusee", motifRefus)} disabled={busyLigne}>Refuser cette facture</Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="factures reçues" />
    </div>
  );
}
