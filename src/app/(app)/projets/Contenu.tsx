"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Paintbrush, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { STATUS_PROJET, dateFr } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { useEtatUrl } from "@/lib/urlState";
import type { Projet } from "@/lib/types";
import AstuceEcran from "@/components/AstuceEcran";

// « Vide » n'apprend rien et décourage : chaque colonne dit ce qui viendra s'y ranger et d'où.
const COLS = [
  { key: "en_attente", label: "À démarrer", vide: "Rien à démarrer. Les devis signés arrivent ici tout seuls." },
  { key: "en_cours", label: "En production", vide: "Aucune pièce en production. Démarrez un projet de la colonne précédente." },
  { key: "pret", label: "Prêt / à livrer", vide: "Rien à livrer. Les projets dont toutes les étapes sont validées arrivent ici." },
] as const;

/**
 * Un projet « à facturer » au sens de Pilotage → Rentabilité (`client_rentabilite.projets_non_
 * factures`) : ni facture émise/payée de type solde ou libre sur son devis ou lui-même, ni bon de
 * livraison déjà rattaché à une facture. Peu importe sa colonne de production — un chantier encore
 * en cours peut déjà porter un acompte facturé sans que le solde le soit.
 */
type ProjetAFacturer = {
  id: string;
  numero: string | null;
  nom: string;
  status: Projet["status"];
  date_promise: string | null;
  client_id: string;
  clients?: { nom: string } | null;
};

