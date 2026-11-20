"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { useToast } from "@/components/Toast";
import { Button, Select, Spinner, Textarea } from "@/components/ui";
import { cn, dateFr } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import { ACCEPT_PHOTO, cheminPhoto, refusDePhoto } from "@/lib/stockage";
import {
  INSTRUMENT_POUR_TYPE,
  INSTRUMENT_TYPE_LABEL,
  POLYMERISATION_LABEL,
  TYPE_CONTROLE_LABEL,
  calculerConformite,
  etalonnageInfo,
  seuilsDuReferentiel,
  suggestionDefautNC,
  typesControleActifs,
  valeursParDefaut,
  verdictClass,
  verdictLabel,
} from "@/lib/qualite";
import type { ControleType, Instrument, ReferentielQualite } from "@/lib/types";

type ProjetOption = { id: string; numero: string | null; nom: string };
type FourneeOption = { id: string; numero: string | null; date_prevue: string | null };

/**
 * Grand bouton numérique : les inputs standards sont trop petits à toucher avec des gants, et le
 * clavier natif iOS/Android pour `inputMode="decimal"` reste la saisie la plus rapide sur mobile.
 */
function ChampNombre({ label, unite, value, onChange }: { label: string; unite?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}{unite ? ` (${unite})` : ""}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-lg font-semibold focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </label>
  );
}

