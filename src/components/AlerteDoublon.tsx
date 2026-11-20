"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { motifLike } from "@/lib/recherche";
import {
  MIN_CARACTERES_ALERTE,
  REBOND_ALERTE_MS,
  memeNom,
  motsPourRecherche,
} from "@/lib/doublons";

type Voisin = { id: string; libelle: string; detail: string | null; identique: boolean };

/**
 * « Un client au nom proche existe déjà. »
 *
 * Elle prévient, elle n'empêche pas — et c'est la décision de fond. « Durand Père » et « Durand
 * Fils » sont deux vrais clients ; un logiciel qui refuse le second a tort, et l'exploitant
 * apprend à contourner le logiciel. Le refus dur, lui, reste en base, sur l'identité exacte du
 * nom normalisé : là, il n'y a pas de faux positif possible.
 *
 * La recherche s'appuie sur la colonne `recherche` déjà maintenue par la base (minuscules, sans
 * accents, chiffres isolés) : aucune requête supplémentaire à indexer, et le même vocabulaire
 * que la recherche globale. Les mots sont chaînés en **et** — « Garage Martin » ne répond pas sur
 * tous les garages de la ville.
 */
export default function AlerteDoublon({
  type,
  valeur,
  exclureId,
}: {
  type: "client" | "poudre";
  valeur: string;
  /** Fiche en cours de modification : elle ne doit évidemment pas s'auto-signaler. */
  exclureId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [saisie, setSaisie] = useState("");
  const [voisins, setVoisins] = useState<Voisin[]>([]);

  // Anti-rebond volontairement plus long que celui de la recherche : personne n'attend ce
  // résultat, et une requête par lettre tapée dans le champ « nom » n'a aucun sens.
  useEffect(() => {
    const m = setTimeout(() => setSaisie(valeur.trim()), REBOND_ALERTE_MS);
    return () => clearTimeout(m);
  }, [valeur]);

  useEffect(() => {
    let annule = false;
    const mots = saisie.length >= MIN_CARACTERES_ALERTE ? motsPourRecherche(saisie) : [];
    if (mots.length === 0) { setVoisins([]); return; }

    (async () => {
      const colonnes = type === "client" ? "id, nom, ville, archive" : "id, reference, marque, actif";
      let requete = supabase.from(type === "client" ? "clients" : "poudres").select(colonnes);
      // Chaîner les `like` produit un ET côté PostgREST : c'est ce qui rend l'alerte utilisable.
      for (const mot of mots) requete = requete.like("recherche", motifLike(mot));
      if (exclureId) requete = requete.neq("id", exclureId);
      const { data } = await requete.limit(4);
      if (annule) return;

      const lignes = (data ?? []) as Record<string, unknown>[];
      setVoisins(lignes.map((l) => {
        const libelle = String(type === "client" ? l.nom : l.reference);
        const detail = type === "client"
          ? [l.ville as string | null, l.archive ? "archivé" : null].filter(Boolean).join(" · ") || null
          : [l.marque as string | null, l.actif ? null : "désactivée"].filter(Boolean).join(" · ") || null;
        return { id: String(l.id), libelle, detail, identique: memeNom(libelle, saisie) };
      }));
    })();

    return () => { annule = true; };
  }, [supabase, saisie, type, exclureId]);

  if (voisins.length === 0) return null;

  const bloquant = voisins.some((v) => v.identique);
  const quoi = type === "client" ? "client" : "poudre";

  return (
    <div
      // `role="status"` et non `alert` : l'information est utile, elle n'interrompt pas la saisie.
      role="status"
      aria-live="polite"
      className="flex gap-2 rounded-xl border border-warning bg-warning-light p-3 text-sm text-warning-dark"
    >
      <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">
          {bloquant
            ? `Ce ${quoi} existe déjà.`
            : `Un ${quoi} au nom proche existe déjà.`}
        </p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {voisins.map((v) => (
            <li key={v.id} className="truncate">
              <Link
                href={type === "client" ? `/clients/${v.id}` : `/stock/${v.id}`}
                className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {v.libelle}
              </Link>
              {v.detail && <span className="text-xs"> — {v.detail}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs">
          {bloquant
            ? "L'enregistrement sera refusé : deux fiches du même nom rendent faux tout ce qui se calcule par client. Ouvrez la fiche existante, ou changez le nom."
            : "Vérifiez avant d'enregistrer. Deux fiches pour la même entreprise, c'est un historique coupé en deux et une rentabilité fausse — mais si ce sont bien deux clients différents, continuez."}
        </p>
      </div>
    </div>
  );
}
