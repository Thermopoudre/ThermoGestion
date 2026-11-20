"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { Filtres, Pagination, Tri, useListePaginee } from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { STATUS_DEVIS, dateFr, eur } from "@/lib/utils";
import { useEtatUrl } from "@/lib/urlState";
import { devisPerime, echeanceDevisAffichable } from "@/lib/devis";
import AstuceEcran from "@/components/AstuceEcran";

/**
 * Les seules colonnes affichées par la liste. Le reste — items, notes, signature, jeton public —
 * ne sert qu'à la fiche. `envoye_at` et `validite_jours` s'y ajoutent depuis la migration 45 :
 * l'échéance de validité se calcule à partir d'eux, et un devis qui approche de sa date doit se
 * repérer depuis la liste, pas en ouvrant les douze fiches une par une.
 */
const COLONNES = "id, numero, status, total_ttc, created_at, envoye_at, validite_jours, clients(nom)";
type DevisListe = {
  id: string;
  numero: string | null;
  status: keyof typeof STATUS_DEVIS;
  total_ttc: number | string;
  created_at: string;
  envoye_at: string | null;
  validite_jours: number;
  clients: { nom: string } | null;
};

/** Le filtre est traduit en clause SQL, pas en `Array.filter` : « Tous » veut dire tous. */
const FILTRES = [
  { valeur: "actifs", libelle: "En cours", statuts: ["brouillon", "envoye"] },
  { valeur: "signe", libelle: "Signés", statuts: ["signe"] },
  { valeur: "refuse", libelle: "Refusés / expirés", statuts: ["refuse", "expire"] },
  { valeur: "tous", libelle: "Tous", statuts: null },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];
const VALEURS_FILTRE: readonly Filtre[] = FILTRES.map((f) => f.valeur);

const TRIS = [
  { valeur: "recent", libelle: "Plus récents", colonne: "created_at", croissant: false },
  { valeur: "ancien", libelle: "Plus anciens", colonne: "created_at", croissant: true },
  { valeur: "montant", libelle: "Montant", colonne: "total_ttc", croissant: false },
] as const;
type TriDevis = (typeof TRIS)[number]["valeur"];

export default function DevisListPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const toast = useToast();
  // D10 — le filtre vit dans l'URL (`?filtre=`) : un lien « Devis signés » doit ouvrir la liste
  // déjà filtrée, et Précédent doit pouvoir y revenir plutôt que de quitter la page entière.
  const [filtre, setFiltre] = useEtatUrl<Filtre>("filtre", "actifs", VALEURS_FILTRE);
  const [tri, setTri] = useState<TriDevis>("recent");
  // B7 — dupliquer depuis la liste, sans ouvrir la fiche. `null` : rien en cours ; sinon l'id du
  // devis dont la copie est en train de se créer, pour ne désactiver que ce bouton-là.
  const [dupliqueId, setDupliqueId] = useState<string | null>(null);

  async function dupliquer(id: string) {
    setDupliqueId(id);
    const { data, error } = await supabase.rpc("dupliquer_devis", { p_id: id });
    setDupliqueId(null);
    if (error) { toast(errorFr(error), "error"); return; }
    toast("Copie créée en brouillon");
    router.push(`/devis/${data as string}`);
  }

  const charger = useCallback((de: number, a: number) => {
    const statuts = FILTRES.find((f) => f.valeur === filtre)?.statuts;
    const t = TRIS.find((x) => x.valeur === tri)!;
    let requete = supabase.from("devis").select(COLONNES, { count: "exact" });
    if (statuts) requete = requete.in("status", [...statuts]);
    return requete.order(t.colonne, { ascending: t.croissant }).range(de, a);
  }, [supabase, filtre, tri]);

  const liste = useListePaginee<DevisListe>(charger, `${filtre}|${tri}`);

  useTitreDocument("Devis");

  return (
    <div className="flex flex-col gap-3">
      <PageTitle action={<Link href="/devis/new" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ Devis</Link>}>Devis</PageTitle>
      <AstuceEcran cle="devis" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Filtres label="Filtrer les devis" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />
        <Tri valeur={tri} onChange={setTri} options={TRIS.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))} />
      </div>

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty>
          {filtre === "tous"
            ? "Aucun devis pour l'instant. Le premier prend 2 minutes, chrono."
            : "Aucun devis avec ce filtre. Essayez « Tous » — la liste entière est consultable, page par page."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.lignes.map((d) => (
            <Card key={d.id} className="flex flex-col gap-2">
              <Link href={`/devis/${d.id}`} className="flex items-center justify-between gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.numero ?? "Brouillon"} · {d.clients?.nom}</div>
                  <div className="text-xs text-gray-500">{dateFr(d.created_at)} · {eur(d.total_ttc)} TTC</div>
                  {/* Un devis encore « envoyé » mais déjà périmé existe entre le franchissement de
                      l'échéance et le passage du cron, à 6 h 50. La liste doit le montrer tel
                      qu'il est signable, pas tel que sa colonne `status` le dit. */}
                  {d.status === "envoye" && (
                    <div className={`text-xs ${devisPerime(d) ? "font-medium text-amber-700" : "text-gray-400"}`}>
                      {devisPerime(d)
                        ? `Validité dépassée le ${dateFr(echeanceDevisAffichable(d))}`
                        : `Signable jusqu'au ${dateFr(echeanceDevisAffichable(d))}`}
                    </div>
                  )}
                </div>
                <Badge tone={STATUS_DEVIS[d.status].ton}>{STATUS_DEVIS[d.status].label}</Badge>
              </Link>
              {/* B7 — la duplication existait sur la fiche seule : pour le client qui recommande
                  le même portail chaque année, ouvrir la fiche pour ne faire que « Dupliquer »
                  était un détour de trois clics à chaque fois. */}
              <div className="flex justify-end border-t border-gray-100 pt-2">
                <Button variant="ghost" onClick={() => dupliquer(d.id)} loading={dupliqueId === d.id} disabled={dupliqueId !== null && dupliqueId !== d.id}>
                  <span className="flex items-center gap-1.5"><Copy size={14} aria-hidden /> Dupliquer</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="devis" />
    </div>
  );
}
