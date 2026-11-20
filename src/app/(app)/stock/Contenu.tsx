"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Hourglass, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Empty, Input, PageTitle, Spinner } from "@/components/ui";
import { Pagination, Tri, useListePaginee } from "@/components/Pagination";
import { MIN_CARACTERES, REBOND_MS, motifLike } from "@/lib/recherche";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import CatalogueThermopoudre from "@/components/CatalogueThermopoudre";
import { lienReappro } from "@/lib/thermopoudre/fiche";
import { dateFr, eur, libelleFinitionPoudre, nombreFr, qteConseillee } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import type { Poudre, PoudreLot } from "@/lib/types";
import AstuceEcran from "@/components/AstuceEcran";
import { useSeuilDlu } from "@/components/AlertesProvider";
import { dansNJours, joursAvantDlu } from "@/lib/alertes";

/**
 * Stock poudres.
 *
 * L'écran chargeait quatre tables entières sans aucune borne : le catalogue de teintes, **tous**
 * les lots, **tous** les projets ayant consommé de la poudre et **tous** les mouvements de pesée,
 * pour en faire trois agrégats dans le navigateur. Ces deux derniers grossissent à chaque cuisson :
 * l'écran devenait plus lent chaque semaine, sans que rien ne le montre.
 *
 * Trois principes appliqués ici :
 *  - le catalogue est paginé et cherché en base ;
 *  - les lots ne sont chargés que pour les teintes affichées à l'écran ;
 *  - les agrégats (perte par teinte) viennent de la vue `poudre_rendement`, qui les calcule en
 *    SQL. Les alertes de seuil et le stock à risque ont chacun leur requête bornée, parce qu'un
 *    total sur tout l'atelier ne peut pas se déduire d'une page de vingt-cinq lignes.
 */

const COLONNES = "id, reference, ral, marque, finition, stock_kg, seuil_alerte_kg, tp_product_id, rendement_m2_kg, poudre_couts(prix_kg)";

const TRIS = [
  { valeur: "reference", libelle: "Référence", colonne: "reference", croissant: true },
  { valeur: "stock", libelle: "Stock le plus bas", colonne: "stock_kg", croissant: true },
] as const;
type TriStock = (typeof TRIS)[number]["valeur"];

type LigneRendement = { poudre_id: string; reference: string; ral: string | null; taux_perte_pct: number | null; valeur_perte_eur: number | null };

