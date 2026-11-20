"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { eur, nombreFr } from "@/lib/utils";
import {
  calculerCharge,
  dateLivraisonRealiste,
  NIVEAU_CHARGE_TON,
  NIVEAU_CHARGE_LABEL,
  niveauCharge,
  type Charge,
} from "@/lib/capacite";
import { dateFr } from "@/lib/utils";
import { useEtatUrl } from "@/lib/urlState";
import { useTitreDocument } from "@/lib/titre";
import type { AtelierFour, AtelierLot2, ClientRentabilite, PoudreRendement } from "@/lib/types";
import AstuceEcran from "@/components/AstuceEcran";
import Assistant from "@/components/Assistant";
import { MessageCircleQuestion } from "lucide-react";

type Onglet = "charge" | "clients" | "teintes";
const ONGLETS: readonly Onglet[] = ["charge", "clients", "teintes"];

export default function PilotagePage() {
  const supabase = useMemo(() => createClient(), []);
  // D10 — l'onglet vit dans l'URL (`?onglet=`) : Précédent quittait la page entière au lieu de
  // revenir sur « Charge du four », et aucun lien ne pouvait pointer directement sur « Rentabilité
  // client ». Même mécanisme que `/reglages?onglet=`.
  const [onglet, setOnglet] = useEtatUrl<Onglet>("onglet", "charge", ONGLETS);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [proposition, setProposition] = useState<{ date: string; explication: string } | null>(null);
  const [clients, setClients] = useState<ClientRentabilite[] | null>(null);
  const [teintes, setTeintes] = useState<PoudreRendement[] | null>(null);
  const [fourParametre, setFourParametre] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: projets }, { data: cr }, { data: pr }] = await Promise.all([
        supabase.from("ateliers").select("*").maybeSingle(),
        supabase.from("projets").select("surface_m2, status, date_promise, etape_courante, stock_decremente_at"),
        supabase.from("client_rentabilite").select("*"),
        supabase.from("poudre_rendement").select("*"),
      ]);
      const atelier = a as (AtelierFour & AtelierLot2) | null;
      const params = {
        four_capacite_m2: atelier?.four_capacite_m2 ?? null,
        four_cycles_jour: atelier?.four_cycles_jour ?? 0,
        four_remplissage_moyen_pct: atelier?.four_remplissage_moyen_pct ?? 0,
      };
      const c = calculerCharge(projets ?? [], params);
      setCharge(c);
      setFourParametre(c.capaciteJourM2 != null);
      setProposition(dateLivraisonRealiste(c, 0));
      setClients(((cr as ClientRentabilite[]) ?? []).filter((l) => l.projets > 0 || Number(l.facture_ht) !== 0));
      setTeintes(((pr as PoudreRendement[]) ?? []).filter((t) => Number(t.theorique_kg) > 0));
    })();
  }, [supabase]);

  useTitreDocument("Pilotage");

  if (!charge || !clients || !teintes) return <Spinner />;

  const niveau = niveauCharge(charge.tauxChargePct);
  // Deux populations, longtemps confondues sous le même rouge : celle qui coûte plus qu'elle ne
  // rapporte une fois tout facturé, et celle dont la facture n'est simplement pas encore partie.
  const deficitaires = clients.filter((c) => c.perte_reelle);
  const enAttente = clients.filter((c) => Number(c.reste_a_facturer) > 0 || Number(c.projets_non_factures) > 0);
  const totalResteAFacturer = enAttente.reduce((s, c) => s + Number(c.reste_a_facturer), 0);
  const totalBlAFacturer = enAttente.reduce((s, c) => s + Number(c.bl_a_facturer), 0);
  // Défaut n°2 (recette vague 3) — `enAttente` mélangeait deux causes que « Voir les bons de
  // livraison à facturer » traitait comme une seule : du travail livré et non facturé (un BL
  // existe, il attend sa facture) et un chantier facturable directement sans jamais être passé
  // par un BL (`projets_non_factures`, compté même en cours de production). Sur l'atelier de
  // démo, les deux clients qui allument ce bandeau sont dans le second cas : `/bl?filtre=livre`
  // s'ouvrait vide puisqu'aucun BL n'existe pour eux. On distingue donc les deux chemins.
  const clientsSansBl = enAttente.filter((c) => Number(c.bl_a_facturer) === 0 && Number(c.projets_non_factures) > 0);

  // Teintes jamais pesées : le taux de perte n'existe pas tant que personne n'a mis la poudre
  // sur une balance. Le chiffre manquant se compte, lui, et il vaut d'être annoncé.
  const jamaisPesees = teintes.filter((t) => Number(t.pesees) === 0);
  const kgSansControle = jamaisPesees.reduce((s, t) => s + Number(t.theorique_kg), 0);

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Pilotage</PageTitle>

      {/* F3 (assistant IA) — panneau replié en tête de l'écran : fermé par défaut, il ne charge ni
          n'affiche rien tant que l'exploitant ne l'ouvre pas. `<details>` porte nativement le
          clavier et l'accessibilité d'un tel panneau, sans état React de plus à maintenir ici. */}
      <details className="rounded-xl border border-gray-200 bg-white open:pb-1">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <MessageCircleQuestion size={18} className="text-brand" aria-hidden />
          Demander à l&apos;assistant
        </summary>
        <div className="px-3 pb-3">
          <Assistant />
        </div>
      </details>

      <AstuceEcran cle="pilotage" />

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {ONGLETS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={onglet === t}
            onClick={() => setOnglet(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${onglet === t ? "bg-brand text-white" : "bg-gray-100 text-gray-600"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
          >
            {{ charge: "Charge du four", clients: "Rentabilité client", teintes: "Rendement teintes" }[t]}
          </button>
        ))}
      </div>

      {onglet === "charge" && (
        <div className="flex flex-col gap-3 md:max-w-2xl">
          {!fourParametre ? (
            <Card className="border-amber-300 bg-amber-50">
              <div className="text-sm font-semibold text-amber-900">Four non paramétré</div>
              <p className="mt-1 text-sm text-amber-800">
                Renseignez la capacité du four, le nombre de cycles tenus dans une journée et votre taux
                de remplissage moyen dans <Link href="/reglages" className="underline">Réglages → Atelier</Link>.
                Sans ces trois chiffres, aucune date de livraison ne peut être proposée — et une date
                inventée est pire qu&apos;une absence de date.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card><div className="text-2xl font-bold">{nombreFr(charge.enCoursM2)} m²</div><div className="text-xs text-gray-500">Encore à cuire</div></Card>
                <Card><div className="text-2xl font-bold">{charge.projets}</div><div className="text-xs text-gray-500">Projets en file</div></Card>
                <Card><div className="text-2xl font-bold">{nombreFr(charge.capaciteJourM2 ?? 0)} m²</div><div className="text-xs text-gray-500">Cuisables par jour</div></Card>
                <Card className={charge.enRetard > 0 ? "border-red-300 bg-red-50" : ""}>
                  <div className="text-2xl font-bold">{charge.enRetard}</div>
                  <div className="text-xs text-gray-500">Projets dont la date promise est passée</div>
                </Card>
              </div>

              <Card className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Taux de charge</div>
                  {niveau && <Badge tone={NIVEAU_CHARGE_TON[niveau]}>{NIVEAU_CHARGE_LABEL[niveau]}</Badge>}
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full ${(charge.tauxChargePct ?? 0) >= 600 ? "bg-red-500" : (charge.tauxChargePct ?? 0) >= 300 ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(100, (charge.tauxChargePct ?? 0) / 6)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {charge.joursDeCharge} jour{(charge.joursDeCharge ?? 0) > 1 ? "s" : ""} de four devant vous
                  ({charge.tauxChargePct} % d&apos;une journée de production).
                </p>
              </Card>

              {proposition && (
                <Card className="flex flex-col gap-1">
                  <div className="text-sm font-semibold">Prochaine date tenable, carnet en l&apos;état</div>
                  <div className="text-2xl font-bold text-brand">{dateFr(proposition.date)}</div>
                  <p className="text-xs text-gray-500">{proposition.explication}</p>
                  <p className="text-xs text-gray-500">
                    Sur un devis, la date proposée intègre en plus la surface du chantier chiffré.
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {onglet === "clients" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Chiffre d&apos;affaires moins prix de revient réel (poudre au prix du lot, main d&apos;œuvre
            chronométrée, quote-part d&apos;énergie du four, frais généraux) et coût des retouches.
            Un gros client n&apos;est pas forcément un bon client.
          </p>
          {/* C7 — phrase obligatoire (cahier des charges v3 §3), identique mot pour mot à celle du
              bloc revient sur la fiche projet (components/RevientProjet.tsx). Ne pas reformuler. */}
          <p className="text-xs text-gray-400">
            Ce prix de revient ne comprend ni les consommables ni les achats hors poudre.
          </p>

          {deficitaires.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <div className="text-sm font-semibold text-red-900">
                {deficitaires.length} client{deficitaires.length > 1 ? "s" : ""} en perte réelle
              </div>
              <p className="mt-1 text-sm text-red-800">
                {deficitaires.map((c) => `${c.nom} (${eur(c.marge_eur)})`).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-red-800">
                Tout est facturé sur ces clients, et le facturé reste sous le prix de revient : c&apos;est
                le tarif ou le temps passé qu&apos;il faut reprendre, pas la facturation.
              </p>
            </Card>
          )}

          {(totalResteAFacturer > 0 || enAttente.length > 0) && (
            <Card className="border-amber-300 bg-amber-50">
              <div className="text-sm font-semibold text-amber-900">
                {totalResteAFacturer > 0
                  ? `${eur(totalResteAFacturer)} de travail livré attend sa facture`
                  : `${enAttente.length} client${enAttente.length > 1 ? "s" : ""} avec du travail pas encore facturé`}
              </div>
              <p className="mt-1 text-sm text-amber-800">
                {totalBlAFacturer > 0 && (
                  <>
                    {totalBlAFacturer} bon{totalBlAFacturer > 1 ? "s" : ""} de livraison livré
                    {totalBlAFacturer > 1 ? "s" : ""} et non facturé{totalBlAFacturer > 1 ? "s" : ""}.{" "}
                  </>
                )}
                Ce n&apos;est pas une perte, c&apos;est de la trésorerie en attente — mais tant que la
                facture n&apos;est pas partie, ces chantiers tirent la marge vers le bas.
              </p>
              {/* Défaut n°5 de la recette navigateur (vague 2) : ce lien ouvrait `/bl` sur son
                  filtre par défaut (« À livrer »), qui ne contient jamais les BL livrés — l'onglet
                  s'ouvrait vide. Amélioration n°5 (07/09) : l'onglet « Livrés » de /bl inclut
                  désormais aussi le déjà-facturé (vue atelier : un BL facturé a bien été livré),
                  donc `filtre=livre` ne correspondrait plus à « à facturer ». `/bl` porte depuis
                  un onglet distinct `a_facturer` (statut `livre` sans facture liée), même
                  définition que la colonne « Reste à facturer » juste plus bas
                  (`?client=...&filtre=a_facturer`). Ce lien ne concerne que le travail qui EST
                  passé par un bon de livraison : `totalBlAFacturer` en compte le nombre juste
                  au-dessus. */}
              {totalBlAFacturer > 0 && (
                <Link href="/bl?filtre=a_facturer" className="mt-2 inline-block text-sm font-medium text-amber-900 underline">
                  Voir les bons de livraison à facturer →
                </Link>
              )}
              {/* Défaut n°2 (recette vague 3) : les chantiers de `clientsSansBl` n'ont jamais eu de
                  bon de livraison — certains sont même encore en production — donc `/bl`, quel que
                  soit son filtre, ne peut pas les montrer : la liste n'existe tout simplement pas
                  là-bas. `/projets?filtre=a_facturer` interroge directement les projets non
                  facturés (même logique que `projets_non_factures` dans `client_rentabilite`), pas
                  les bons de livraison. */}
              {clientsSansBl.length > 0 && (
                <Link href="/projets?filtre=a_facturer" className="mt-2 block text-sm font-medium text-amber-900 underline">
                  Voir les chantiers à facturer directement (sans bon de livraison) →
                </Link>
              )}
            </Card>
          )}

          {clients.length === 0 ? (
            <Empty>Pas encore assez de production chiffrée pour comparer vos clients.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3 text-right">Projets</th>
                    <th className="py-2 pr-3 text-right">m² moyen</th>
                    <th className="py-2 pr-3 text-right">Délai accordé</th>
                    <th className="py-2 pr-3 text-right">Retouches</th>
                    <th className="py-2 pr-3 text-right">Facturé</th>
                    <th className="py-2 pr-3 text-right">Reste à facturer</th>
                    <th className="py-2 pr-3 text-right">Revient</th>
                    <th className="py-2 pr-3 text-right">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {[...clients].sort((a, b) => Number(a.marge_eur) - Number(b.marge_eur)).map((c) => {
                    // Rouge réservé à la perte au sens strict. Une marge négative expliquée par
                    // du travail non facturé reste grise : le rouge doit vouloir dire « agis sur
                    // ton tarif », pas « ta facture est en retard ».
                    const perte = c.perte_reelle;
                    const attente = Number(c.reste_a_facturer) > 0 || Number(c.projets_non_factures) > 0;
                    return (
                      <tr key={c.client_id} className={`border-b border-gray-100 ${perte ? "bg-red-50" : ""}`}>
                        <td className="py-2 pr-3 font-medium">
                          <Link href={`/clients/${c.client_id}`} className="hover:underline">{c.nom}</Link>
                        </td>
                        <td className="py-2 pr-3 text-right">{c.projets}</td>
                        <td className="py-2 pr-3 text-right">{c.surface_moyenne_m2 != null ? `${nombreFr(c.surface_moyenne_m2)} m²` : "—"}</td>
                        <td className="py-2 pr-3 text-right">{c.delai_moyen_jours != null ? `${nombreFr(c.delai_moyen_jours, 1)} j` : "—"}</td>
                        <td className="py-2 pr-3 text-right">
                          {c.retouches > 0 ? <span className="text-amber-700">{c.retouches}{Number(c.cout_non_qualite) > 0 && ` · ${eur(c.cout_non_qualite)}`}</span> : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right">{eur(c.facture_ht)}</td>
                        <td className="py-2 pr-3 text-right">
                          {/* D10 — le lien pose explicitement le filtre attendu : /bl ne doit plus
                              s'ouvrir sur son filtre par défaut quand on vient chercher précisément
                              autre chose. Depuis l'amélioration n°5 (07/09), ce filtre s'appelle
                              `a_facturer` (« Livrés » inclut désormais aussi le déjà-facturé). */}
                          {Number(c.reste_a_facturer) > 0 ? (
                            <Link href={`/bl?client=${c.client_id}&filtre=a_facturer`} className="font-medium text-amber-700 underline">
                              {eur(c.reste_a_facturer)}
                              <span className="ml-1 text-xs font-normal">
                                ({c.bl_a_facturer} BL)
                              </span>
                            </Link>
                          ) : Number(c.projets_non_factures) > 0 ? (
                            // Défaut n°2 (recette vague 3) : ce cas n'a jamais eu de bon de
                            // livraison — `/bl` ne peut rien en montrer. `/projets` interroge les
                            // projets directement.
                            <Link href={`/projets?client=${c.client_id}&filtre=a_facturer`} className="text-xs font-medium text-amber-700 underline">
                              {c.projets_non_factures} chantier{Number(c.projets_non_factures) > 1 ? "s" : ""} à facturer
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">{eur(c.revient_total)}</td>
                        <td className={`py-2 pr-3 text-right font-semibold ${perte ? "text-red-700" : Number(c.marge_eur) < 0 ? "text-gray-600" : "text-green-700"}`}>
                          {eur(c.marge_eur)}
                          {c.marge_pct != null && <span className="ml-1 text-xs font-normal text-gray-500">{nombreFr(c.marge_pct, 1)} %</span>}
                          {Number(c.marge_eur) < 0 && !perte && attente && (
                            <div className="text-xs font-normal text-gray-500">
                              dont {eur(c.revient_non_facture)} de revient pas encore facturé
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500">
            La marge est calculée sur ce qui est <b>réellement facturé</b> : un chantier livré dont la
            facture n&apos;est pas partie pèse donc son prix de revient sans aucune recette en face. La
            colonne « Reste à facturer » isole cette part-là — c&apos;est de la trésorerie en attente,
            pas une perte. Seules les lignes surlignées en rouge sont des pertes au sens strict :
            tout est facturé, et le facturé est inférieur au revient.
          </p>
        </div>
      )}

      {onglet === "teintes" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Le théorique est ce que l&apos;application a décompté à la cuisson (surface ÷ rendement annoncé).
            Le réel ne s&apos;obtient que par la pesée : sans pesée sur une teinte, aucun taux de perte
            n&apos;est affiché plutôt qu&apos;un chiffre inventé.
          </p>

          {/* Le chiffre manquant est expliqué là où il manque : dire « Pesée nécessaire » sans dire
              quoi faire ni ce que ça coûte, c'est laisser l'écran vide pour toujours. */}
          {jamaisPesees.length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <div className="text-sm font-semibold text-amber-900">
                {jamaisPesees.length} teinte{jamaisPesees.length > 1 ? "s" : ""} jamais pesée
                {jamaisPesees.length > 1 ? "s" : ""} — {nombreFr(kgSansControle, 3)} kg décomptés sans
                aucun contrôle physique
              </div>
              <p className="mt-1 text-sm text-amber-800">
                Le rendement annoncé par le fournisseur est un rendement de laboratoire. Dans un
                atelier, ce qui n&apos;accroche pas la pièce part au sol, au filtre ou en surépaisseur —
                entre 5 % et 30 % selon la cabine, la mise à la terre et la forme des pièces. Tant que
                personne n&apos;a mis la poudre sur une balance, l&apos;application ne peut que répéter le
                chiffre du fournisseur : elle ne sait pas si vous perdez 5 % ou 30 %.
              </p>
              <p className="mt-2 text-sm text-amber-800">
                <b>Comment obtenir le chiffre :</b> ouvrez la teinte dans{" "}
                <Link href="/stock" className="font-medium underline">Stock</Link>, bloc « Pesée /
                ajustement », choisissez <i>Pesée (kg mesurés)</i> et saisissez les kilos réellement
                restants sur la balance. L&apos;écart entre ce poids et ce que l&apos;application croyait
                rester, c&apos;est votre perte réelle. Une pesée par teinte et par mois suffit.
              </p>
            </Card>
          )}

          {teintes.length === 0 ? (
            <Empty>Aucune poudre encore consommée en production.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Teinte</th>
                    <th className="py-2 pr-3 text-right">m² laqués</th>
                    <th className="py-2 pr-3 text-right">Théorique</th>
                    <th className="py-2 pr-3 text-right">Réel</th>
                    <th className="py-2 pr-3 text-right">Rendement annoncé</th>
                    <th className="py-2 pr-3 text-right">Rendement réel</th>
                    <th className="py-2 pr-3 text-right">Perte</th>
                  </tr>
                </thead>
                <tbody>
                  {[...teintes].sort((a, b) => (Number(b.taux_perte_pct ?? -1)) - (Number(a.taux_perte_pct ?? -1))).map((t) => {
                    const taux = t.taux_perte_pct != null ? Number(t.taux_perte_pct) : null;
                    return (
                      <tr key={t.poudre_id} className={`border-b border-gray-100 ${taux != null && taux >= 15 ? "bg-amber-50" : ""}`}>
                        <td className="py-2 pr-3 font-medium">
                          <Link href={`/stock/${t.poudre_id}`} className="hover:underline">{t.reference}</Link>
                          {t.ral && <span className="ml-1 text-xs text-gray-500">RAL {t.ral}</span>}
                        </td>
                        <td className="py-2 pr-3 text-right">{nombreFr(t.surface_m2)}</td>
                        <td className="py-2 pr-3 text-right">{nombreFr(t.theorique_kg, 3)} kg</td>
                        <td className="py-2 pr-3 text-right">{t.pesees > 0 ? `${nombreFr(t.reel_kg, 3)} kg` : "—"}</td>
                        <td className="py-2 pr-3 text-right">{t.rendement_theorique_m2_kg != null ? `${nombreFr(t.rendement_theorique_m2_kg)} m²/kg` : "—"}</td>
                        <td className="py-2 pr-3 text-right">{t.rendement_reel_m2_kg != null ? `${nombreFr(t.rendement_reel_m2_kg)} m²/kg` : "—"}</td>
                        <td className={`py-2 pr-3 text-right font-semibold ${taux != null && taux >= 15 ? "text-amber-700" : ""}`}>
                          {taux != null ? (
                            <>{nombreFr(taux, 1)} %<span className="ml-1 text-xs font-normal text-gray-500">{eur(t.valeur_perte_eur)}</span></>
                          ) : (
                            // Le libellé mène à l'endroit exact où saisir la pesée : un écran qui
                            // réclame une donnée doit ouvrir la porte, pas se contenter de la nommer.
                            <Link href={`/stock/${t.poudre_id}#pesee`} className="text-xs font-normal text-amber-700 underline">
                              Pesée nécessaire →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