export default function ControleForm({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [atelierId, setAtelierId] = useState("");
  const [operateurId, setOperateurId] = useState("");
  const [projets, setProjets] = useState<ProjetOption[]>([]);
  const [fournees, setFournees] = useState<FourneeOption[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [referentiels, setReferentiels] = useState<ReferentielQualite[]>([]);

  const [type, setType] = useState<ControleType>("epaisseur");
  const [projetId, setProjetId] = useState("");
  const [fourneeId, setFourneeId] = useState("");
  const [referentielId, setReferentielId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [valeurs, setValeurs] = useState<Record<string, unknown>>(valeursParDefaut("epaisseur"));
  const [commentaire, setCommentaire] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Dernier contrôle enregistré : sert à proposer la déclaration de non-conformité juste après coup.
  const [dernier, setDernier] = useState<{ conforme: boolean | null; projetId: string; defautSuggere: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: prs }, { data: frs }, { data: instr }, { data: refs }] = await Promise.all([
        supabase.from("users").select("id, atelier_id").single(),
        supabase.from("projets").select("id, numero, nom").order("created_at", { ascending: false }).limit(200),
        supabase.from("fournees").select("id, numero, date_prevue").order("date_prevue", { ascending: false }).limit(100),
        supabase.from("instruments").select("*").eq("actif", true).order("nom"),
        supabase.from("referentiels_qualite").select("*").eq("actif", true).order("par_defaut", { ascending: false }).order("nom"),
      ]);
      if (membre) { setAtelierId(membre.atelier_id); setOperateurId(membre.id); }
      setProjets((prs as ProjetOption[]) ?? []);
      setFournees((frs as FourneeOption[]) ?? []);
      setInstruments((instr as Instrument[]) ?? []);
      const liste = (refs as ReferentielQualite[]) ?? [];
      setReferentiels(liste);
      setReferentielId((liste.find((r) => r.par_defaut) ?? liste[0])?.id ?? "");
      setLoading(false);
    })();
  }, [supabase]);

  function changerType(t: ControleType) {
    setType(t);
    setValeurs(valeursParDefaut(t));
    setInstrumentId("");
  }

  // Changer de référentiel peut retirer le type sélectionné : on retombe sur le premier proposé
  // plutôt que de laisser un formulaire dont la base refusera l'enregistrement.
  useEffect(() => {
    const r = referentiels.find((x) => x.id === referentielId) ?? null;
    const proposes = typesControleActifs(r);
    if (proposes.length > 0 && !proposes.includes(type)) changerType(proposes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referentielId, referentiels]);

  const referentiel = referentiels.find((r) => r.id === referentielId) ?? null;
  const seuils = seuilsDuReferentiel(referentiel);
  // Un type que l'atelier ne pratique pas ne doit pas encombrer la saisie — et la base le refuse
  // de toute façon (`TYPE_CONTROLE_DESACTIVE`).
  const typesProposes = typesControleActifs(referentiel);
  const conforme = calculerConformite(type, valeurs, seuils);
  const instrumentAttendu = INSTRUMENT_POUR_TYPE[type];
  const instrumentsFiltres = instrumentAttendu
    ? [...instruments].sort((a, b) => (a.type === instrumentAttendu ? -1 : 0) - (b.type === instrumentAttendu ? -1 : 0))
    : instruments;
  const instrumentChoisi = instruments.find((i) => i.id === instrumentId);
  const etalonnage = instrumentChoisi ? etalonnageInfo(instrumentChoisi.dernier_etalonnage, instrumentChoisi.periodicite_mois) : null;

  async function submit() {
    setSaving(true);
    setError("");
    const payload = {
      atelier_id: atelierId,
      projet_id: projetId || null,
      fournee_id: fourneeId || null,
      type,
      valeurs,
      conforme,
      commentaire: commentaire.trim() || null,
      instrument_id: instrumentId || null,
      operateur_id: operateurId || null,
      referentiel_id: referentielId || null,
    };
    const { data, error: err } = await supabase.from("controles").insert(payload).select("id").single();
    if (err) { const msg = errorFr(err); setError(msg); toast(msg, "error"); setSaving(false); return; }
    const controleId = data.id as string;

    if (photoFile) {
      const path = cheminPhoto(atelierId, "controles", [controleId], photoFile.name);
      // Le contrôle est déjà enregistré : l'échec de la photo ne doit pas l'annuler, mais il ne
      // doit pas non plus passer inaperçu — un registre d'audit sans sa preuve visuelle.
      if (await ecrire(supabase.storage.from("photos").upload(path, photoFile), toast)) {
        await ecrire(supabase.from("controles").update({ photo_url: path }).eq("id", controleId), toast);
      }
    }

    toast(conforme === false ? "Contrôle enregistré — non conforme" : "Contrôle enregistré", conforme === false ? "error" : "success");
    setDernier({ conforme, projetId, defautSuggere: suggestionDefautNC(type, valeurs) });

    // Le type, le projet, la fournée et l'instrument restent en place : sur une même fournée,
    // l'opérateur enchaîne souvent plusieurs mesures du même genre pièce après pièce.
    setValeurs(valeursParDefaut(type));
    setCommentaire("");
    setPhotoFile(null);
    setPhotoPreview(null);
    onSaved?.();
    setSaving(false);
  }

  if (loading) return <Spinner />;

  const cibleRenseignee = Boolean(projetId || fourneeId);
  const peutEnregistrer = (conforme !== null || (type === "aspect" && valeurs.conforme != null)) && cibleRenseignee;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-1 block text-xs font-medium text-gray-600">Type de contrôle</span>
        <div className="grid grid-cols-3 gap-2">
          {typesProposes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changerType(t)}
              aria-pressed={type === t}
              className={cn(
                "min-h-[44px] rounded-lg border px-2 py-3 text-xs font-medium",
                type === t ? "border-brand bg-brand-light text-brand-dark" : "border-gray-300 bg-white text-gray-700",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              )}
            >
              {TYPE_CONTROLE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Verdict affiché en direct, avant même l'enregistrement : c'est le cœur de la saisie rapide. */}
      <div className={cn("rounded-lg px-3 py-2 text-center text-sm font-semibold", verdictClass(conforme))}>
        {verdictLabel(conforme)}
      </div>

      {/* Le barème qui rend le verdict est affiché à l'opérateur : sans lui, « non conforme » ne
          veut rien dire, et un atelier agréé sur une autre classe ne saurait pas ce qu'on lui oppose. */}
      {referentiels.length > 1 ? (
        <div>
          <Select label="Référentiel appliqué" value={referentielId} onChange={(e) => setReferentielId(e.target.value)}>
            {referentiels.map((r) => (
              <option key={r.id} value={r.id}>{r.nom}{r.par_defaut ? " (par défaut)" : ""}</option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-gray-500">
            <Link href="/qualite/referentiels" className="underline">Régler les seuils</Link>
          </p>
        </div>
      ) : (
        <p className="-mt-2 text-xs text-gray-500">
          Référentiel : <span className="font-medium">{referentiel?.nom ?? "Qualicoat classe 1"}</span> —{" "}
          <Link href="/qualite/referentiels" className="underline">régler les seuils</Link>
        </p>
      )}

      {type === "epaisseur" && (
        <div className="grid grid-cols-3 gap-2">
          <ChampNombre label="Mini" unite="µm" value={String(valeurs.mini ?? "")} onChange={(v) => setValeurs({ ...valeurs, mini: v })} />
          <ChampNombre label="Maxi" unite="µm" value={String(valeurs.maxi ?? "")} onChange={(v) => setValeurs({ ...valeurs, maxi: v })} />
          <ChampNombre label="Moyenne" unite="µm" value={String(valeurs.moyenne ?? "")} onChange={(v) => setValeurs({ ...valeurs, moyenne: v })} />
        </div>
      )}
      {type === "epaisseur" && (
        <p className="-mt-2 text-xs text-gray-500">
          Verdict sur le mini : au moins {seuils.epaisseur_mini_um} µm en tout point
          {seuils.epaisseur_maxi_um != null ? `, et pas plus de ${seuils.epaisseur_maxi_um} µm sur le point le plus épais` : ""}.
        </p>
      )}

      {type === "brillance" && (
        <div className="grid grid-cols-2 gap-2">
          <ChampNombre label="Mesurée à 60°" unite="UB" value={String(valeurs.valeur ?? "")} onChange={(v) => setValeurs({ ...valeurs, valeur: v })} />
          <ChampNombre label="Nominale (teinte)" unite="UB" value={String(valeurs.nominale ?? "")} onChange={(v) => setValeurs({ ...valeurs, nominale: v })} />
        </div>
      )}
      {type === "brillance" && (
        <p className="-mt-2 text-xs text-gray-500">Tolérance ± {seuils.brillance_tolerance_ub} UB autour de la valeur nominale de la teinte.</p>
      )}

      {type === "adherence" && (
        <Select label={`Classe ISO 2409 (0 à 5, conforme jusqu'à classe ${seuils.adherence_classe_max})`} value={String(valeurs.classe ?? "")} onChange={(e) => setValeurs({ ...valeurs, classe: e.target.value })}>
          <option value="">— Choisir —</option>
          {[0, 1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>Classe {c}{c === 0 ? " (parfait)" : ""}</option>)}
        </Select>
      )}

      {type === "buchholz" && (
        <>
          <ChampNombre label="Indentation Buchholz" value={String(valeurs.valeur ?? "")} onChange={(v) => setValeurs({ ...valeurs, valeur: v })} />
          <p className="-mt-2 text-xs text-gray-500">Seuil attendu : ≥ {seuils.buchholz_min}.</p>
        </>
      )}

      {type === "polymerisation" && (
        <Select label="Résultat au test solvant (MEK)" value={String(valeurs.resultat ?? "")} onChange={(e) => setValeurs({ ...valeurs, resultat: e.target.value })}>
          <option value="">— Choisir —</option>
          {Object.entries(POLYMERISATION_LABEL).map(([code, lib]) => <option key={code} value={code}>{lib}</option>)}
        </Select>
      )}

      {type === "aspect" && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setValeurs({ ...valeurs, conforme: true, defaut: null })}
              aria-pressed={valeurs.conforme === true}
              className={cn("min-h-[44px] rounded-lg border py-3 text-sm font-medium", valeurs.conforme === true ? "border-success bg-success-50 text-success-dark" : "border-gray-300 bg-white text-gray-700", "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand")}
            >
              Conforme
            </button>
            <button
              type="button"
              onClick={() => setValeurs({ ...valeurs, conforme: false })}
              aria-pressed={valeurs.conforme === false}
              className={cn("min-h-[44px] rounded-lg border py-3 text-sm font-medium", valeurs.conforme === false ? "border-danger bg-danger-50 text-danger-dark" : "border-gray-300 bg-white text-gray-700", "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand")}
            >
              Non conforme
            </button>
          </div>
          {valeurs.conforme === false && (
            <Select label="Défaut constaté" value={String(valeurs.defaut ?? "")} onChange={(e) => setValeurs({ ...valeurs, defaut: e.target.value })}>
              <option value="">— Choisir —</option>
              {["Peau d'orange", "Cratères (silicone)", "Piqûres / dégazage (fonte, alu poreux)", "Coulure", "Faïençage", "Cage de Faraday (angles rentrants)", "Pollution / mélange époxy-polyester", "Marque de crochet", "Différence de teinte entre lots", "Autre"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          )}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-gray-600">Rattacher à un projet OU à une fournée (l&apos;un des deux est obligatoire)</p>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Projet" value={projetId} onChange={(e) => setProjetId(e.target.value)}>
            <option value="">— Aucun —</option>
            {projets.map((p) => <option key={p.id} value={p.id}>{p.numero ? `${p.numero} — ` : ""}{p.nom}</option>)}
          </Select>
          <Select label="Fournée" value={fourneeId} onChange={(e) => setFourneeId(e.target.value)}>
            <option value="">— Aucune —</option>
            {/* D4 (recette navigateur, vague 2) : `date_prevue` est une date ISO (« 2026-08-19 »)
                — affichée brute, elle ne se lit pas comme les autres dates de l'écran. */}
            {fournees.map((f) => <option key={f.id} value={f.id}>{f.numero ?? "Fournée"}{f.date_prevue ? ` — ${dateFr(f.date_prevue)}` : ""}</option>)}
          </Select>
        </div>
        {!cibleRenseignee && (
          <p className="mt-1 text-xs text-amber-600">Choisissez un projet ou une fournée pour pouvoir enregistrer.</p>
        )}
      </div>

      {instrumentAttendu && (
        <>
          <Select label="Instrument utilisé (facultatif)" value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
            <option value="">— Non renseigné —</option>
            {instrumentsFiltres.map((i) => (
              <option key={i.id} value={i.id}>{i.nom}{i.type ? ` (${INSTRUMENT_TYPE_LABEL[i.type] ?? i.type})` : ""}</option>
            ))}
          </Select>
          {etalonnage && etalonnage.statut === "retard" && (
            <p className="-mt-2 text-xs font-medium text-red-600">
              <AlertTriangle size={14} aria-hidden className="mr-1 inline-block align-[-2px]" /> Étalonnage en retard sur cet instrument — la mesure est enregistrée, mais signalez-le avant le prochain audit.
            </p>
          )}
          {etalonnage && etalonnage.statut === "bientot" && (
            <p className="-mt-2 text-xs text-amber-600">Étalonnage à programmer dans {etalonnage.joursRestants} j.</p>
          )}
        </>
      )}

      <Textarea label="Commentaire (facultatif)" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />

      <div>
        {photoPreview ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <button type="button" className="min-h-[44px] rounded px-1 text-xs font-medium text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}>Retirer</button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-3 text-sm text-gray-600">
            <Camera size={18} aria-hidden /> Photo (facultatif)
            <input
              type="file"
              accept={ACCEPT_PHOTO}
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                // Le refus est prononcé ici, pas au moment de l'envoi : le contrôle est enregistré
                // AVANT la photo, et découvrir à ce moment-là que le fichier est refusé laisserait
                // un contrôle sans sa preuve visuelle sans que l'opérateur ait rien à corriger.
                const refus = refusDePhoto(f);
                if (refus) { toast(refus, "error"); e.target.value = ""; return; }
                setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f));
              }}
            />
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button taille="xl" loading={saving} disabled={!peutEnregistrer} onClick={submit}>
        {saving ? "Enregistrement…" : "Enregistrer le contrôle"}
      </Button>

      {dernier && dernier.conforme === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <p className="mb-2 text-red-800">Ce contrôle est non conforme. Déclarer une non-conformité liée pour tracer la cause et l&apos;action corrective ?</p>
          <Button
            variant="danger"
            onClick={() => {
              const params = new URLSearchParams();
              if (dernier.projetId) params.set("projet_id", dernier.projetId);
              if (dernier.defautSuggere) params.set("defaut", dernier.defautSuggere);
              router.push(`/qualite/non-conformites?${params.toString()}`);
            }}
          >
            Déclarer une non-conformité
          </Button>
        </div>
      )}
    </div>
  );
}
