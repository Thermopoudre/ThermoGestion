"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleDot, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Empty, Input, PageTitle, Spinner } from "@/components/ui";
import { Filtres, Pagination, useListePaginee } from "@/components/Pagination";
import { MIN_CARACTERES, REBOND_MS, chiffresSeuls, conditionOu, motifLike, normaliser } from "@/lib/recherche";
import { dateFr, nombreFr } from "@/lib/utils";
import { useEtatUrl } from "@/lib/urlState";
import { useTitreDocument } from "@/lib/titre";
import { STATUTS_JEU, avancementJeu, libelleJeu } from "@/lib/jantes";
import type { Jante, JeuJantes } from "@/lib/types";
import AstuceEcran from "@/components/AstuceEcran";

type JeuListe = JeuJantes & { jantes: Pick<Jante, "statut">[] };

/** Tout ce que la carte affiche, et rien d'autre : ni signature, ni jeton public, ni réserves. */
const COLONNES =
  "id, numero, statut, nb_jantes, diametre_pouces, largeur_pouces, finition, teinte, tpms, date_promise, created_at, client_id, vehicule_id, " +
  "clients(nom), vehicules(marque, modele, annee, immatriculation, teinte_origine, teinte_reference), jantes(statut)";

const FILTRES = [
  { valeur: "atelier", libelle: "En atelier", statuts: ["recu", "en_cours", "pret"] },
  { valeur: "livres", libelle: "Livrés", statuts: ["livre", "annule"] },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];
const VALEURS_FILTRE: readonly Filtre[] = FILTRES.map((f) => f.valeur);

/**
 * Les dossiers jantes en cours, triés par urgence.
 *
 * Un garage choisit son sous-traitant sur le délai : 48 à 72 heures, parce que la voiture est
 * immobilisée. L'écran est donc trié par date promise et non par date de création, et il dit
 * combien de jantes sont prêtes sur le jeu — un jeu à 3/4 n'est pas un jeu prêt.
 */
