"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import ConfirmModal from "@/components/Modal";
import FourneeComposer from "@/components/FourneeComposer";
import { Badge, Button, Card, EnregistrementEnCours, Input, PageTitle, Spinner, Textarea } from "@/components/ui";
import { useEcriture } from "@/components/useEcriture";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { dateFr, eur, nombreFr } from "@/lib/utils";
import { blocageLancement, cycleLabel, poudreLabel, surfaceTotale } from "@/lib/fournees";
import { coutFournee, MESSAGE_CONSO_MANQUANTE, surfaceEmbarquee } from "@/lib/energie";
import { STATUS_FOURNEE } from "@/lib/types";
import { useTitreDocument } from "@/lib/titre";
import type { AtelierFour, Fournee, ProjetPretFournee } from "@/lib/types";

const ETAPES_CANDIDATES = ["poudrage", "cuisson"];

type FourneeProjetJoin = { id: string; projet_id: string; surface_m2: number | null; position: number | null; projets: ProjetPretFournee };

export default function FourneeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [fournee, setFournee] = useState<(Fournee & { id: string; users?: { nom: string | null } | null }) | null>(null);
  const [composition, setComposition] = useState<FourneeProjetJoin[]>([]);
  const [disponibles, setDisponibles] = useState<ProjetPretFournee[]>([]);
  const [atelier, setAtelier] = useState<AtelierFour | null>(null);
  const [busy, setBusy] = useState(false);
  const { enCours: ecritureEnCours, suivre } = useEcriture();
  const [confirmAnnuler, setConfirmAnnuler] = useState(false);
  // Amélioration n°2 (07/09/2026) — remplace l'ancienne confirmation « Lancer quand même » : le
  // dépassement de capacité est désormais bloqué EN BASE (`trg_fournee_capacite`, migration 71),
  // pas seulement signalé. Cette case n'est qu'un reflet de la dérogation que la base acceptera —
  // elle ne dispense de rien : la base referait le même calcul même si cette case mentait.
  const [derogationCapacite, setDerogationCapacite] = useState(false);
  const [tempRelevee, setTempRelevee] = useState("");
  const [consoKwh, setConsoKwh] = useState("");

  async function reload() {
    const [{ data: f }, { data: fp }, { data: a }] = await Promise.all([
      supabase.from("fournees").select("*, poudres(reference, ral), users:operateur_id(nom)").eq("id", id).single(),
      supabase
        .from("fournee_projets")
        .select("id, projet_id, surface_m2, position, projets(numero, nom, surface_m2, poudre_id, etape_courante, date_promise, clients(nom), poudres(reference, ral, temp_cuisson, duree_cuisson_min))")
        .eq("fournee_id", id)
        .order("position", { ascending: true }),
      supabase.from("ateliers").select("*").maybeSingle(),
    ]);
    const fournee0 = f as unknown as (Fournee & { id: string; users?: { nom: string | null } | null }) | null;
    setFournee(fournee0);
    const comp = (fp as unknown as FourneeProjetJoin[]) ?? [];
    setComposition(comp);
    setAtelier(a as AtelierFour | null);
    if (!consoKwh && (a as AtelierFour | null)?.four_conso_kwh) setConsoKwh(String((a as AtelierFour).four_conso_kwh));

    if (fournee0?.statut === "planifiee") {
      const [{ data: prets }, { data: dejaPris }] = await Promise.all([
        supabase
          .from("projets")
          .select("id, numero, nom, surface_m2, poudre_id, etape_courante, date_promise, clients(nom), poudres(reference, ral, temp_cuisson, duree_cuisson_min)")
          .in("etape_courante", ETAPES_CANDIDATES)
          .neq("status", "livre")
          .neq("status", "annule")
          .order("date_promise", { ascending: true, nullsFirst: false }),
        supabase.from("fournee_projets").select("projet_id, fournee_id, fournees(statut)"),
      ]);
      // Les projets déjà dans CETTE fournée sont exclus au même titre que ceux réservés par une
      // autre : sans ça, ils restaient proposés à l'ajout et pouvaient être comptés deux fois.
      const prisIds = new Set([
        ...comp.map((c) => c.projet_id),
        ...(((dejaPris as unknown as { projet_id: string; fournee_id: string; fournees: { statut: string } | null }[]) ?? []))
          .filter((r) => r.fournee_id !== id && r.fournees && ["planifiee", "en_cours"].includes(r.fournees.statut))
          .map((r) => r.projet_id),
      ]);
      setDisponibles((((prets as unknown as ProjetPretFournee[]) ?? [])).filter((p) => !prisIds.has(p.id)));
    } else {
      setDisponibles([]);
    }
  }
  useEffect(() => {
    reload();
    // Navigation d'une fournée à une autre sans démontage du composant (même route dynamique) :
    // la case de dérogation ne doit pas survivre au changement de fournée.
    setDerogationCapacite(false);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

  useTitreDocument(fournee?.numero ?? "Fournée");

  if (!fournee) return <Spinner />;

  const selection: ProjetPretFournee[] = composition.map((c) => c.projets);
  // Écart consigne / relevé : c'est le seul chiffre qu'un auditeur regarde sur une fiche de cuisson.
  const ecart =
    fournee.temp_consigne != null && fournee.temp_relevee != null
      ? Math.round((Number(fournee.temp_relevee) - Number(fournee.temp_consigne)) * 10) / 10
      : null;

  // Coût énergétique de la fournée. Les kWh étaient relevés depuis juillet sans jamais être
  // convertis : le réglage `prix_kwh` ne servait qu'au prix de revient du projet.
  const cout = coutFournee({
    consoKwh: fournee.conso_kwh,
    prixKwh: atelier?.prix_kwh,
    surfaceM2: surfaceEmbarquee(composition),
    capaciteM2: atelier?.four_capacite_m2,
  });

  /**
   * Composition de la fournée. `suivre` rend l'attente visible et, surtout, `FourneeComposer`
   * passe en lecture seule le temps de l'aller-retour : deux appuis rapides sur « Ajouter »
   * insèrent deux lignes pour le même projet, parce que `composition.length` (la position)
   * n'a pas encore bougé au second appui.
   */
  async function ajouter(p: ProjetPretFournee) {
    if (!fournee) return;
    await suivre(async () => {
      const { error } = await supabase.from("fournee_projets").insert({ atelier_id: fournee.atelier_id, fournee_id: id, projet_id: p.id, surface_m2: p.surface_m2, position: composition.length });
      if (error) toast(errorFr(error), "error"); else await reload();
    });
  }
  async function retirer(p: ProjetPretFournee) {
    await suivre(async () => {
      const { error } = await supabase.from("fournee_projets").delete().eq("fournee_id", id).eq("projet_id", p.id);
      if (error) toast(errorFr(error), "error"); else await reload();
    });
  }

  // Fait avancer chaque projet d'une étape (poudrage → cuisson au lancement, cuisson → contrôle
  // à la clôture) : c'est la RPC `avancer_etape` existante qui décrémente le stock de poudre au
  // bon moment (à la validation de l'étape cuisson), pas cette page. On ne fait avancer que les
  // projets réellement à l'étape attendue : un projet déjà passé à la cuisson par un autre biais
  // (donnée historique antérieure aux fournées) ne doit pas voir sa cuisson validée prématurément.
  async function avancerComposition(etapeAttendue: string) {
    for (const c of composition) {
      if (c.projets.etape_courante !== etapeAttendue) continue;
      // Le chronométrage est porté par `avancer_etape` : le second appel qui vivait ici était le
      // troisième endroit du code à devoir y penser.
      // Un projet qui n'avance pas doit se voir : sans ça, la fournée se lance et la moitié des
      // pièces reste à l'étape précédente sans que personne ne l'apprenne.
      await ecrire(supabase.rpc("avancer_etape", { p_projet_id: c.projet_id }), toast);
    }
  }

  const surfaceComposition = surfaceTotale(composition);
  // Amélioration n°2 — le même calcul que `trg_fournee_capacite` (migration 71), rejoué ici pour
  // l'écran : le bouton se désactive avec sa raison affichée (modèle : bouton « Générer » du
  // certificat de conformité). C'est un affichage, pas une garde — la base refuse la même chose
  // de toute façon, y compris depuis la console.
  const blocage = blocageLancement(surfaceComposition, atelier?.four_capacite_m2);
  const lancementBloque = blocage.bloquant && !derogationCapacite;

  async function lancer() {
    if (composition.length === 0 || lancementBloque) return;
    setBusy(true);
    await avancerComposition("poudrage");
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("fournees")
      .update({
        statut: "en_cours",
        demarree_at: new Date().toISOString(),
        operateur_id: me.user?.id ?? null,
        // La base ne trace une dérogation que si la capacité est réellement dépassée
        // (`trg_fournee_capacite`) : cocher la case sans dépassement ne trace rien.
        derogation_capacite: derogationCapacite,
      })
      .eq("id", id);
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Fournée lancée — projets passés en cuisson");
    setDerogationCapacite(false);
    await reload();
  }

  async function cloturer() {
    if (!tempRelevee || !consoKwh) return;
    setBusy(true);
    await avancerComposition("cuisson");
    const { error } = await supabase
      .from("fournees")
      .update({ statut: "terminee", terminee_at: new Date().toISOString(), temp_relevee: Number(tempRelevee), conso_kwh: Number(consoKwh) })
      .eq("id", id);
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    // Le message ne promet un coût que s'il y en a un : sans prix du kWh, rien n'est chiffré.
    toast(atelier?.prix_kwh ? "Fournée clôturée — coût énergie calculé" : "Fournée clôturée");
    await reload();
  }

  async function annuler() {
    setBusy(true);
    const { error } = await supabase.from("fournees").update({ statut: "annulee" }).eq("id", id);
    setBusy(false);
    setConfirmAnnuler(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Fournée annulée");
    await reload();
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Badge tone={STATUS_FOURNEE[fournee.statut].ton}>{STATUS_FOURNEE[fournee.statut].label}</Badge>}>
        {fournee.numero ?? "Fournée"}
      </PageTitle>

      <Card className="flex flex-col gap-2">
        <div className="text-sm">
          <span className="font-semibold">{poudreLabel(fournee.poudres)}</span>
          <span className="text-gray-500"> · {fournee.temp_consigne != null && fournee.duree_min != null ? cycleLabel({ reference: "", ral: null, temp_cuisson: fournee.temp_consigne, duree_cuisson_min: fournee.duree_min }) : "cycle non défini"}</span>
        </div>
        {fournee.statut === "planifiee" ? (
          <>
            <Input
              label="Date prévue" type="date" defaultValue={fournee.date_prevue ?? ""} disabled={ecritureEnCours}
              onBlur={(e) => suivre(() => ecrire(supabase.from("fournees").update({ date_prevue: e.target.value || null }).eq("id", id), toast))}
            />
            <EnregistrementEnCours actif={ecritureEnCours} />
          </>
        ) : (
          <div className="text-xs text-gray-500">
            {fournee.date_prevue && <>Prévue le {dateFr(fournee.date_prevue)} · </>}
            {fournee.demarree_at && <>Lancée le {dateFr(fournee.demarree_at)} · </>}
            {fournee.terminee_at && <>Clôturée le {dateFr(fournee.terminee_at)}</>}
          </div>
        )}
      </Card>

      <FourneeComposer
        disponibles={disponibles}
        selection={selection}
        capaciteM2={atelier?.four_capacite_m2}
        onAdd={ajouter}
        onRemove={retirer}
        readOnly={fournee.statut !== "planifiee" || ecritureEnCours}
      />

      {fournee.statut === "planifiee" && (
        <div className="flex flex-col gap-2">
          {/* Amélioration n°2 — au-delà de la capacité déclarée, le bouton se désactive avec sa
              raison affichée (même motif que le bouton « Générer » du certificat de conformité) :
              le vrai refus vient de `trg_fournee_capacite` en base, ceci n'en est que le reflet. */}
          {blocage.bloquant && (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
              <div className="font-semibold">Four au-delà de sa capacité</div>
              <p className="mt-1">{blocage.message}</p>
              <label className="mt-2 flex items-center gap-2 py-1 font-medium">
                <input
                  type="checkbox"
                  checked={derogationCapacite}
                  onChange={(e) => setDerogationCapacite(e.target.checked)}
                  className="h-4 w-4 rounded border-red-300"
                />
                Je déroge : le four peut réellement contenir davantage que sa fiche ne l&apos;indique, je lance quand même.
              </label>
            </div>
          )}
          {!blocage.capaciteConnue && composition.length > 0 && (
            <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">{blocage.message}</p>
          )}
          <Button
            onClick={lancer}
            loading={busy}
            disabled={composition.length === 0 || lancementBloque}
            title={lancementBloque ? blocage.message ?? undefined : undefined}
            taille="xl"
            className="flex items-center justify-center gap-2"
          >
            <Flame size={18} aria-hidden /> Lancer la fournée
          </Button>
          <p className="text-xs text-gray-500">
            {composition.length > 1 ? `Fait passer les ${composition.length} projets` : "Fait passer le projet"} à l&apos;étape Cuisson.
          </p>
          <Button variant="ghost" onClick={() => setConfirmAnnuler(true)} disabled={busy}>Annuler cette fournée</Button>
        </div>
      )}

      {fournee.statut === "en_cours" && (
        <Card className="flex flex-col gap-3">
          <div className="text-sm font-semibold">Clôturer la fournée</div>
          <p className="text-xs text-gray-500">
            La température relevée et la consommation alimentent la traçabilité et le calcul du coût
            énergétique de chaque projet (réparti au prorata entre les projets de la fournée).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Température relevée (°C) *" type="number" step="1" value={tempRelevee} onChange={(e) => setTempRelevee(e.target.value)} placeholder={fournee.temp_consigne != null ? String(fournee.temp_consigne) : ""} />
            <Input label="Consommation (kWh) *" type="number" step="0.01" value={consoKwh} onChange={(e) => setConsoKwh(e.target.value)} />
          </div>
          <Textarea
            label="Note (facultatif)" defaultValue={fournee.note ?? ""} disabled={ecritureEnCours}
            onBlur={(e) => suivre(() => ecrire(supabase.from("fournees").update({ note: e.target.value || null }).eq("id", id), toast))}
          />
          <EnregistrementEnCours actif={ecritureEnCours} />
          <Button onClick={cloturer} loading={busy} disabled={!tempRelevee || !consoKwh} taille="xl" className="flex items-center justify-center gap-2">
            <Check size={18} aria-hidden /> Clôturer et passer au contrôle
          </Button>
        </Card>
      )}

      {fournee.statut === "terminee" && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Relevé de cuisson</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-gray-500">Consigne</div><div className="font-medium">{fournee.temp_consigne != null ? `${nombreFr(fournee.temp_consigne)} °C` : "—"}</div></div>
            <div>
              <div className="text-xs text-gray-500">Relevée</div>
              <div className={`font-medium ${ecart != null && Math.abs(ecart) > 5 ? "text-amber-700" : ""}`}>
                {fournee.temp_relevee != null ? `${nombreFr(fournee.temp_relevee)} °C` : "—"}
                {ecart != null && <span className="ml-1 text-xs font-normal">({ecart > 0 ? "+" : ""}{nombreFr(ecart)} °C)</span>}
              </div>
            </div>
            <div><div className="text-xs text-gray-500">Durée</div><div className="font-medium">{fournee.duree_min ?? "—"} min</div></div>
            <div><div className="text-xs text-gray-500">Consommation</div><div className="font-medium">{fournee.conso_kwh != null ? `${nombreFr(fournee.conso_kwh)} kWh` : "—"}</div></div>
            <div className="col-span-2"><div className="text-xs text-gray-500">Opérateur</div><div className="font-medium">{fournee.users?.nom ?? "Non renseigné"}</div></div>
          </div>
          {ecart != null && Math.abs(ecart) > 5 && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Écart de plus de 5 °C avec la consigne : à justifier si un auditeur reprend cette fournée.
            </p>
          )}

          {/* Coût énergétique : chiffré ou expliqué, jamais approximé. */}
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="mb-2 text-sm font-semibold">Coût énergétique</div>
            {cout.manque === "prix_kwh" ? (
              <p className="text-xs text-amber-800">
                Prix du kWh non renseigné : le coût de cette fournée ne peut pas être chiffré.
                Renseignez-le dans <Link href="/reglages" className="font-medium underline">Réglages → Atelier</Link>,
                champ « Prix du kWh (€) » — il figure sur votre facture d&apos;électricité.
              </p>
            ) : cout.manque === "conso_kwh" ? (
              <p className="text-xs text-gray-500">{MESSAGE_CONSO_MANQUANTE}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Coût de la fournée</div>
                    <div className="font-medium">{eur(cout.coutEur)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Au m² embarqué</div>
                    <div className={`font-medium ${cout.fourneeCreuse ? "text-amber-700" : ""}`}>
                      {cout.coutM2Eur != null ? `${eur(cout.coutM2Eur)} / m²` : "—"}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {nombreFr(cout.surfaceM2)} m² embarqués
                  {cout.tauxRemplissagePct != null && <> — four rempli à {cout.tauxRemplissagePct} %</>}.
                  {cout.coutM2Eur == null && " Aucune surface saisie sur les projets de cette fournée : le coût au m² ne peut pas être calculé."}
                </p>
                {cout.fourneeCreuse && cout.coutM2PleinEur != null && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Four à moitié vide : un four consomme presque autant à vide qu&apos;à plein.
                    À pleine charge, le même cycle serait revenu à {eur(cout.coutM2PleinEur)} / m²,
                    soit {eur(cout.surcoutVideEur)} de chauffe payée pour du vide.
                  </p>
                )}
              </>
            )}
          </div>

          {fournee.note && <p className="mt-2 text-xs text-gray-500">{fournee.note}</p>}
          <a
            href={`/api/pdf/fournee/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium"
          >
            Fiche de cuisson (PDF)
          </a>
        </Card>
      )}

      <div className="flex flex-col gap-1">
        {composition.map((c) => (
          <Link key={c.id} href={`/projets/${c.projet_id}`} className="text-xs text-brand underline">
            Voir le prix de revient — {c.projets.numero ?? c.projets.nom}
          </Link>
        ))}
      </div>

      <ConfirmModal
        open={confirmAnnuler}
        title="Annuler cette fournée ?"
        message="Les projets redeviennent disponibles pour une autre fournée. Cette action est réversible en recomposant une nouvelle fournée."
        confirmLabel="Annuler la fournée"
        danger
        busy={busy}
        onConfirm={annuler}
        onCancel={() => setConfirmAnnuler(false)}
      />
    </div>
  );
}