export default function ProjetsPage() {
  const [projets, setProjets] = useState<Projet[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Défaut n°2 (recette vague 3) — « Voir les bons de livraison à facturer » depuis Pilotage
  // ouvrait `/bl?filtre=livre`, vide pour les chantiers qui n'ont jamais eu de bon de livraison
  // (certains encore en production). `?filtre=a_facturer` bascule cet écran sur une liste plate de
  // ces projets, interrogée directement plutôt que déduite d'un statut de production.
  const [filtre, setFiltre] = useEtatUrl<"kanban" | "a_facturer">("filtre", "kanban", ["kanban", "a_facturer"]);
  const [clientFiltre, setClientFiltre] = useState<string | null>(null);
  const [nomClientFiltre, setNomClientFiltre] = useState<string | null>(null);
  const [aFacturer, setAFacturer] = useState<ProjetAFacturer[] | null>(null);
  const [erreurAFacturer, setErreurAFacturer] = useState<string | null>(null);

  /**
   * Le tableau de production ne se pagine pas — on ne découpe pas un kanban en pages — mais il
   * ne peut pas non plus rester sans borne : il chargeait `select("*")` sur tous les projets en
   * cours, lignes de pièces et étapes comprises. Ici, les seules colonnes affichées, et un
   * plafond serveur assez haut pour couvrir l'encours réel d'un atelier (les projets terminés
   * partent dans l'historique, lui paginé).
   *
   * L'erreur est lue, et c'est le point important. Le `.then(({ data }) => …)` d'origine
   * ignorait `error` : un réseau coupé dans un bâtiment métallique, un abonnement expiré ou un
   * refus RLS ramenaient `data = null`, donc **zéro projet**, donc un atelier vide et son état
   * vide encourageant — « Aucun projet en cours. Faites un devis. » L'écran principal de la
   * production affirmait, faux, que l'atelier n'avait rien à faire.
   */
  function charger() {
    setErreur(null);
    createClient()
      .from("projets")
      .select("id, numero, nom, status, etapes, etape_courante, date_promise, clients(nom)")
      .in("status", ["en_attente", "en_cours", "pret"])
      .order("date_promise", { ascending: true, nullsFirst: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) { setErreur(errorFr(error)); setProjets(null); return; }
        setProjets((data as unknown as Projet[]) ?? []);
      });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  // `?client=<id>` : le chemin ouvert depuis Pilotage → Rentabilité client sur un chantier sans
  // bon de livraison. Lu à la main plutôt qu'avec `useSearchParams()`, comme `/bl?client=` et pour
  // la même raison — ne pas imposer de frontière `<Suspense>` à une page qui n'en a pas besoin.
  useEffect(() => {
    const cible = new URLSearchParams(window.location.search).get("client");
    if (!cible) return;
    setClientFiltre(cible);
    createClient().from("clients").select("nom").eq("id", cible).maybeSingle()
      .then(({ data }) => setNomClientFiltre((data as { nom: string } | null)?.nom ?? null));
  }, []);

  /**
   * Reproduit, projet par projet, la règle de `client_rentabilite.projets_non_factures` : un
   * projet compte comme non facturé s'il n'a ni facture émise/payée de type solde ou libre
   * (directement, ou via son devis), ni bon de livraison déjà rattaché à une facture. La vue SQL
   * l'agrège par client ; ici on veut la liste des projets eux-mêmes, celle que le bandeau de
   * Pilotage promet et que `/bl` ne peut pas montrer puisqu'aucun bon n'existe pour eux.
   */
  function chargerAFacturer() {
    setErreurAFacturer(null);
    const supabase = createClient();
    let requete = supabase
      .from("projets")
      .select("id, numero, nom, status, date_promise, devis_id, client_id, clients(nom)")
      .neq("status", "annule")
      .not("client_id", "is", null);
    if (clientFiltre) requete = requete.eq("client_id", clientFiltre);
    requete.limit(300).then(async ({ data: p, error: errProjets }) => {
      if (errProjets) { setErreurAFacturer(errorFr(errProjets)); setAFacturer(null); return; }
      const liste = (p as unknown as (ProjetAFacturer & { devis_id: string | null })[]) ?? [];
      if (liste.length === 0) { setAFacturer([]); return; }
      const ids = liste.map((l) => l.id);
      const devisIds = liste.map((l) => l.devis_id).filter((d): d is string => !!d);
      // Deux requêtes simples plutôt qu'un `.or()` construit à la main : les identifiants sont des
      // UUID, donc sans risque d'injection dans la chaîne PostgREST, mais un simple `.in()` reste
      // plus lisible et n'a pas à traiter le cas « aucun devis parmi ces projets ».
      const [{ data: facturesParProjet, error: errFp }, { data: facturesParDevis, error: errFd }, { data: bls, error: errBl }] = await Promise.all([
        supabase.from("factures").select("projet_id")
          .in("status", ["emise", "payee"]).in("type", ["solde", "libre"]).in("projet_id", ids),
        devisIds.length
          ? supabase.from("factures").select("devis_id")
              .in("status", ["emise", "payee"]).in("type", ["solde", "libre"]).in("devis_id", devisIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("bons_livraison").select("projet_id").in("projet_id", ids).not("facture_id", "is", null),
      ]);
      if (errFp || errFd || errBl) { setErreurAFacturer(errorFr(errFp ?? errFd ?? errBl)); setAFacturer(null); return; }
      const projetsFactures = new Set((facturesParProjet ?? []).map((f) => f.projet_id).filter(Boolean));
      const devisFactures = new Set((facturesParDevis ?? []).map((f) => f.devis_id).filter(Boolean));
      const projetsAvecBlFacture = new Set((bls ?? []).map((b) => b.projet_id));
      setAFacturer(
        liste.filter((l) =>
          !projetsFactures.has(l.id) &&
          !(l.devis_id && devisFactures.has(l.devis_id)) &&
          !projetsAvecBlFacture.has(l.id)
        )
      );
    });
  }
  useEffect(() => {
    if (filtre === "a_facturer") chargerAFacturer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtre, clientFiltre]);

  useTitreDocument("Projets");

  if (erreur) {
    return (
      <div className="flex flex-col gap-3">
        <PageTitle>Projets en atelier</PageTitle>
        <Card className="flex flex-col items-center gap-3 border-danger-200 bg-danger-50 p-6 text-center">
          <AlertTriangle size={28} aria-hidden className="text-danger" />
          <p className="text-sm font-semibold text-danger-dark">Impossible de charger le tableau de production.</p>
          <p className="text-sm text-danger-dark" role="alert">{erreur}</p>
          <p className="text-xs text-gray-600">
            Vos projets sont intacts : c&apos;est leur affichage qui n&apos;a pas abouti. Vérifiez votre
            connexion, puis réessayez.
          </p>
          <Button onClick={charger}>Réessayer</Button>
        </Card>
      </div>
    );
  }
  if (!projets) return <Spinner />;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      {/* Le titre reprend le libellé du menu : « Atelier » sur un écran qu'on ouvre en cliquant
          sur « Projets » oblige à vérifier qu'on est au bon endroit. */}
      <PageTitle
        action={
          <Link
            href="/pointage"
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium transition duration-150 ease-out hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Timer size={16} aria-hidden /> Chronomètre d&apos;équipe
          </Link>
        }
      >
        Projets en atelier
      </PageTitle>
      <AstuceEcran cle="projets" />

      {filtre === "a_facturer" && (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-wrap items-center justify-between gap-2 border-amber-300 bg-amber-50">
            <p className="text-sm text-amber-900">
              {clientFiltre
                ? `Chantiers de ${nomClientFiltre ?? "ce client"} non facturés — quelle que soit leur avancée en production, aucun n'a encore de facture de solde ni de bon de livraison facturé.`
                : "Chantiers non facturés, tous clients confondus — quelle que soit leur avancée en production."}
              {" "}Ils n&apos;ont jamais eu de bon de livraison : c&apos;est pour ça que <Link href="/bl" className="underline">Bons de livraison</Link> ne peut pas les montrer.
            </p>
            {/* Bouton, pas `Link` : changer de filtre est un changement d'état de cet écran
                (`useEtatUrl`), pas une navigation vers une autre page — même motif que « Retirer
                le filtre » sur /bl. */}
            <button
              type="button"
              onClick={() => { setFiltre("kanban"); setClientFiltre(null); }}
              className="min-h-[44px] text-sm font-medium text-amber-900 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              ← Retour au tableau de production
            </button>
          </Card>

          {erreurAFacturer && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{erreurAFacturer}</Card>}
          {!aFacturer ? (
            <Spinner />
          ) : aFacturer.length === 0 ? (
            <Empty>
              {clientFiltre ? "Aucun chantier à facturer pour ce client." : "Aucun chantier à facturer."}
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {aFacturer.map((p) => (
                <Link key={p.id} href={`/projets/${p.id}`}>
                  <Card className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.numero} · {p.clients?.nom}</div>
                      <div className="truncate text-xs text-gray-500">
                        {p.nom}
                        {p.date_promise && ` · promis le ${dateFr(p.date_promise)}`}
                      </div>
                    </div>
                    <Badge tone={STATUS_PROJET[p.status].ton}>{STATUS_PROJET[p.status].label}</Badge>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {filtre === "kanban" && (
        <>
          <p className="-mt-1 text-xs text-gray-500">
            Le chronomètre d&apos;équipe sert à pointer plusieurs pièces à la fois sur un même poste.
          </p>
          {projets.length === 0 && (
            <Empty
              icon={<Paintbrush size={28} aria-hidden />}
              action={<Link href="/devis/new" className="inline-flex min-h-[44px] items-center rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white transition duration-150 ease-out hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Faire un devis</Link>}
            >
              Aucun projet en cours. Un devis signé crée son projet tout seul et il apparaît ici.
            </Empty>
          )}
          {/* Mobile : colonnes en défilement horizontal (largeur fixe, adaptée au pouce).
              Bureau : les 3 colonnes s'affichent côte à côte sans défilement, chacune prenant
              sa part de la largeur disponible. */}
          <div className="flex snap-x gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
            {COLS.map((col) => {
              const items = projets.filter((p) => p.status === col.key);
              return (
                // `w-[85vw] max-w-[320px]` plutôt que `w-[280px]` : sur un iPhone SE (375 px de large,
                // moins 2 × 12 px de marge = 351 px utiles), une colonne de 280 px laissait
                // « Métallerie du Sud · Garde-corps » se couper en trois lignes. La colonne suit
                // maintenant la largeur de l'écran, avec un aperçu de la suivante qui indique qu'on
                // peut faire défiler, et un plafond pour les grands téléphones.
                <div key={col.key} className="w-[85vw] max-w-[320px] flex-shrink-0 snap-start md:w-auto md:max-w-none md:flex-shrink md:snap-none">
                  <div className="mb-2 text-sm font-semibold text-gray-600">{col.label} <span className="text-gray-500">({items.length})</span></div>
                  <div className="flex flex-col gap-2">
                    {items.map((p) => (
                      <Link key={p.id} href={`/projets/${p.id}`}>
                        <Card className={p.date_promise && p.date_promise < today ? "border-danger-200" : ""}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate font-medium">{p.numero}</div>
                            {/* Libellé de l'étape, pas son code technique : « controle » n'est pas
                                un mot que l'atelier doit lire sur son tableau de production. */}
                            <Badge tone={STATUS_PROJET[p.status].ton}>{p.etapes?.find((e) => e.code === p.etape_courante)?.libelle ?? p.etape_courante ?? "—"}</Badge>
                          </div>
                          <div className="break-words text-xs text-gray-500">{p.clients?.nom} · {p.nom}</div>
                          {p.date_promise && <div className={`mt-1 text-xs ${p.date_promise < today ? "font-semibold text-danger" : "text-gray-500"}`}>Promis le {dateFr(p.date_promise)}</div>}
                        </Card>
                      </Link>
                    ))}
                    {items.length === 0 && <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs leading-relaxed text-gray-500">{col.vide}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/projets/histo" className="rounded py-2 text-center text-sm text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Voir les projets livrés →</Link>
        </>
      )}
    </div>
  );
}
