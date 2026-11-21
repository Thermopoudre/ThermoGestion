"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Empty, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { Filtres, Pagination, Tri, useListePaginee } from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import { usePlan } from "@/components/PlanProvider";
import { VerrouCarte } from "@/components/VerrouPlan";
import { STATUS_FACTURE, dateFr, eur, factureEchue } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { useEtatUrl } from "@/lib/urlState";
import type { Client, Facture } from "@/lib/types";
import AstuceEcran from "@/components/AstuceEcran";

/** Les seules colonnes affichées par la liste : les lignes et la remise ne servent qu'à la fiche. */
const COLONNES = "id, numero, status, type, total_ttc, due_date, created_at, recapitulative, periode_debut, periode_fin, clients(nom)";
type FactureListe = {
  id: string;
  numero: string | null;
  status: Facture["status"];
  type: Facture["type"];
  total_ttc: number | string;
  due_date: string | null;
  created_at: string;
  recapitulative: boolean | null;
  periode_debut: string | null;
  periode_fin: string | null;
  clients: { nom: string } | null;
};

/** Une ligne de `balance_agee()` (C3) — le reste dû d'un client, réparti par tranche de retard. */
type BalanceAgeeLigne = {
  client_id: string;
  nom: string;
  tranche_0_30: number | string;
  tranche_31_60: number | string;
  tranche_61_90: number | string;
  tranche_plus_90: number | string;
  total_du: number | string;
};

/** Le filtre part en base : « Toutes » ne peut plus vouloir dire « les 200 déjà chargées ». */
const FILTRES = [
  { valeur: "actives", libelle: "En cours", statuts: ["brouillon", "emise"] },
  { valeur: "payee", libelle: "Payées", statuts: ["payee"] },
  { valeur: "annulee", libelle: "Annulées", statuts: ["annulee"] },
  { valeur: "tous", libelle: "Toutes", statuts: null },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];
const VALEURS_FILTRE: readonly Filtre[] = FILTRES.map((f) => f.valeur);

const TRIS = [
  { valeur: "recent", libelle: "Plus récentes", colonne: "created_at", croissant: false },
  { valeur: "echeance", libelle: "Échéance", colonne: "due_date", croissant: true },
  { valeur: "montant", libelle: "Montant", colonne: "total_ttc", croissant: false },
] as const;
type TriFactures = (typeof TRIS)[number]["valeur"];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Le récapitulatif se fait toujours « au mois échu » : on facture en début de mois
 * ce qui a été livré le mois d'avant. C'est la valeur par défaut attendue par l'atelier.
 */