export default function JantesPage() {
  const supabase = useMemo(() => createClient(), []);
  // D10 — le filtre vit dans l'URL (`?filtre=`), comme sur /devis, /factures et /bl.
  const [filtre, setFiltre] = useEtatUrl<Filtre>("filtre", "atelier", VALEURS_FILTRE);
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  /** Identifiants résolus en amont : le motif peut désigner un client ou une plaque, pas le jeu. */
  const [cibles, setCibles] = useState<{ clients: string[]; vehicules: string[] } | null>(null);

  useEffect(() => {
    const m = setTimeout(() => setQ(saisie.trim()), REBOND_MS);
    return () => clearTimeout(m);
  }, [saisie]);

  /**
   * Le garage appelle en disant « les jantes de la Golf » ou en donnant l'immatriculation. Ces
   * deux informations ne sont pas dans `jeux_jantes` : elles sont dans `vehicules` et `clients`.
   * PostgREST ne sait pas faire un OU textuel à travers une jointure, on résout donc d'abord les
   * deux ensembles d'identifiants — deux requêtes courtes, plafonnées — puis on interroge les
   * jeux avec un OU sur trois critères. Auparavant tout ce filtrage se faisait en mémoire, sur
   * les 100 premiers dossiers seulement.
   */
  useEffect(() => {
    if (q.length < MIN_CARACTERES) { setCibles(null); return; }
    let annule = false;
    const motif = motifLike(q);
    const plaque = `%${normaliser(q).replace(/[^a-z0-9]/g, "")}%`;
    const chiffres = chiffresSeuls(q);
    (async () => {
      const [cli, veh] = await Promise.all([
        supabase.from("clients").select("id").like("recherche", motif).limit(100),
        supabase.from("vehicules").select("id")
          .or([conditionOu("recherche", q), `recherche.like."${plaque}"`, ...(chiffres ? [`recherche.like."%${chiffres}%"`] : [])].join(","))
          .limit(100),
      ]);
      if (annule) return;
      setCibles({
        clients: ((cli.data ?? []) as { id: string }[]).map((x) => x.id),
        vehicules: ((veh.data ?? []) as { id: string }[]).map((x) => x.id),
      });
    })();
    return () => { annule = true; };
  }, [supabase, q]);

  const charger = useCallback((de: number, a: number) => {
    const statuts = FILTRES.find((f) => f.valeur === filtre)!.statuts;
    let requete = supabase.from("jeux_jantes").select(COLONNES, { count: "exact" }).in("statut", [...statuts]);
    if (q.length >= MIN_CARACTERES) {
      const ou = [conditionOu("recherche", q)];
      if (cibles?.clients.length) ou.push(`client_id.in.(${cibles.clients.join(",")})`);
      if (cibles?.vehicules.length) ou.push(`vehicule_id.in.(${cibles.vehicules.join(",")})`);
      requete = requete.or(ou.join(","));
    }
    return requete
      .order("date_promise", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(de, a);
  }, [supabase, filtre, q, cibles]);

  // La clé inclut les cibles résolues : sans elles, la liste se rechargerait avant que les
  // identifiants de clients et de véhicules soient connus, et n'afficherait que les jeux dont le
  // numéro correspond.
  const liste = useListePaginee<JeuListe>(
    charger,
    `${filtre}|${q}|${cibles ? `${cibles.clients.length}-${cibles.vehicules.length}` : ""}`,
  );
  const chercheEnCours = q.length >= MIN_CARACTERES && cibles === null;

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const jeuxFiltres = liste.lignes ?? [];

  useTitreDocument("Jantes");

  return (
    <div>
      <PageTitle action={<Link href="/jantes/new"><Button>+ Nouveau jeu</Button></Link>}>Jantes</PageTitle>
      <AstuceEcran cle="jantes" />

      <div className="mb-3">
        <Filtres label="Filtrer les jeux de jantes" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />
      </div>

      <label className="relative mb-3 block">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Client, marque, modèle, immatriculation, n° de dossier…"
          aria-label="Rechercher un jeu de jantes"
          className="min-h-[48px] pl-10"
        />
      </label>

      {liste.erreur && <Card className="mb-3 border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes || chercheEnCours ? (
        <Spinner />
      ) : jeuxFiltres.length === 0 && !q ? (
        <Empty
          icon={<CircleDot size={28} aria-hidden />}
          action={filtre === "livres" ? undefined : <Link href="/jantes/new"><Button>Créer un dossier jantes</Button></Link>}
        >
          {filtre === "livres" ? (
            "Aucun jeu livré pour l'instant."
          ) : (
            <>
              Aucun jeu de jantes en atelier.
              <div className="mt-2 text-xs">
                Réglez d&apos;abord votre barème au pouce dans <Link href="/reglages" className="text-brand underline">Réglages → Jantes</Link>,
                puis créez un dossier à la réception du jeu.
              </div>
            </>
          )}
        </Empty>
      ) : jeuxFiltres.length === 0 ? (
        <Empty icon={<Search size={28} aria-hidden />}>
          Aucun dossier ne correspond à « {q} » dans cet onglet. Essayez le nom du client, la marque
          du véhicule ou l&apos;immatriculation — et pensez à l&apos;onglet « Livrés ».
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {jeuxFiltres.map((j) => {
            const av = avancementJeu((j.jantes ?? []).map((r) => r.statut));
            const enRetard = j.date_promise != null && j.date_promise < aujourdhui && j.statut !== "pret";
            const st = STATUTS_JEU[j.statut] ?? STATUTS_JEU.recu;
            return (
              <Link key={j.id} href={`/jantes/${j.id}`}>
                <Card className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {libelleJeu({
                          nbJantes: j.nb_jantes,
                          diametre: Number(j.diametre_pouces),
                          finition: j.finition,
                          teinte: j.teinte,
                          teinteReference: j.vehicules?.teinte_reference,
                          teinteOrigine: !!j.teinte && j.teinte === j.vehicules?.teinte_origine,
                          vehicule: j.vehicules,
                        })}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {j.numero} · {j.clients?.nom}
                        {j.vehicules?.immatriculation ? ` · ${j.vehicules.immatriculation}` : ""}
                      </div>
                    </div>
                    <Badge tone={st.ton}>{st.label}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                    <span>
                      {av.pretes}/{av.total || j.nb_jantes} jante{(av.total || j.nb_jantes) > 1 ? "s prêtes" : " prête"}
                    </span>
                    {av.retouches > 0 && <span className="font-medium text-amber-700">{av.retouches} en retouche</span>}
                    {j.date_promise && (
                      <span className={enRetard ? "font-semibold text-danger" : ""}>
                        {enRetard ? "En retard — promis le " : "Promis le "}
                        {dateFr(j.date_promise)}
                      </span>
                    )}
                    {j.largeur_pouces != null && <span>{nombreFr(j.largeur_pouces, 1)}J de large</span>}
                    {j.tpms && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">TPMS</span>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <div className="mt-3">
        <Pagination liste={liste} nomPluriel="jeux de jantes" />
      </div>
    </div>
  );
}
