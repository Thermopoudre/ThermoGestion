"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSeuilDlu } from "@/components/AlertesProvider";
import { joursAvantDlu } from "@/lib/alertes";
import { devisPerime } from "@/lib/devis";
import { Card, Spinner } from "@/components/ui";
import ChecklistDemarrage from "@/components/ChecklistDemarrage";
import AstuceEcran from "@/components/AstuceEcran";
import { useTitreDocument } from "@/lib/titre";
import { eur, nombreFr } from "@/lib/utils";

/** B4 — le chiffre du vendredi soir. `null` : pas encore chargé ou compte d'atelier (RPC réservée
 *  au bureau) — dans les deux cas, la bande ne s'affiche simplement pas plutôt que d'afficher des
 *  zéros qui ressembleraient à un mois blanc. */
type ChiffresMois = {
  facture_ht: number; facture_ht_mois_precedent: number;
  encaisse: number; encaisse_mois_precedent: number;
  reste_du: number;
  m2_produits: number; m2_produits_mois_precedent: number;
};

/** Une flèche verte/rouge à côté du chiffre du mois, discrète — le chiffre parle de lui-même. */
function Delta({ valeur, precedent }: { valeur: number; precedent: number }) {
  if (precedent === 0) return null;
  const pct = Math.round(((valeur - precedent) / precedent) * 100);
  if (pct === 0) return <span className="text-xs text-gray-400">= mois dernier</span>;
  const hausse = pct > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${hausse ? "text-green-700" : "text-red-700"}`}>
      {hausse ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
      {hausse ? "+" : ""}{pct} % vs mois dernier
    </span>
  );
}

type Stats = {
  devisEnvoyes: number;
  devisMontant: number;
  // Amélioration n°3 (07/09/2026) — un devis « envoyé » dont la validité est dépassée (le cron
  // `expirer_devis` n'est pas encore passé, ou l'a sauté pour un atelier en lecture seule, cf.
  // migration 45 §4) n'est plus du pipeline chaud. On le sort de `devisEnvoyes`/`devisMontant`
  // (devis_perime(), la seule définition — src/lib/devis.ts) et on le montre à part : un devis
  // expiré n'est pas mort, il se relance autrement.
  devisExpiresNb: number;
  devisExpiresMontant: number;
  projetsEnCours: number;
  projetsRetard: number;
  alertesStock: number;
  lotsPerimes: number;
  lotsBientot: number;
  valeurRisque: number;
  facturesImpayees: number;
  facturesMontant: number;
  jeuxEnCours: number;
  jeuxRetard: number;
  jeuxAujourdhui: number;
  tauxConversion: number | null;
  devisSignes30j: number;
  devisTotal30j: number;
};


export default function Dashboard() {
  // Réglage d'atelier, plus une constante recopiée : voir src/lib/alertes.ts.
  const SEUIL_DLU_JOURS = useSeuilDlu();
  const [stats, setStats] = useState<Stats | null>(null);
  const [atelierNom, setAtelierNom] = useState("");
  const [chiffres, setChiffres] = useState<ChiffresMois | null>(null);

  useTitreDocument("Tableau de bord");

  // Séparé du reste : `chiffres_du_mois()` est réservée au bureau (acces_commercial()), et un
  // compte d'atelier doit voir le reste du tableau de bord sans que son refus ne fasse tomber
  // toute la page. On avale l'erreur, on n'affiche simplement pas la bande.
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("chiffres_du_mois").maybeSingle().then(({ data }) => {
      if (data) setChiffres(data as unknown as ChiffresMois);
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const depuis30j = new Date(Date.now() - 30 * 86400000).toISOString();
      const aujourdhui = new Date().toISOString().slice(0, 10);
      const [a, d, p, retard, poudres, factImpayees, devis30j, lots, jeux] = await Promise.all([
        supabase.from("ateliers").select("nom").maybeSingle(),
        // `envoye_at, created_at, validite_jours` : ce qu'il faut à `devisPerime()` pour trier le
        // pipeline chaud des devis expirés — voir le commentaire du type `Stats` ci-dessus.
        supabase.from("devis").select("total_ttc, envoye_at, created_at, validite_jours").eq("status", "envoye"),
        supabase.from("projets").select("id", { count: "exact", head: true }).in("status", ["en_attente", "en_cours"]),
        // « pret » est inclus : un projet terminé mais jamais livré, cinq jours après la date
        // promise, est en retard pour le client. Il s'affichait en rouge sur le kanban et
        // n'apparaissait nulle part ici — deux écrans du même produit, deux vérités.
        supabase.from("projets").select("id", { count: "exact", head: true }).in("status", ["en_attente", "en_cours", "pret"]).lt("date_promise", aujourdhui),
        supabase.from("poudres").select("stock_kg, seuil_alerte_kg").eq("actif", true).not("seuil_alerte_kg", "is", null),
        supabase.from("factures").select("total_ttc").eq("status", "emise"),
        supabase.from("devis").select("status").neq("status", "brouillon").gte("created_at", depuis30j),
        // Le prix d'achat vit dans deux tables satellites fermées au rôle atelier : on l'embarque,
        // et un opérateur reçoit simplement `null` — la carte DLU reste, la valeur du risque non.
        supabase.from("poudre_lots").select("restant_kg, dlu, poudre_lot_couts(prix_kg), poudres(poudre_couts(prix_kg))").not("dlu", "is", null).gt("restant_kg", 0),
        // Le module jantes n'existait pas sur l'écran d'accueil : un jeu promis pour aujourd'hui
        // n'était visible qu'en ouvrant /jantes.
        supabase.from("jeux_jantes").select("statut, date_promise").in("statut", ["recu", "en_cours", "pret"]),
      ]);
      setAtelierNom(a.data?.nom ?? "");
      const total30j = devis30j.data?.length ?? 0;
      const signes30j = (devis30j.data ?? []).filter((x) => x.status === "signe").length;
      // Une poudre périmée n'est plus garantie par le fabricant : c'est une alerte au même titre
      // qu'une rupture de stock, et elle a un coût qu'on chiffre.
      type LotAlerte = { restant_kg: number; dlu: string; poudre_lot_couts: { prix_kg: number | null } | null; poudres: { poudre_couts: { prix_kg: number | null } | null } | null };
      const lotsAlerte = ((lots.data as unknown as LotAlerte[]) ?? []).filter((l) => joursAvantDlu(l.dlu) <= SEUIL_DLU_JOURS);
      const perimes = lotsAlerte.filter((l) => joursAvantDlu(l.dlu) < 0);
      const jeuxOuverts = ((jeux.data as { statut: string; date_promise: string | null }[]) ?? []);
      type LigneDevisEnvoye = { total_ttc: number | string; envoye_at: string | null; created_at: string; validite_jours: number | null };
      const devisBruts = (d.data as LigneDevisEnvoye[]) ?? [];
      // Même définition qu'ailleurs dans le produit (fiche devis, /devis, relancer_devis_et_factures) :
      // devisPerime() est le seul juge, jamais un second calcul de date inventé ici.
      const devisChauds = devisBruts.filter((x) => !devisPerime(x));
      const devisExpires = devisBruts.filter((x) => devisPerime(x));
      setStats({
        devisEnvoyes: devisChauds.length,
        devisMontant: devisChauds.reduce((s, x) => s + Number(x.total_ttc), 0),
        devisExpiresNb: devisExpires.length,
        devisExpiresMontant: devisExpires.reduce((s, x) => s + Number(x.total_ttc), 0),
        projetsEnCours: p.count ?? 0,
        projetsRetard: retard.count ?? 0,
        alertesStock: (poudres.data ?? []).filter((x) => Number(x.stock_kg) <= Number(x.seuil_alerte_kg)).length,
        lotsPerimes: perimes.length,
        lotsBientot: lotsAlerte.length - perimes.length,
        valeurRisque: lotsAlerte.reduce((s, l) => s + Number(l.restant_kg) * Number(l.poudre_lot_couts?.prix_kg ?? l.poudres?.poudre_couts?.prix_kg ?? 0), 0),
        facturesImpayees: factImpayees.data?.length ?? 0,
        facturesMontant: (factImpayees.data ?? []).reduce((s, x) => s + Number(x.total_ttc), 0),
        jeuxEnCours: jeuxOuverts.length,
        jeuxRetard: jeuxOuverts.filter((j) => j.date_promise != null && j.date_promise < aujourdhui).length,
        jeuxAujourdhui: jeuxOuverts.filter((j) => j.date_promise === aujourdhui).length,
        tauxConversion: total30j > 0 ? Math.round((signes30j / total30j) * 100) : null,
        devisSignes30j: signes30j,
        devisTotal30j: total30j,
      });
    })();
    // Le seuil de DLU est un réglage d'atelier : le changer doit recalculer la carte.
  }, [SEUIL_DLU_JOURS]);

  if (!stats) return <Spinner />;

  const aFaire = stats.projetsRetard > 0 || stats.alertesStock > 0 || stats.facturesImpayees > 0 || stats.lotsPerimes > 0 || stats.lotsBientot > 0 || stats.jeuxRetard > 0 || stats.jeuxAujourdhui > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Le nom de l'atelier n'est pas un titre de page : il dit où on est, pas ce qu'on regarde. */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-gray-900">Aujourd&apos;hui à l&apos;atelier</h1>
        {atelierNom && <p className="text-sm text-gray-500">{atelierNom}</p>}
      </div>

      <AstuceEcran cle="dashboard" />
      <ChecklistDemarrage />

      {/* B4 — le chiffre du vendredi soir. Absente pour un compte d'atelier (RPC réservée au
          bureau, cf. src/lib/roles.ts : l'argent d'un côté, la production de l'autre) et tant que
          rien n'est encore chargé — jamais un mois blanc affiché comme un vrai zéro. */}
      {chiffres && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <div className="text-2xl font-bold">{eur(chiffres.facture_ht)}</div>
            <div className="text-xs text-gray-500">Facturé ce mois-ci (HT)</div>
            <Delta valeur={chiffres.facture_ht} precedent={chiffres.facture_ht_mois_precedent} />
          </Card>
          <Card>
            <div className="text-2xl font-bold">{eur(chiffres.encaisse)}</div>
            <div className="text-xs text-gray-500">Encaissé ce mois-ci</div>
            <Delta valeur={chiffres.encaisse} precedent={chiffres.encaisse_mois_precedent} />
          </Card>
          <Card className={chiffres.reste_du > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <div className="text-2xl font-bold">{eur(chiffres.reste_du)}</div>
            <div className="text-xs text-gray-500">Reste dû (toutes factures)</div>
          </Card>
          <Card>
            <div className="text-2xl font-bold">{nombreFr(chiffres.m2_produits, 1)} m²</div>
            <div className="text-xs text-gray-500">Produits ce mois-ci</div>
            <Delta valeur={chiffres.m2_produits} precedent={chiffres.m2_produits_mois_precedent} />
          </Card>
        </div>
      )}

      {aFaire && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="mb-1 text-sm font-semibold text-amber-900">À faire</div>
          <ul className="flex flex-col gap-1 text-sm text-amber-800">
            {stats.projetsRetard > 0 && <li><Link href="/projets" className="underline">{stats.projetsRetard} projet{stats.projetsRetard > 1 ? "s" : ""} en retard sur la date promise</Link></li>}
            {stats.jeuxRetard > 0 && <li><Link href="/jantes" className="underline">{stats.jeuxRetard} jeu{stats.jeuxRetard > 1 ? "x" : ""} de jantes en retard sur la date promise</Link></li>}
            {stats.jeuxAujourdhui > 0 && <li><Link href="/jantes" className="underline">{stats.jeuxAujourdhui} jeu{stats.jeuxAujourdhui > 1 ? "x" : ""} de jantes promis aujourd&apos;hui</Link></li>}
            {stats.alertesStock > 0 && <li><Link href="/stock" className="underline">{stats.alertesStock} poudre{stats.alertesStock > 1 ? "s" : ""} sous le seuil d&apos;alerte</Link></li>}
            {stats.lotsPerimes > 0 && <li><Link href="/lots" className="underline">{stats.lotsPerimes} lot{stats.lotsPerimes > 1 ? "s" : ""} de poudre périmé{stats.lotsPerimes > 1 ? "s" : ""} — rendu non garanti</Link></li>}
            {stats.lotsBientot > 0 && <li><Link href="/lots" className="underline">{stats.lotsBientot} lot{stats.lotsBientot > 1 ? "s" : ""} à écouler sous {SEUIL_DLU_JOURS} jours</Link></li>}
            {(stats.lotsPerimes > 0 || stats.lotsBientot > 0) && stats.valeurRisque > 0 && <li className="text-xs">Stock à risque : {eur(stats.valeurRisque)}</li>}
            {stats.facturesImpayees > 0 && <li><Link href="/factures" className="underline">{stats.facturesImpayees} facture{stats.facturesImpayees > 1 ? "s" : ""} en attente de paiement · {eur(stats.facturesMontant)}</Link></li>}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/devis">
          <Card>
            <div className="text-2xl font-bold">{stats.devisEnvoyes}</div>
            <div className="text-xs text-gray-500">Devis en attente de signature<br/>{eur(stats.devisMontant)}</div>
            {/* Amélioration n°3 — un devis expiré n'est pas mort, il se relance autrement (nouvelle
                version) : on le montre plutôt que de le cacher, sans le compter dans le pipeline chaud. */}
            {stats.devisExpiresNb > 0 && (
              <div className="mt-1 text-xs text-amber-700">
                + {stats.devisExpiresNb} expiré{stats.devisExpiresNb > 1 ? "s" : ""} ({eur(stats.devisExpiresMontant)}) à relancer autrement
              </div>
            )}
          </Card>
        </Link>
        <Link href="/projets"><Card><div className="text-2xl font-bold">{stats.projetsEnCours}</div><div className="text-xs text-gray-500">Projets en cours</div></Card></Link>
        {stats.jeuxEnCours > 0 && (
          <Link href="/jantes"><Card><div className="text-2xl font-bold">{stats.jeuxEnCours}</div><div className="text-xs text-gray-500">Jeux de jantes en atelier</div></Card></Link>
        )}
        <Link href="/factures"><Card className={stats.facturesImpayees ? "border-amber-300 bg-amber-50" : ""}><div className="text-2xl font-bold">{stats.facturesImpayees}</div><div className="text-xs text-gray-500">Factures impayées<br/>{eur(stats.facturesMontant)}</div></Card></Link>
        <Card>
          <div className="text-2xl font-bold">{stats.tauxConversion !== null ? `${stats.tauxConversion}%` : "—"}</div>
          <div className="text-xs text-gray-500">Devis signés (30j){stats.tauxConversion !== null && <><br />{stats.devisSignes30j}/{stats.devisTotal30j} devis</>}</div>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-3 md:max-w-xl">
        <Link href="/devis/new" className="rounded-xl bg-brand p-4 text-center font-medium text-white">+ Nouveau devis</Link>
        <Link href="/projets" className="rounded-xl border border-gray-300 bg-white p-4 text-center font-medium">Ouvrir l&apos;atelier</Link>
      </div>
    </div>
  );
}