export default function StockPage() {
  const toast = useToast();
  // Le seuil de DLU vient des réglages de l'atelier, plus d'une constante recopiée dans six
  // fichiers. C'est le même nombre que celui qui décide du contenu du courriel du matin.
  const SEUIL_DLU_JOURS = useSeuilDlu();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const [tri, setTri] = useState<TriStock>("reference");
  const [lots, setLots] = useState<PoudreLot[]>([]);
  // Le stock réel est joint à la poudre : l'encart doit afficher le chiffre qui a déclenché
  // l'alerte, pas le compteur global — les deux diffèrent dès qu'une teinte a des lots.
  const [alertes, setAlertes] = useState<{ poudre: Poudre; stock: number }[]>([]);
  const [risque, setRisque] = useState<{ perimes: number; bientot: number; valeur: number } | null>(null);
  const [rendements, setRendements] = useState<LigneRendement[]>([]);
  const [catalogueOuvert, setCatalogueOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const m = setTimeout(() => setQ(saisie.trim()), REBOND_MS);
    return () => clearTimeout(m);
  }, [saisie]);

  const charger = useCallback((de: number, a: number) => {
    const t = TRIS.find((x) => x.valeur === tri)!;
    let requete = supabase.from("poudres").select(COLONNES, { count: "exact" }).eq("actif", true);
    if (q.length >= MIN_CARACTERES) requete = requete.like("recherche", motifLike(q));
    return requete.order(t.colonne, { ascending: t.croissant }).range(de, a);
  }, [supabase, tri, q]);

  const liste = useListePaginee<Poudre>(charger, `${tri}|${q}`);

  // Les lots des seules teintes affichées : c'est ce qui donne le stock réel et la DLU la plus
  // proche de chaque carte, sans rapatrier l'historique complet des lots de l'atelier.
  useEffect(() => {
    const ids = (liste.lignes ?? []).map((p) => p.id);
    if (ids.length === 0) { setLots([]); return; }
    let annule = false;
    supabase
      .from("poudre_lots")
      .select("id, poudre_id, restant_kg, dlu")
      .in("poudre_id", ids)
      .then(({ data }) => { if (!annule) setLots((data as unknown as PoudreLot[]) ?? []); });
    return () => { annule = true; };
  }, [supabase, liste.lignes]);

  // Les trois encarts de tête portent sur tout l'atelier, pas sur la page : chacun sa requête,
  // chacune bornée à ce qu'elle affiche.
  useEffect(() => {
    let annule = false;
    (async () => {
      const [sousSeuil, aRisque, perte] = await Promise.all([
        supabase.from("poudres").select(COLONNES).eq("actif", true).not("seuil_alerte_kg", "is", null).order("reference").limit(50),
        supabase.from("poudre_lots").select("restant_kg, dlu, poudre_lot_couts(prix_kg)")
          .gt("restant_kg", 0.001).not("dlu", "is", null).lte("dlu", dansNJours(SEUIL_DLU_JOURS)).limit(500),
        // La vue calcule le rapport pesées / théorique en SQL. Elle est fermée aux rôles sans
        // accès commercial : l'encart disparaît alors, sans erreur ni écran cassé.
        supabase.from("poudre_rendement").select("poudre_id, reference, ral, taux_perte_pct, valeur_perte_eur")
          .not("taux_perte_pct", "is", null).order("taux_perte_pct", { ascending: false }).limit(6),
      ]);
      if (annule) return;

      // Le seuil se compare au stock réel (somme des lots restants), pas au compteur global : on
      // ne charge donc les lots que des teintes qui ont un seuil déclaré.
      const candidates = ((sousSeuil.data ?? []) as unknown as Poudre[]);
      const stocks: Record<string, number> = {};
      if (candidates.length > 0) {
        const { data } = await supabase.from("poudre_lots").select("poudre_id, restant_kg").in("poudre_id", candidates.map((p) => p.id));
        for (const l of (data ?? []) as { poudre_id: string; restant_kg: number | string }[]) {
          stocks[l.poudre_id] = (stocks[l.poudre_id] ?? 0) + Number(l.restant_kg);
        }
      }
      if (annule) return;
      setAlertes(
        candidates
          .map((p) => ({ poudre: p, stock: stocks[p.id] ?? Number(p.stock_kg) }))
          .filter((x) => x.stock <= Number(x.poudre.seuil_alerte_kg)),
      );

      const lignes = ((aRisque.data ?? []) as unknown as { restant_kg: number | string; dlu: string; poudre_lot_couts: { prix_kg: number | null } | null }[]);
      setRisque({
        perimes: lignes.filter((l) => joursAvantDlu(l.dlu) < 0).length,
        bientot: lignes.filter((l) => joursAvantDlu(l.dlu) >= 0).length,
        valeur: lignes.reduce((s, l) => s + Number(l.restant_kg) * Number(l.poudre_lot_couts?.prix_kg ?? 0), 0),
      });
      setRendements(((perte.data ?? []) as unknown as LigneRendement[]));
    })();
    return () => { annule = true; };
    // `SEUIL_DLU_JOURS` en dépendance : l'atelier peut le changer dans Réglages → Alertes, et
    // l'encart « à écouler » doit alors se recharger sur la nouvelle borne.
  }, [supabase, SEUIL_DLU_JOURS]);

  async function remplirPanier(cibles: { p: Poudre; qte: number }[]) {
    setEnCours(true);
    for (const { p, qte } of cibles) {
      const { error } = await supabase.rpc("ajouter_au_panier_poudre", { p_poudre_id: p.id, p_quantite_kg: qte });
      if (error) { setEnCours(false); toast(errorFr(error), "error"); return; }
    }
    setEnCours(false);
    toast(`${cibles.length} teinte${cibles.length > 1 ? "s" : ""} au panier.`);
    router.push("/commandes");
  }

  const lotsParPoudre = useMemo(() => {
    const m = new Map<string, PoudreLot[]>();
    for (const l of lots) m.set(l.poudre_id, [...(m.get(l.poudre_id) ?? []), l]);
    return m;
  }, [lots]);

  /** Le stock d'une poudre = somme des lots restants ; à défaut de lot, le compteur global. */
  function stockDe(p: Poudre) {
    const ls = lotsParPoudre.get(p.id) ?? [];
    return ls.length > 0 ? ls.reduce((s, l) => s + Number(l.restant_kg), 0) : Number(p.stock_kg);
  }
  function dluProcheDe(p: Poudre) {
    const ls = (lotsParPoudre.get(p.id) ?? []).filter((l) => l.dlu && Number(l.restant_kg) > 0.001);
    if (ls.length === 0) return null;
    return ls.reduce((min, l) => (l.dlu! < min ? l.dlu! : min), ls[0].dlu!);
  }

  useTitreDocument("Stock poudres");

  return (
    <div className="flex flex-col gap-3">
      <PageTitle action={<Link href="/stock/new" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ Poudre</Link>}>Stock poudres</PageTitle>
      <AstuceEcran cle="stock" />

      {alertes.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="mb-2 text-sm font-semibold text-amber-800">
            <AlertTriangle size={16} aria-hidden className="mr-1 inline-block align-[-2px]" />
            {alertes.length} poudre{alertes.length > 1 ? "s" : ""} sous le seuil
          </div>
          <ul className="mb-2 flex flex-col gap-1 text-sm text-amber-900">
            {alertes.map(({ poudre: p, stock }) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {/* Décimales fixées des deux côtés de la comparaison : voir `nombreFr()`. */}
                  {p.reference} — {nombreFr(stock, 1, 1)} kg pour un seuil à {nombreFr(p.seuil_alerte_kg, 1, 1)} kg
                </span>
                <a href={lienReappro(p)} target="_blank" rel="noreferrer" className="shrink-0 text-xs underline">
                  Fiche produit →
                </a>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => remplirPanier(alertes.map(({ poudre: p, stock }) => ({ p, qte: qteConseillee(p, stock) })))} disabled={enCours}>
            Mettre au panier de réapprovisionnement
          </Button>
          <p className="mt-1 text-xs text-amber-800">
            Quantité proposée : de quoi repasser au double du seuil, arrondi au sac de 5 kg. Vous ajustez au panier.
          </p>
        </Card>
      )}

      <div>
        {catalogueOuvert ? (
          <CatalogueThermopoudre dejaImportes={(liste.lignes ?? []).map((p) => p.tp_product_id).filter((x): x is number => x != null)} />
        ) : (
          <Button variant="secondary" onClick={() => setCatalogueOuvert(true)}>
            Importer une teinte du catalogue Thermopoudre
          </Button>
        )}
      </div>

      {risque && (risque.perimes > 0 || risque.bientot > 0) && (
        <Card className={risque.perimes > 0 ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}>
          <div className={`mb-1 text-sm font-semibold ${risque.perimes > 0 ? "text-red-800" : "text-amber-800"}`}>
            <Hourglass size={16} aria-hidden className="mr-1 inline-block align-[-2px]" />
            Dates limites d&apos;utilisation
          </div>
          <ul className="text-sm text-gray-700">
            {risque.perimes > 0 && <li>{risque.perimes} lot{risque.perimes > 1 ? "s" : ""} périmé{risque.perimes > 1 ? "s" : ""} — le rendu n&apos;est plus garanti.</li>}
            {risque.bientot > 0 && <li>{risque.bientot} lot{risque.bientot > 1 ? "s" : ""} à écouler sous {SEUIL_DLU_JOURS} jours.</li>}
          </ul>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-semibold">Stock à risque : {eur(risque.valeur)}</span>
            <Link href="/lots" className="text-xs font-medium text-red-800 underline">Voir les lots →</Link>
          </div>
        </Card>
      )}

      {rendements.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Taux de perte par teinte</div>
          <div className="flex flex-col gap-1.5">
            {rendements.map((r) => {
              const taux = Number(r.taux_perte_pct ?? 0);
              const perte = Number(r.valeur_perte_eur ?? 0);
              return (
                <Link key={r.poudre_id} href={`/stock/${r.poudre_id}`} className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-700">{r.reference}{r.ral ? ` · RAL ${r.ral}` : ""}</span>
                  <span className={`shrink-0 font-medium ${taux > 30 ? "text-red-600" : taux > 20 ? "text-amber-700" : "text-green-700"}`}>
                    {nombreFr(taux, 0)} % {perte > 0 && <span className="font-normal text-gray-400">· {eur(perte)}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">Réel recalé sur les pesées vs théorique (surface ÷ rendement). Chaque point de perte gagné, c&apos;est de la poudre — et de l&apos;argent — économisés.</p>
        </Card>
      )}

      <label className="relative block">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Référence, RAL, marque, finition…"
          aria-label="Rechercher une poudre"
          className="min-h-[48px] pl-10"
        />
      </label>
      <div className="flex justify-end">
        <Tri valeur={tri} onChange={setTri} options={TRIS.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))} />
      </div>

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty action={q ? undefined : <Link href="/stock/new" className="rounded-lg bg-brand min-h-[44px] px-4 py-3 text-sm font-medium text-white transition duration-150 ease-out hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Ajouter une poudre</Link>}>
          {q
            ? `Aucune teinte ne correspond à « ${q} ».`
            : "Aucune poudre déclarée. Dès qu'une teinte est ici, chaque cuisson en décompte la consommation et l'écran vous prévient avant la panne. Vous pouvez aussi importer une teinte du catalogue Thermopoudre ci-dessus."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.lignes.map((p) => {
            const stock = stockDe(p);
            const low = p.seuil_alerte_kg != null && stock <= Number(p.seuil_alerte_kg);
            const d = dluProcheDe(p);
            const j = d ? joursAvantDlu(d) : null;
            const dluChaude = j != null && j <= SEUIL_DLU_JOURS;
            return (
              <Link key={p.id} href={`/stock/${p.id}`}>
                <Card className={`flex items-center justify-between gap-3 ${j != null && j < 0 ? "border-red-300" : dluChaude || low ? "border-amber-300" : ""}`}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.reference} {p.ral && <span className="text-gray-500">· RAL {p.ral}</span>}</div>
                    {/* D7 — `p.finition` porte un code technique ("satine", "texture"…) : c'est
                        `libelleFinitionPoudre` qui l'affiche en français, jamais la colonne brute. */}
                    <div className="text-xs text-gray-500">{[p.marque, libelleFinitionPoudre(p.finition)].filter(Boolean).join(" · ")}</div>
                    {j != null && (
                      <div className={`text-xs font-medium ${j < 0 ? "text-red-600" : j <= SEUIL_DLU_JOURS ? "text-amber-700" : "text-gray-400"}`}>
                        {j < 0 ? `DLU dépassée le ${dateFr(d)}` : j <= SEUIL_DLU_JOURS ? `DLU dans ${j} j` : `DLU ${dateFr(d)}`}
                      </div>
                    )}
                  </div>
                  <Badge tone={low ? "warning" : "neutral"}>{nombreFr(stock, 1)} kg</Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="teintes" />

      <Link href="/lots" className="text-center text-sm font-medium text-brand">Voir tous les lots de poudre →</Link>
    </div>
  );
}
