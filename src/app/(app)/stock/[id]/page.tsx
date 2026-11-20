"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSeuilDlu } from "@/components/AlertesProvider";
import { joursAvantDlu } from "@/lib/alertes";
import PoudreForm from "@/components/PoudreForm";
import LotForm from "@/components/LotForm";
import { Badge, Button, Card, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { dateFr, eur, nombreFr, qteConseillee } from "@/lib/utils";
import { lienReappro } from "@/lib/thermopoudre/fiche";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import type { Poudre, PoudreLot } from "@/lib/types";

type Mouvement = {
  id: string;
  type: string;
  delta_kg: number;
  stock_apres_kg: number;
  note: string | null;
  created_at: string;
  lot_numero: string | null;
  lot_fournisseur: string | null;
  dlu: string | null;
};

const TYPES: Record<string, string> = { reception: "Réception", conso_auto: "Conso projet", pesee: "Pesée", ajustement: "Ajustement" };

/** Historique : la DLU d'une vieille réception peut encore être transportée dans la note, avant l'existence des vrais lots. */
const MARQUE_DLU = /DLU\s+(\d{4}-\d{2}-\d{2})/;
function dluDe(m: { dlu: string | null; note: string | null }) {
  return m.dlu ?? m.note?.match(MARQUE_DLU)?.[1] ?? null;
}
function noteAffichable(note: string | null) {
  const reste = (note ?? "").replace(MARQUE_DLU, "").replace(/^[\s·-]+|[\s·-]+$/g, "");
  return reste || null;
}


export default function PoudrePage({ params }: { params: Promise<{ id: string }> }) {
  // Réglage d'atelier, plus une constante recopiée : voir src/lib/alertes.ts.
  const SEUIL_DLU_JOURS = useSeuilDlu();
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [poudre, setPoudre] = useState<Poudre | null>(null);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [lots, setLots] = useState<PoudreLot[]>([]);
  const [theoriqueKg, setTheoriqueKg] = useState(0);
  const [sumPeseeDeltas, setSumPeseeDeltas] = useState(0);
  const [nbPesees, setNbPesees] = useState(0);
  const [mvType, setMvType] = useState("pesee");
  const [mvKg, setMvKg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [commandeEnCours, setCommandeEnCours] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function commander() {
    if (!poudre) return;
    setCommandeEnCours(true);
    const stock = Number(poudre.stock_kg);
    const { error: err } = await supabase.rpc("ajouter_au_panier_poudre", {
      p_poudre_id: poudre.id,
      p_quantite_kg: qteConseillee(poudre, stock),
    });
    setCommandeEnCours(false);
    if (err) { toast(errorFr(err), "error"); return; }
    router.push("/commandes");
  }

  async function reload() {
    const [{ data: p }, { data: m }, { data: l }, { data: projetsPoudre }, { data: pesees }] = await Promise.all([
      supabase.from("poudres").select("*, poudre_couts(prix_kg)").eq("id", id).single(),
      supabase.from("stock_mouvements").select("*").eq("poudre_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("poudre_lots").select("*, poudre_lot_couts(prix_kg)").eq("poudre_id", id).order("dlu", { ascending: true, nullsFirst: false }),
      supabase.from("projets").select("poudre_conso_kg").eq("poudre_id", id).not("poudre_conso_kg", "is", null),
      supabase.from("stock_mouvements").select("delta_kg").eq("poudre_id", id).eq("type", "pesee"),
    ]);
    setPoudre(p as Poudre);
    setMouvements((m as Mouvement[]) ?? []);
    setLots((l as PoudreLot[]) ?? []);
    setTheoriqueKg((projetsPoudre ?? []).reduce((s, x) => s + Number(x.poudre_conso_kg ?? 0), 0));
    setSumPeseeDeltas((pesees ?? []).reduce((s, x) => s + Number(x.delta_kg ?? 0), 0));
    setNbPesees((pesees ?? []).length);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useTitreDocument(poudre?.reference ?? "Poudre");

  if (!poudre) return <Spinner />;
  const low = poudre.seuil_alerte_kg != null && Number(poudre.stock_kg) <= Number(poudre.seuil_alerte_kg);

  // Le stock d'une poudre devient la somme des restant_kg de ses lots. Tant qu'aucun lot n'a
  // été réceptionné via ce nouveau système (poudres créées avant cette fonctionnalité), on
  // retombe sur le compteur global historique pour ne pas afficher un stock à zéro.
  const stockLots = lots.reduce((s, l) => s + Number(l.restant_kg), 0);
  const stockAffiche = lots.length > 0 ? stockLots : Number(poudre.stock_kg);
  const ecart = lots.length > 0 ? Number(poudre.stock_kg) - stockLots : 0;

  const perimes = lots.filter((l) => l.dlu && joursAvantDlu(l.dlu) < 0 && Number(l.restant_kg) > 0.001);
  const bientot = lots.filter((l) => l.dlu && joursAvantDlu(l.dlu) >= 0 && joursAvantDlu(l.dlu) <= SEUIL_DLU_JOURS && Number(l.restant_kg) > 0.001);
  const valeurRisque = [...perimes, ...bientot].reduce((s, l) => s + Number(l.restant_kg) * Number(l.poudre_lot_couts?.prix_kg ?? poudre.poudre_couts?.prix_kg ?? 0), 0);

  // Rendement réel vs théorique : la théorique vient de la surface/rendement décomptée à la
  // cuisson (poudre_conso_kg) ; le réel se déduit des pesées physiques, qui recalent le stock
  // sur la réalité. Sans pesée, on n'a pas de mesure réelle indépendante — mais le panneau reste
  // affiché pour dire quoi faire, au lieu de disparaître sans un mot.
  //
  // Le déclencheur est le **nombre** de pesées, pas la somme de leurs écarts : une pesée qui
  // tombe pile (écart 0 kg) est une mesure valide et un excellent résultat. L'ancienne condition
  // `sumPeseeDeltas !== 0` la faisait disparaître de cet écran alors que Pilotage → Rendement
  // teintes, qui compte les pesées, affichait bien 0 % — deux écrans, deux réponses, même donnée.
  const reelKg = theoriqueKg - sumPeseeDeltas;
  // Pas de bornage à zéro : une pesée qui trouve plus de poudre que prévu signale un décompte
  // trop généreux, et c'est une information. La vue `poudre_rendement` ne borne pas non plus.
  const tauxPerte = nbPesees > 0 && reelKg > 0 ? (reelKg - theoriqueKg) / reelKg : null;
  const valeurPerte = tauxPerte != null ? (reelKg - theoriqueKg) * Number(poudre.poudre_couts?.prix_kg ?? 0) : null;

  async function mouvement() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("mouvement_stock", {
      p_poudre_id: id, p_type: mvType, p_valeur_kg: Number(mvKg), p_projet_id: null,
      p_note: null,
    });
    // `errorFr` et non `err.message` : un mouvement de stock refusé par un trigger affichait son
    // code brut (`DEMO_LECTURE_SEULE`, `ABONNEMENT_REQUIS`…) au lieu de la phrase française que
    // tout le reste du produit montre pour le même refus.
    if (err) setError(errorFr(err));
    else { setMvKg(""); await reload(); }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle>{poudre.reference}</PageTitle>

      <Card className={`text-center ${low ? "border-amber-300 bg-amber-50" : ""}`}>
        <div className="text-3xl font-bold">{nombreFr(stockAffiche, 3)} kg</div>
        <div className="text-xs text-gray-500">en stock {low && "· sous le seuil d'alerte"}</div>
        {lots.length > 0 && Math.abs(ecart) > 0.05 && (
          <div className="mt-1 text-xs text-amber-700">Écart de {nombreFr(Math.abs(ecart), 3)} kg avec le compteur global. Une pesée ou une réception réaligne les deux.</div>
        )}
        {perimes.length > 0 && <div className="mt-1 text-xs font-medium text-red-600">{perimes.length} lot{perimes.length > 1 ? "s" : ""} périmé{perimes.length > 1 ? "s" : ""} — le rendu n&apos;est plus garanti.</div>}
        {(perimes.length > 0 || bientot.length > 0) && <div className="text-xs font-semibold">Stock à risque : {eur(valeurRisque)}</div>}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {/* Le bouton n'est pas réservé aux teintes en alerte : un atelier commande aussi
              parce qu'il vient de signer un gros chantier, avant que le seuil ne soit atteint. */}
          <Button variant={low ? "primary" : "secondary"} onClick={commander} disabled={commandeEnCours}>
            <ShoppingCart size={18} aria-hidden /> Ajouter au panier de réapprovisionnement
          </Button>
          <a href={lienReappro(poudre)}
             target="_blank" rel="noreferrer"
             className="text-sm font-medium text-brand underline">
            {poudre.tp_product_id ? "Voir la fiche sur thermopoudre.fr →" : "Chercher sur thermopoudre.fr →"}
          </a>
        </div>
      </Card>

      {/* Audit du 20/11/2026 : la cuisson, l'épaisseur et les fiches n'existaient qu'à l'intérieur
          du formulaire replié « Modifier ». Or c'est ce que l'opérateur vient chercher devant le
          four, téléphone à la main. Une ligne sans valeur ne s'affiche pas : rien n'est supposé. */}
      <Card className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Fiche technique</div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {[
            ["Marque", poudre.marque],
            ["Teinte", poudre.ral],
            ["Finition", [poudre.finition, poudre.type].filter(Boolean).join(" · ") || null],
            ["Cuisson", poudre.temp_cuisson != null ? `${poudre.temp_cuisson} °C${poudre.duree_cuisson_min != null ? ` · ${poudre.duree_cuisson_min} min` : ""}` : null],
            ["Épaisseur", poudre.epaisseur_um_min != null || poudre.epaisseur_um_max != null ? `${poudre.epaisseur_um_min ?? "?"} à ${poudre.epaisseur_um_max ?? "?"} µm` : null],
            ["Rendement", poudre.rendement_m2_kg != null ? `${nombreFr(Number(poudre.rendement_m2_kg), 1)} m²/kg` : null],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} className="min-w-0">
              <dt className="text-xs text-gray-500">{k}</dt>
              <dd className="break-words font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {(poudre.fiche_technique_url || poudre.fds_url) && (
          <div className="flex flex-wrap gap-2">
            {poudre.fiche_technique_url && <a href={poudre.fiche_technique_url} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center rounded-lg border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50">Fiche technique →</a>}
            {poudre.fds_url && <a href={poudre.fds_url} target="_blank" rel="noreferrer" className="flex min-h-[44px] items-center rounded-lg border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50">Fiche de sécurité (FDS) →</a>}
          </div>
        )}
        {!poudre.fds_url && <p className="text-xs text-gray-500">Pas de fiche de sécurité liée : le Code du travail impose qu&apos;elle soit accessible au poste. Ajoutez son lien dans « Modifier la fiche poudre ».</p>}
      </Card>

      {tauxPerte != null ? (
        <Card>
          <div className="mb-1 text-sm font-semibold">Rendement réel vs théorique</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Théorique (surface ÷ rendement)</span>
            <span className="font-medium">{nombreFr(theoriqueKg, 3)} kg</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Réel (recalé aux pesées)</span>
            <span className="font-medium">{nombreFr(reelKg, 3)} kg</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1 text-sm font-semibold">
            <span>Taux de perte</span>
            <span className={tauxPerte > 0.3 ? "text-red-600" : tauxPerte > 0.2 ? "text-amber-700" : "text-green-700"}>{nombreFr(tauxPerte * 100, 1)} %</span>
          </div>
          {valeurPerte != null && valeurPerte > 0 && (
            <p className="mt-1 text-xs text-gray-500">Soit {eur(valeurPerte)} de poudre pulvérisée qui n&apos;a pas fini sur les pièces. Chaque point de perte gagné se traduit directement en économie de poudre.</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Calculé sur {nbPesees} pesée{nbPesees > 1 ? "s" : ""}. Repesez régulièrement : le taux se
            recale à chaque mesure.
          </p>
        </Card>
      ) : (
        /* Sans pesée, l'écran affichait… rien. Le trou était le même que sur Pilotage → Rendement
           teintes : un chiffre absent, et pas un mot sur ce qu'il faut faire pour l'obtenir. */
        <Card className="border-amber-300 bg-amber-50">
          <div className="mb-1 text-sm font-semibold text-amber-900">
            Rendement réel : {theoriqueKg > 0 ? "pesée nécessaire" : "aucune consommation décomptée"}
          </div>
          {theoriqueKg > 0 ? (
            <p className="text-sm text-amber-800">
              {nombreFr(theoriqueKg, 3)} kg de cette teinte ont été décomptés à la cuisson, sur la
              foi du rendement annoncé par le fournisseur ({poudre.rendement_m2_kg != null ? `${nombreFr(poudre.rendement_m2_kg)} m²/kg` : "non renseigné"}).
              C&apos;est un rendement de laboratoire : en cabine, ce qui n&apos;accroche pas la pièce part au
              sol, au filtre ou en surépaisseur. Tant que cette teinte n&apos;a pas été pesée, personne
              ne sait si la perte réelle est de 5 % ou de 30 %
              {poudre.poudre_couts?.prix_kg != null && Number(poudre.poudre_couts.prix_kg) > 0 && <> — et à {eur(poudre.poudre_couts.prix_kg)} le kg, l&apos;écart se compte en centaines d&apos;euros par an</>}.
            </p>
          ) : (
            <p className="text-sm text-amber-800">
              Aucune cuisson n&apos;a encore décompté cette teinte : le rendement réel se calculera dès
              qu&apos;un projet aura été cuit, puis pesé.
            </p>
          )}
          <p className="mt-2 text-sm text-amber-800">
            <b>Pour l&apos;obtenir :</b> pesez le contenant ci-dessous, choisissez <i>Pesée (kg mesurés)</i>
            et saisissez les kilos réellement présents. L&apos;écart avec le stock théorique est votre
            perte. Une pesée par mois suffit à tenir le chiffre à jour.
          </p>
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        {/* Ancre visée depuis Pilotage → Rendement teintes, ligne « Pesée nécessaire ». */}
        <div id="pesee" className="scroll-mt-20 text-sm font-semibold">Pesée / ajustement</div>
        <div className="grid grid-cols-[1fr_100px_auto] gap-2">
          <Select value={mvType} onChange={(e) => setMvType(e.target.value)}>
            <option value="pesee">Pesée (kg mesurés)</option>
            <option value="ajustement">Ajustement (± kg)</option>
          </Select>
          <Input type="number" step="0.01" placeholder="kg" value={mvKg} onChange={(e) => setMvKg(e.target.value)} />
          <Button onClick={mouvement} disabled={busy || mvKg === ""}>OK</Button>
        </div>
        <p className="text-xs text-gray-500">Une pesée recale le stock sur le poids physique mesuré et alimente le calcul de rendement réel ci-dessus.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>

      <Card className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Nouvelle réception (lot)</div>
        <LotForm poudreId={id} prixKgDefaut={poudre.poudre_couts?.prix_kg ?? null} onCreated={reload} />
      </Card>

      {lots.length > 0 && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Lots reçus</div>
            <Link href="/lots" className="text-xs font-medium text-brand">Tous les lots →</Link>
          </div>
          {lots.map((l) => {
            const j = l.dlu ? joursAvantDlu(l.dlu) : null;
            const epuise = Number(l.restant_kg) <= 0.001;
            return (
              <Link key={l.id} href={`/lots/${l.id}`} className="flex items-center justify-between gap-2 border-b border-gray-50 py-2 text-sm last:border-0">
                <div className="min-w-0">
                  <div className="truncate font-medium">Lot {l.numero}</div>
                  <div className="text-xs text-gray-500">
                    {/* Décimales fixées des deux côtés de la barre : voir `nombreFr()`. */}
                    {[l.fournisseur, `reçu le ${dateFr(l.recu_le)}`, `${nombreFr(l.restant_kg, 3, 3)} / ${nombreFr(l.quantite_kg, 3, 3)} kg`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {epuise ? (
                  <Badge tone="neutral">Épuisé</Badge>
                ) : j == null ? (
                  <Badge tone="neutral">DLU non saisie</Badge>
                ) : (
                  <Badge tone={j < 0 ? "danger" : j <= SEUIL_DLU_JOURS ? "warning" : "success"}>
                    {j < 0 ? `Périmé (${dateFr(l.dlu)})` : j <= SEUIL_DLU_JOURS ? `DLU dans ${j} j` : `DLU ${dateFr(l.dlu)}`}
                  </Badge>
                )}
              </Link>
            );
          })}
        </Card>
      )}

      <Card>
        <div className="mb-2 text-sm font-semibold">Historique</div>
        {mouvements.length === 0 && <p className="text-xs text-gray-500">Aucun mouvement.</p>}
        {mouvements.slice(0, 20).map((m) => {
          const note = noteAffichable(m.note);
          const d = dluDe(m);
          return (
            <div key={m.id} className="flex items-center justify-between border-b border-gray-50 py-1.5 text-sm last:border-0">
              <span className="text-gray-600">
                {TYPES[m.type] ?? m.type}{note ? ` · ${note}` : ""}
                {(m.lot_numero || d) && (
                  <span className="block text-xs text-gray-400">
                    {[m.lot_numero && `Lot ${m.lot_numero}`, m.lot_fournisseur, d && `DLU ${dateFr(d)}`].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className={Number(m.delta_kg) < 0 ? "text-red-600" : "text-green-600"}>
                {Number(m.delta_kg) > 0 ? "+" : ""}{nombreFr(m.delta_kg, 2)} kg
              </span>
              <span className="w-20 text-right text-xs text-gray-500">{dateFr(m.created_at)}</span>
            </div>
          );
        })}
      </Card>

      <details>
        <summary className="cursor-pointer text-sm font-medium text-brand">Modifier la fiche poudre</summary>
        <div className="mt-3"><PoudreForm initial={poudre} /></div>
      </details>
    </div>
  );
}
