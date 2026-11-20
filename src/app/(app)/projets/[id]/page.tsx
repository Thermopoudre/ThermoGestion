"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, FileText, Play, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { useToast } from "@/components/Toast";
import PartagerLien from "@/components/PartagerLien";
import QrCode from "@/components/QrCode";
import PointageBouton from "@/components/PointageBouton";
import RevientProjet from "@/components/RevientProjet";
import CertificatProjet from "@/components/CertificatProjet";
import DateRealiste from "@/components/DateRealiste";
import PiecesJointes from "@/components/PiecesJointes";
import Historique from "@/components/Historique";
import BoutonCorbeille from "@/components/BoutonCorbeille";
import { Badge, Button, Card, EnregistrementEnCours, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { useEcriture } from "@/components/useEcriture";
import { useTitreDocument } from "@/lib/titre";
import { STATUS_PROJET, dateFr, nombreFr } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import { ACCEPT_PHOTO, cheminPhoto, refusDePhoto } from "@/lib/stockage";
import type { Poudre, Projet, TempsEtape } from "@/lib/types";

type ProjetFiche = Projet;

function dureeFr(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export default function ProjetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [projet, setProjet] = useState<ProjetFiche | null>(null);
  const [poudres, setPoudres] = useState<Poudre[]>([]);
  const [temps, setTemps] = useState<TempsEtape[]>([]);
  const [photos, setPhotos] = useState<{ id: string; url: string; etape_code: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const { enCours: ecritureEnCours, suivre } = useEcriture();
  const [showQr, setShowQr] = useState(false);
  // Contrôlé plutôt que `defaultValue` : la proposition de date réaliste doit pouvoir écrire
  // dans le champ, ce qu'un champ non contrôlé ne permettrait pas.
  const [datePromise, setDatePromise] = useState("");

  async function reload() {
    const [{ data: p }, { data: pd }] = await Promise.all([
      supabase.from("projets").select("*, clients(nom), poudres(reference, ral)").eq("id", id).single(),
      supabase.from("poudres").select("*").eq("actif", true).order("reference"),
    ]);
    const proj = p as unknown as ProjetFiche;
    setProjet(proj);
    setDatePromise(proj.date_promise ?? "");
    setPoudres((pd as Poudre[]) ?? []);

    const { data: t } = await supabase.from("temps_etapes").select("*").eq("projet_id", id).order("debut");
    setTemps((t as TempsEtape[]) ?? []);

    const { data: phs } = await supabase.from("photos").select("id, storage_path, etape_code").eq("projet_id", id).order("created_at");
    if (phs?.length) {
      // Une seule signature pour toute la série (`createSignedUrls`, au pluriel) : la version au
      // singulier coûtait un aller-retour réseau par photo, et ça se voit sur la 4G d'un atelier.
      const { data: signees } = await supabase.storage
        .from("photos")
        .createSignedUrls(phs.map((ph) => ph.storage_path), 3600);
      const parChemin = new Map((signees ?? []).map((s) => [s.path ?? "", s.signedUrl]));
      setPhotos(
        phs
          .map((ph) => ({ id: ph.id, url: parChemin.get(ph.storage_path) ?? "", etape_code: ph.etape_code }))
          .filter((s) => s.url),
      );
    } else setPhotos([]);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useTitreDocument(projet ? `${projet.numero} — ${projet.clients?.nom ?? ""}` : null);

  if (!projet) return <Spinner />;

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${projet.public_token}` : "";
  const scanUrl = typeof window !== "undefined" ? `${window.location.origin}/scan/${projet.qr_token}` : "";
  const nextEtape = projet.etapes.find((e) => !e.done_at);

  // Temps cumulé par étape : matière première du prix de revient. Une ligne encore ouverte est
  // comptée au temps écoulé, exactement comme le fait la vue `projet_temps_cout` — sans quoi cette
  // carte et celle du coût de main d'œuvre affichaient deux chiffres contradictoires.
  const minutesParEtape = new Map<string, number>();
  // Temps reçu d'un chronométrage partagé : à afficher, sinon personne ne comprend pourquoi une
  // pièce porte 45 min quand la cabine a tourné 60.
  const partagesParEtape = new Map<string, { minutes: number; lot: number; pct: number }[]>();
  let enCoursCode: string | null = null;
  for (const t of temps) {
    const min = t.minutes ?? (t.fin ? 0 : (Date.now() - new Date(t.debut).getTime()) / 60000);
    minutesParEtape.set(t.etape_code, (minutesParEtape.get(t.etape_code) ?? 0) + min);
    if (t.groupe_id && t.minutes_groupe != null) {
      const liste = partagesParEtape.get(t.etape_code) ?? [];
      liste.push({ minutes: t.minutes ?? 0, lot: Number(t.minutes_groupe), pct: Number(t.part_pct ?? 0) });
      partagesParEtape.set(t.etape_code, liste);
    }
    if (!t.fin) enCoursCode = t.etape_code;
  }
  const totalMinutes = [...minutesParEtape.values()].reduce((s, m) => s + m, 0);

  /**
   * Écriture ponctuelle depuis un champ : rechargement seulement si la base a bien pris.
   *
   * `suivre` ajoute ce qui manquait : l'attente est visible et les champs du bloc sont figés le
   * temps de l'aller-retour. Sur 4G, choisir une poudre ne produisait rien pendant deux secondes,
   * et l'opérateur en rechoisissait une autre par-dessus.
   */
  async function maj(patch: Record<string, unknown>, rechargerApres = false) {
    return suivre(async () => {
      const ok = await ecrire(supabase.from("projets").update(patch).eq("id", id), toast);
      if (ok && rechargerApres) await reload();
      return ok;
    });
  }

  async function avancer() {
    setBusy(true);
    // `avancer_etape` clôt le chrono de l'étape validée et ouvre celui de la suivante : plus
    // aucun appel séparé à ne pas oublier, ni ici ni sur le scan.
    const libelle = nextEtape?.libelle ?? "l'étape";
    if (await ecrire(supabase.rpc("avancer_etape", { p_projet_id: id }), toast, `${libelle} : validé`)) await reload();
    setBusy(false);
  }

  async function demarrer() {
    setBusy(true);
    const libelle = nextEtape?.libelle ?? "l'étape";
    if (await ecrire(supabase.rpc("demarrer_etape", { p_projet: id }), toast, `${libelle} : chrono lancé`)) await reload();
    setBusy(false);
  }

  async function uploadPhoto(file: File) {
    setBusy(true);
    const refus = refusDePhoto(file);
    if (refus) { toast(refus, "error"); setBusy(false); return; }
    // Le dossier `projets` est le deuxième segment, et ce n'est pas du rangement : c'est lui que
    // lit la policy de `storage.objects` pour savoir qui a le droit d'ouvrir le fichier. Le chemin
    // était auparavant `<atelier>/<projet>/…`, sans dossier — la base ne pouvait donc pas
    // distinguer une photo de chantier d'un contrat client, et ne distinguait rien du tout.
    const path = cheminPhoto(projet!.atelier_id, "projets", [id], file.name);
    // Le dépôt dans le bucket et l'insertion de la ligne sont deux écritures distinctes : la
    // seconde échouait en silence, et la photo restait dans le stockage sans jamais réapparaître
    // à l'écran. C'est l'origine des cinq réceptions sans photo en base.
    if (await ecrire(supabase.storage.from("photos").upload(path, file), toast)) {
      const ok = await ecrire(
        supabase.from("photos").insert({ atelier_id: projet!.atelier_id, projet_id: id, etape_code: projet!.etape_courante, storage_path: path, taille_bytes: file.size }),
        toast,
        "Photo ajoutée",
      );
      if (ok) await reload();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Badge tone={STATUS_PROJET[projet.status].ton}>{STATUS_PROJET[projet.status].label}</Badge>}>
        {projet.numero}
      </PageTitle>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">{projet.clients?.nom} · {projet.nom}</div>
        {/* C3 — la commande qui revient tous les mois chez le même client. La RPC ne reprend que
            la trame des étapes : le nouveau chantier repart à zéro, il ne naît pas déjà cuit. */}
        <Button
          variant="ghost"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const { data, error } = await supabase.rpc("dupliquer_projet", { p_id: id });
            setBusy(false);
            if (error) { toast(errorFr(error), "error"); return; }
            toast("Chantier dupliqué — étapes remises à zéro");
            window.location.href = `/projets/${data as string}`;
          }}
        >
          <span className="flex items-center gap-1.5"><Copy size={15} aria-hidden /> Dupliquer</span>
        </Button>
      </div>

      {nextEtape && (
        // Tant qu'aucun chrono ne tourne, « Démarrer » est le bouton principal : c'est celui qu'il
        // faut presser. L'inverse — « Valider » en teal, plus gros, au-dessus d'une explication de
        // trois lignes — faisait presser le gros avec des gants et perdait le temps passé.
        <div className="flex flex-col gap-2">
          {!enCoursCode ? (
            <>
              <Button onClick={demarrer} loading={busy} taille="xl" className="flex items-center justify-center gap-2">
                <Play size={18} aria-hidden /> Démarrer : {nextEtape.libelle}
              </Button>
              <Button variant="secondary" onClick={avancer} loading={busy} taille="xl" className="flex items-center justify-center gap-2">
                <Check size={18} aria-hidden /> Valider sans chronométrer
              </Button>
              <p className="text-xs text-gray-500">
                Valider sans démarrer enregistre l&apos;étape sans temps passé : le prix de revient
                ne comptera pas la main d&apos;œuvre de cette étape.
              </p>
            </>
          ) : (
            <Button onClick={avancer} loading={busy} taille="xl" className="flex items-center justify-center gap-2">
              <Check size={18} aria-hidden /> Valider : {nextEtape.libelle}
            </Button>
          )}
        </div>
      )}

      {/* Remonté juste sous les boutons d'étape : c'est l'action d'atelier, et elle vivait
          derrière douze blocs — plusieurs écrans de défilement sur un téléphone. */}
      <Card className="flex flex-col items-center gap-2">
        <button
          className="rounded text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={() => setShowQr(!showQr)}
          aria-expanded={showQr}
        >
          {showQr ? "Masquer" : "Afficher"} le QR atelier (scan = étape suivante)
        </button>
        {showQr && <QrCode value={scanUrl} />}
        {showQr && <p className="text-center text-xs text-gray-500">Chaque scan par un membre de l&apos;équipe valide l&apos;étape en cours.</p>}
        {/* B5 — la fiche promise ici même (« Imprimez ce QR sur la fiche suiveuse ») mais dont la
            route n'existait pas : sans papier sur la pièce, personne ne scanne. */}
        <a
          href={`/api/pdf/etiquette/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800 transition duration-150 ease-out hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <FileText size={16} aria-hidden /> Fiche suiveuse A5 (à imprimer)
        </a>
      </Card>

      <Card>
        <div className="mb-2 text-sm font-semibold">Étapes</div>
        <ol className="flex flex-col gap-1.5">
          {projet.etapes.map((e) => (
            <li key={e.code} className="flex items-center gap-2 text-sm">
              <span className={e.done_at ? "text-green-600" : e.code === nextEtape?.code ? "text-brand" : "text-gray-300"}>
                {e.done_at ? "●" : e.code === nextEtape?.code ? "◉" : "○"}
              </span>
              <span className={e.done_at ? "text-gray-500 line-through" : e.code === nextEtape?.code ? "font-semibold" : "text-gray-500"}>{e.libelle}</span>
              {e.done_at && <span className="ml-auto text-xs text-gray-500">{dateFr(e.done_at)}</span>}
            </li>
          ))}
        </ol>
      </Card>

      {minutesParEtape.size > 0 && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Temps passé</div>
          {projet.etapes
            .filter((e) => minutesParEtape.has(e.code))
            .map((e) => (
              <div key={e.code} className="border-b border-gray-50 py-1.5 text-sm last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">
                    {e.libelle}
                    {e.code === enCoursCode && <span className="ml-2 text-xs font-medium text-brand">en cours</span>}
                  </span>
                  <span className="font-medium">{dureeFr(minutesParEtape.get(e.code)!)}</span>
                </div>
                {(partagesParEtape.get(e.code) ?? []).map((p, i) => (
                  <div key={i} className="text-xs text-gray-500">
                    dont {dureeFr(p.minutes)} au titre d&apos;un poste partagé : {dureeFr(p.lot)} relevés pour le lot,{" "}
                    {nombreFr(p.pct)} % imputés à ce projet (au prorata des surfaces).
                  </div>
                ))}
              </div>
            ))}
          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span>{dureeFr(totalMinutes)}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Chronométré automatiquement au démarrage et à la validation de chaque étape (scan ou bouton).
            Un chrono en cours est déjà compté, ici comme dans le prix de revient.
          </p>
        </Card>
      )}

      <PointageBouton projetId={id} />

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Poudre &amp; production</div>
          <EnregistrementEnCours actif={ecritureEnCours} />
        </div>
        <Select label="Poudre" value={projet.poudre_id ?? ""} disabled={ecritureEnCours} onChange={(e) => maj({ poudre_id: e.target.value || null }, true)}>
          <option value="">— Aucune —</option>
          {poudres.map((p) => <option key={p.id} value={p.id}>{p.reference}{p.ral ? ` (RAL ${p.ral})` : ""} — {nombreFr(p.stock_kg, 3)} kg</option>)}
        </Select>
        <div className="grid grid-cols-3 gap-2">
          <Input label="Surface m²" type="number" step="0.01" defaultValue={projet.surface_m2 ?? ""} disabled={ecritureEnCours} onBlur={(e) => maj({ surface_m2: e.target.value === "" ? null : Number(e.target.value) })} />
          <Input label="Couches" type="number" min="1" defaultValue={projet.couches} disabled={ecritureEnCours} onBlur={(e) => maj({ couches: Number(e.target.value) || 1 })} />
          <Input label="Promis le" type="date" value={datePromise} disabled={ecritureEnCours} onChange={(e) => setDatePromise(e.target.value)} onBlur={(e) => maj({ date_promise: e.target.value || null })} />
        </div>
        <DateRealiste
          projetId={id}
          surfaceM2={projet.surface_m2}
          datePromise={datePromise || null}
          onChoisir={async (d) => { setDatePromise(d); await maj({ date_promise: d }); }}
        />
        {/* Amélioration n°9 (07/09/2026) — ce champ n'a de sens que sur une rénovation de jantes.
            Avant, il s'affichait (replié, mais présent) sur TOUT projet, y compris un chantier de
            profilés de fenêtre (PR-2026-0021) : confusion sur l'écran de travail quotidien.
            Conditionné à `type_piece`, sur le même motif que `client.type === "particulier"` pour
            les mentions B2C — mais un champ déjà rempli ne doit JAMAIS disparaître (une pièce
            reclassée après coup, ou `type_piece` encore à null le temps du backfill, ne doit pas
            faire perdre une teinte déjà saisie) : `type_piece === "autre"` ET champ vide, c'est le
            seul cas où le bloc se cache. */}
        {(projet.type_piece !== "autre" || !!projet.teinte_origine) && (
          <details open={!!projet.teinte_origine} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-gray-600 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              <ChevronRight size={14} aria-hidden className="text-gray-400 transition-transform duration-150 ease-out group-open:rotate-90" />
              Teinte d&apos;origine constructeur (rénovation de jantes)
            </summary>
            <div className="mt-2">
              <Input placeholder="ex : Gris Nardo BMW" defaultValue={projet.teinte_origine ?? ""} disabled={ecritureEnCours} onBlur={(e) => maj({ teinte_origine: e.target.value || null })} />
            </div>
          </details>
        )}
        {projet.poudre_conso_kg && <p className="text-xs text-gray-500">Conso poudre décomptée : {nombreFr(projet.poudre_conso_kg, 3)} kg</p>}
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Photos</div>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((ph) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={ph.id} src={ph.url} alt="" className="aspect-square rounded-lg object-cover" />
          ))}
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-2xl text-gray-500">
            +
            <input type="file" accept={ACCEPT_PHOTO} capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          </label>
        </div>
      </Card>

      {/* Le plan coté, le cahier des charges, la fiche technique de la poudre imposée par le
          client : jusqu'ici ces pièces vivaient dans une boîte mail, et le jour du litige elles
          n'étaient nulle part dans le dossier. */}
      <PiecesJointes
        entite="projet"
        entiteId={id}
        atelierId={projet.atelier_id}
        aide="Plan coté, cahier des charges, fiche technique imposée par le client, procès-verbal de contrôle : les documents du dossier, à côté des photos."
      />

      <Card className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Suivi client</div>
        <PartagerLien
          url={publicUrl}
          titre={`Suivi ${projet.numero ?? ""}`}
          texte={`Suivez l'avancement de vos pièces : ${projet.nom}`}
          libelleCopie="Copier le lien de suivi"
        />
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Facturation</div>
        {/* Depuis un projet livré, il n'existait aucun chemin vers sa facture : il fallait
            repartir de /factures et retrouver le devis à la main. */}
        <Link
          href={projet.devis_id ? `/factures/new?devis=${projet.devis_id}` : "/factures/new"}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800 transition duration-150 ease-out hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Receipt size={16} aria-hidden /> Facturer ce projet
        </Link>
        {!projet.devis_id && (
          <p className="text-xs text-gray-500">Ce projet n&apos;a pas de devis d&apos;origine : la facture partira d&apos;une page vierge.</p>
        )}
      </Card>

      <RevientProjet projetId={id} />

      <CertificatProjet projetId={id} />

      {/* Une date promise repoussée, une teinte changée en cours de route, une surface corrigée
          après coup : trois motifs de désaccord, aucun n'avait de trace avant ce panneau. */}
      <Historique entite="projets" entiteId={id} />

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
        <div className="text-sm font-semibold text-gray-700">Projet créé par erreur</div>
        <p className="text-xs text-gray-500">
          Il quitte les listes, le planning et le lien de suivi du client. La base refusera si une
          facture a déjà été émise dessus : ce qui a été facturé doit rester lisible.
        </p>
        <div>
          <BoutonCorbeille entite="projet" id={id} libelle={projet.numero ?? projet.nom} />
        </div>
      </div>
    </div>
  );
}
