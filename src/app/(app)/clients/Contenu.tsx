"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, Empty, Input, PageTitle, Spinner } from "@/components/ui";
import { Filtres, Pagination, Tri, useListePaginee } from "@/components/Pagination";
import { MIN_CARACTERES, REBOND_MS, motifLike } from "@/lib/recherche";
import { useEtatUrl } from "@/lib/urlState";
import { useTitreDocument } from "@/lib/titre";

/**
 * Liste des clients.
 *
 * Elle chargeait **tout l'atelier** avec `select("*")` puis filtrait dans le navigateur sur le
 * seul champ `nom` : mesuré à 3 000 clients, 2,6 Mo de JSON téléchargés sur la 4G de l'atelier
 * pour afficher trente cartes. Tout se passe désormais en base — la recherche comprise, qui porte
 * maintenant sur le nom, le contact, la ville, le téléphone, l'e-mail et le SIREN, accents
 * ignorés, grâce à la colonne `recherche` alimentée par la base.
 */
const COLONNES = "id, nom, type, ville, telephone, email, archive";
type ClientListe = {
  id: string;
  nom: string;
  type: "particulier" | "pro";
  ville: string | null;
  telephone: string | null;
  email: string | null;
};

const FILTRES = [
  { valeur: "actifs", libelle: "Actifs" },
  { valeur: "pro", libelle: "Professionnels" },
  { valeur: "particulier", libelle: "Particuliers" },
  { valeur: "archives", libelle: "Archivés" },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];
const VALEURS_FILTRE: readonly Filtre[] = FILTRES.map((f) => f.valeur);

const TRIS = [
  { valeur: "nom", libelle: "Nom", colonne: "nom", croissant: true },
  { valeur: "recent", libelle: "Ajout récent", colonne: "created_at", croissant: false },
] as const;
type TriClients = (typeof TRIS)[number]["valeur"];

export default function ClientsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  // D10 — le filtre vit dans l'URL (`?filtre=`), comme sur /devis, /factures, /bl et /jantes.
  const [filtre, setFiltre] = useEtatUrl<Filtre>("filtre", "actifs", VALEURS_FILTRE);
  const [tri, setTri] = useState<TriClients>("nom");

  // Anti-rebond : une requête par mot tapé, pas une par lettre.
  useEffect(() => {
    const m = setTimeout(() => setQ(saisie.trim()), REBOND_MS);
    return () => clearTimeout(m);
  }, [saisie]);

  const charger = useCallback((de: number, a: number) => {
    const t = TRIS.find((x) => x.valeur === tri)!;
    let requete = supabase.from("clients").select(COLONNES, { count: "exact" });
    requete = filtre === "archives" ? requete.eq("archive", true) : requete.eq("archive", false);
    if (filtre === "pro" || filtre === "particulier") requete = requete.eq("type", filtre);
    // `recherche` est la colonne normalisée (minuscules, sans accents) calculée par la base :
    // « Gonçalves », « goncalves » et « GONCALVES » désignent la même fiche. Le motif est
    // normalisé du même geste côté navigateur, sinon les deux formes ne se rencontrent jamais.
    if (q.length >= MIN_CARACTERES) requete = requete.like("recherche", motifLike(q));
    return requete.order(t.colonne, { ascending: t.croissant }).range(de, a);
  }, [supabase, filtre, tri, q]);

  const liste = useListePaginee<ClientListe>(charger, `${filtre}|${tri}|${q}`);

  useTitreDocument("Clients");

  return (
    <div className="flex flex-col gap-3">
      <PageTitle action={<Link href="/clients/new" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ Client</Link>}>Clients</PageTitle>

      <label className="relative block">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Nom, ville, téléphone, e-mail, SIREN…"
          aria-label="Rechercher un client"
          className="min-h-[48px] pl-10"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Filtres label="Filtrer les clients" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />
        <Tri valeur={tri} onChange={setTri} options={TRIS.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))} />
      </div>

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty
          icon={<Users size={28} aria-hidden />}
          action={q ? undefined : <Link href="/clients/new" className="rounded-lg bg-brand min-h-[44px] px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Ajouter un client</Link>}
        >
          {q
            ? `Aucun client ne correspond à « ${q} ». Les accents sont ignorés : essayez la ville, le téléphone ou le SIREN.`
            : "Aucun client pour l'instant. Ajoutez votre premier client pour créer un devis."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.lignes.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.nom}</div>
                  <div className="truncate text-xs text-gray-500">{[c.telephone, c.ville].filter(Boolean).join(" · ") || c.email || ""}</div>
                </div>
                <Badge tone={c.type === "pro" ? "info" : "neutral"}>{c.type === "pro" ? "Pro" : "Particulier"}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="clients" />
    </div>
  );
}