function moisPrecedent() {
  const now = new Date();
  return {
    debut: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    fin: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}

export default function FacturesListPage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const router = useRouter();
  // `ouvert` est déjà pris par l'état du panneau : on renomme le droit pour ne pas cacher l'un
  // derrière l'autre — c'est exactement ce genre de collision qui produit un verrou inopérant.
  const { ouvert: ouvert2 } = usePlan();
  // D10 — le filtre vit dans l'URL (`?filtre=`), comme sur /devis et /bl.
  const [filtre, setFiltre] = useEtatUrl<Filtre>("filtre", "actives", VALEURS_FILTRE);
  const [tri, setTri] = useState<TriFactures>("recent");

  // Panneau « récapitulatif mensuel »
  const [ouvert, setOuvert] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [periode, setPeriode] = useState(moisPrecedent);
  const [nbBl, setNbBl] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Export comptable : par défaut le mois précédent, période que l'atelier transmet chaque mois
  // à son expert-comptable.
  const [exportOuvert, setExportOuvert] = useState(false);
  const [periodeExport, setPeriodeExport] = useState(moisPrecedent);

  const charger = useCallback((de: number, a: number) => {
    const statuts = FILTRES.find((f) => f.valeur === filtre)?.statuts;
    const t = TRIS.find((x) => x.valeur === tri)!;
    let requete = supabase.from("factures").select(COLONNES, { count: "exact" });
    if (statuts) requete = requete.in("status", [...statuts]);
    // Une facture sans échéance ne doit pas remonter en tête du classement par échéance : elle
    // n'est pas « la plus urgente », elle n'en a simplement pas.
    return requete.order(t.colonne, { ascending: t.croissant, nullsFirst: false }).range(de, a);
  }, [supabase, filtre, tri]);

  const liste = useListePaginee<FactureListe>(charger, `${filtre}|${tri}`);

  useTitreDocument("Factures");

  // B4 — le pied de liste : facturé, encaissé, reste dû sur le filtre courant. Recalculé sur toute
  // la sélection filtrée en base (`totaux_factures`), pas seulement sur les lignes de la page
  // affichée — sinon le total change en tournant les pages, ce qui est pire qu'aucun total.
  const [totaux, setTotaux] = useState<{ facture_ht: number; facture_ttc: number; encaisse: number; reste_du: number } | null>(null);
  useEffect(() => {
    const statuts = FILTRES.find((f) => f.valeur === filtre)?.statuts;
    supabase.rpc("totaux_factures", { p_statuts: statuts ? [...statuts] : null }).maybeSingle().then(({ data }) => {
      setTotaux((data as typeof totaux) ?? null);
    });
  }, [supabase, filtre]);

  // C3 — balance âgée : le retard par client, en tranches. Chargée une fois, indépendamment du
  // filtre de la liste (elle porte sur le reste dû, pas sur le statut affiché).
  const [balance, setBalance] = useState<BalanceAgeeLigne[] | null>(null);
  const [balanceOuverte, setBalanceOuverte] = useState(false);
  useEffect(() => {
    supabase.rpc("balance_agee").then(({ data }) => setBalance((data as BalanceAgeeLigne[]) ?? []));
  }, [supabase]);

  // Les clients en facturation mensuelle sont proposés en premier : ce sont eux qui
  // réclament une facture unique en fin de mois plutôt qu'une facture par livraison. On ne charge
  // que ce que le sélecteur affiche, et seulement à l'ouverture du panneau.
  useEffect(() => {
    if (!ouvert || clients.length) return;
    supabase
      .from("clients")
      .select("id, nom, facturation_mensuelle")
      .eq("archive", false)
      .order("facturation_mensuelle", { ascending: false })
      .order("nom")
      .limit(500)
      .then(({ data }) => {
        const cs = (data as unknown as Client[]) ?? [];
        setClients(cs);
        const mensuel = cs.find((c) => c.facturation_mensuelle);
        if (mensuel) setClientId(mensuel.id);
      });
  }, [ouvert, clients.length, supabase]);

  // Compte des BL éligibles : évite de lancer une génération qui ne produira rien.
  useEffect(() => {
    if (!ouvert || !clientId) {
      setNbBl(null);
      return;
    }
    let annule = false;
    supabase
      .from("bons_livraison")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "livre")
      .is("facture_id", null)
      .gte("livre_at", periode.debut)
      .lte("livre_at", `${periode.fin}T23:59:59`)
      .then(({ count }) => {
        if (!annule) setNbBl(count ?? 0);
      });
    return () => {
      annule = true;
    };
  }, [ouvert, clientId, periode.debut, periode.fin, supabase]);

  async function genererRecap() {
    setBusy(true);
    const { data, error } = await supabase.rpc("facture_recapitulative", {
      p_client: clientId,
      p_debut: periode.debut,
      p_fin: periode.fin,
    });
    setBusy(false);
    if (error) {
      const aucunBl = /aucun bon de livraison/i.test(error.message ?? "");
      toast(
        aucunBl
          ? "Aucun bon de livraison livré et non facturé sur cette période. Vérifiez que les BL sont bien passés au statut « Livré »."
          : errorFr(error),
        "error"
      );
      return;
    }
    toast("Facture récapitulative créée en brouillon.");
    router.push(`/factures/${data}`);
  }

  const recapOuverte = ouvert2("facturation_mensuelle");
  const mensuels = clients.filter((c) => c.facturation_mensuelle);
  const autres = clients.filter((c) => !c.facturation_mensuelle);

  return (
    <div className="flex flex-col gap-3">
      <PageTitle action={<Link href="/factures/new" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">+ Facture</Link>}>Factures</PageTitle>
      <AstuceEcran cle="factures" />

      {/* C3 — balance âgée : qui doit quoi, depuis combien de temps. `balance` reste `[]` (pas
          `null`) pour un compte sans droit commercial ou sans retard : la carte se masque, elle ne
          reste pas coincée en chargement. */}
      {balance && balance.length > 0 && (
        <Card className="flex flex-col gap-2">
          <button
            type="button"
            className="flex items-center justify-between text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onClick={() => setBalanceOuverte((o) => !o)}
          >
            <span>Balance âgée — {eur(balance.reduce((s, l) => s + Number(l.total_du), 0))} de retard sur {balance.length} client{balance.length > 1 ? "s" : ""}</span>
            <span className="text-xs font-normal text-brand underline underline-offset-2">{balanceOuverte ? "Masquer" : "Détail"}</span>
          </button>
          {balanceOuverte && (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="py-1.5">Client</th>
                    <th className="py-1.5 text-right">0-30 j</th>
                    <th className="py-1.5 text-right">31-60 j</th>
                    <th className="py-1.5 text-right">61-90 j</th>
                    <th className="py-1.5 text-right">90+ j</th>
                    <th className="py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.map((l) => (
                    <tr key={l.client_id} className="border-b border-gray-100">
                      <td className="py-1.5"><Link href={`/clients/${l.client_id}`} className="underline underline-offset-2">{l.nom}</Link></td>
                      <td className="py-1.5 text-right text-gray-600">{Number(l.tranche_0_30) > 0 ? eur(l.tranche_0_30) : "—"}</td>
                      <td className="py-1.5 text-right text-amber-700">{Number(l.tranche_31_60) > 0 ? eur(l.tranche_31_60) : "—"}</td>
                      <td className="py-1.5 text-right text-danger">{Number(l.tranche_61_90) > 0 ? eur(l.tranche_61_90) : "—"}</td>
                      <td className="py-1.5 text-right font-semibold text-danger-dark">{Number(l.tranche_plus_90) > 0 ? eur(l.tranche_plus_90) : "—"}</td>
                      <td className="py-1.5 text-right font-semibold">{eur(l.total_du)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {/* D13 — les deux boutons retombaient tous les deux sur le seul mot « Fermer » une fois
            ouverts : côte à côte, rien ne distinguait plus lequel des deux panneaux chacun
            refermait. Le libellé reste spécifique dans les deux états. */}
        <Button variant="secondary" className="flex items-center gap-2 py-3 text-base" onClick={() => setOuvert(!ouvert)}>
          <CalendarDays size={18} aria-hidden /> {ouvert ? "Fermer le récapitulatif" : "Facture récapitulative du mois"}
          {!recapOuverte && <Lock size={14} aria-hidden className="text-gray-400" />}
        </Button>
        <Button variant="secondary" className="flex items-center gap-2 py-3 text-base" onClick={() => setExportOuvert(!exportOuvert)}>
          <BarChart3 size={18} aria-hidden /> {exportOuvert ? "Fermer l'export" : "Export comptable"}
        </Button>
      </div>

      {exportOuvert && (
        <Card className="flex flex-col gap-3 border-brand/30">
          <p className="text-xs text-gray-500">
            Toutes les factures <b>émises ou payées</b> de la période, à la date d&apos;émission. Le
            CSV se lit dans un tableur, une ligne par taux de TVA ; le FEC est le fichier
            réglementaire que réclame l&apos;administration en cas de contrôle.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Du" type="date" value={periodeExport.debut} onChange={(e) => setPeriodeExport((x) => ({ ...x, debut: e.target.value }))} />
            <Input label="Au" type="date" value={periodeExport.fin} onChange={(e) => setPeriodeExport((x) => ({ ...x, fin: e.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { format: "csv", libelle: "Télécharger le CSV" },
              { format: "fec", libelle: "Télécharger le FEC" },
            ].map(({ format, libelle }) => (
              <a
                key={format}
                href={`/api/export/comptable?debut=${periodeExport.debut}&fin=${periodeExport.fin}&format=${format}`}
                className="rounded-lg border border-gray-300 bg-white min-h-[44px] px-4 py-3 text-sm font-medium text-gray-800"
              >
                {libelle}
              </a>
            ))}
          </div>
          {/* La suite du parcours : plutôt que de télécharger puis d'envoyer soi-même un fichier
              par courriel tous les mois, on ouvre l'accès au cabinet une fois et on n'y pense
              plus. C'est ici que la question se pose, donc c'est ici que la réponse s'affiche. */}
          <p className="text-xs text-gray-600">
            Vous pouvez aussi ouvrir un accès gratuit à votre expert-comptable : il récupère lui-même
            ses écritures, période par période, sans vous les réclamer.{" "}
            <Link href="/comptable" className="font-medium text-brand underline">
              Voir l&apos;espace comptable →
            </Link>
          </p>
        </Card>
      )}

      {ouvert && !recapOuverte && <VerrouCarte capacite="facturation_mensuelle" />}

      {ouvert && recapOuverte && (
        <Card className="flex flex-col gap-3 border-brand/30">
          <p className="text-xs text-gray-500">
            Regroupe tous les bons de livraison livrés et non encore facturés du client sur la période, en une seule facture.
          </p>
          <Select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— Choisissez un client —</option>
            {mensuels.length > 0 && (
              <optgroup label="Facturation mensuelle">
                {mensuels.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </optgroup>
            )}
            {autres.length > 0 && (
              <optgroup label="Autres clients">
                {autres.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </optgroup>
            )}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Du" type="date" value={periode.debut} onChange={(e) => setPeriode((p) => ({ ...p, debut: e.target.value }))} />
            <Input label="Au" type="date" value={periode.fin} onChange={(e) => setPeriode((p) => ({ ...p, fin: e.target.value }))} />
          </div>
          {clientId && nbBl !== null && (
            <p className={`text-sm ${nbBl === 0 ? "text-amber-700" : "text-gray-600"}`}>
              {nbBl === 0 ? (
                <>
                  Aucun bon de livraison à facturer sur cette période.{" "}
                  <Link href="/bl" className="font-medium underline">Voir les bons de livraison →</Link>
                </>
              ) : (
                `${nbBl} bon${nbBl > 1 ? "s" : ""} de livraison ${nbBl > 1 ? "seront regroupés" : "sera repris"} sur la facture.`
              )}
            </p>
          )}
          <Button taille="xl" loading={busy} disabled={!clientId || nbBl === 0} onClick={genererRecap}>
            {busy ? "…" : "Générer la facture récapitulative"}
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Filtres label="Filtrer les factures" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />
        <Tri valeur={tri} onChange={setTri} options={TRIS.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))} />
      </div>

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty>
          {filtre === "tous"
            ? "Aucune facture pour l'instant. Générez-en une depuis un devis signé, ou créez-en une libre."
            : "Aucune facture avec ce filtre. Essayez « Toutes » — l'historique complet reste consultable, page par page."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.lignes.map((f) => {
            // D11 — une échéance dépassée restait affichée en gris comme les autres, alors que le
            // kanban de l'atelier passe déjà au rouge sur le même retard (voir `factureEchue`).
            const echue = factureEchue(f);
            return (
              <Link key={f.id} href={`/factures/${f.id}`}>
                <Card className={`flex items-center justify-between gap-3 ${echue ? "border-danger" : ""}`}>
                  <div className="min-w-0">
                    {/* Audit design du 20/11/2026 : numéro et client sur une seule ligne tronquée
                        coupaient le nom du client au téléphone, alors que c'est lui qu'on cherche. */}
                    <div className="truncate font-medium">
                      {f.numero ?? "Brouillon"}
                      {f.recapitulative && <Badge tone="info" className="ml-2">Récap</Badge>}
                    </div>
                    <div className="truncate text-sm text-gray-700">{f.clients?.nom}</div>
                    <div className={`text-xs ${echue ? "font-medium text-danger-dark" : "text-gray-500"}`}>
                      {f.recapitulative && f.periode_debut
                        ? `${dateFr(f.periode_debut)} → ${dateFr(f.periode_fin)}`
                        : dateFr(f.created_at)}
                      {" · "}{eur(f.total_ttc)} TTC
                      {f.due_date ? ` · ${echue ? "échue le" : "échéance"} ${dateFr(f.due_date)}` : ""}
                    </div>
                  </div>
                  <Badge tone={echue ? "danger" : STATUS_FACTURE[f.status].ton}>{echue ? "Échue" : STATUS_FACTURE[f.status].label}</Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="factures" />

      {totaux && (
        <Card className="grid grid-cols-3 gap-3 border-gray-300 bg-gray-50 text-center">
          <div>
            {/* Audit du 21/11/2026 : « Facturé HT » à côté d'un encaissé et d'un reste dû TTC
                faisait une addition fausse à l'œil (1 527 € HT ≠ 0 € + 1 832 €). Les trois
                montants sont en TTC ; le HT reste écrit dessous pour le chiffre d'affaires. */}
            <div className="text-lg font-bold">{eur(totaux.facture_ttc)}</div>
            <div className="text-xs text-gray-500">Facturé TTC · {eur(totaux.facture_ht)} HT</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-700">{eur(totaux.encaisse)}</div>
            <div className="text-xs text-gray-500">Encaissé</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${totaux.reste_du > 0 ? "text-red-700" : ""}`}>{eur(totaux.reste_du)}</div>
            <div className="text-xs text-gray-500">Reste dû</div>
          </div>
        </Card>
      )}
    </div>
  );
}
