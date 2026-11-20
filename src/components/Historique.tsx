"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errorFr } from "@/lib/errors";
import { useToast } from "@/components/Toast";
import { usePlan } from "@/components/PlanProvider";
import { Button, Card, Spinner } from "@/components/ui";
import { JOURS_JOURNAL, entreeJournal, type EntiteJournal, type LigneJournal } from "@/lib/journal";

/** Première page : ce qu'on lit quand on ouvre la fiche pour comprendre ce qui vient de se passer. */
const PAR_PAGE = 20;

/**
 * Historique d'une fiche — client, chantier, devis ou facture.
 *
 * POURQUOI un panneau et pas un écran. La question ne se pose jamais dans l'abstrait : elle se
 * pose devant une pièce précise, au téléphone, pendant que le client tient sa version. « Votre
 * devis disait 1 400 €, la facture en fait 1 780 » se répond ici, sur le devis, en deux
 * secondes — pas dans un journal global qu'il faudrait filtrer.
 *
 * Trois choses qu'il faut savoir avant de le modifier :
 *
 *  1. **La lecture est réservée au responsable**, par la politique `owner_select` sur
 *     `audit_logs`. Le `if` ci-dessous ne protège rien — la base répondrait « zéro ligne » à un
 *     compte de bureau ou d'atelier. Il évite seulement d'afficher un panneau vide et inquiétant.
 *  2. **Personne n'écrit dans ce journal depuis l'application**, pas même le responsable :
 *     l'insertion a été révoquée et seul le trigger `trg_journal`, en `SECURITY DEFINER`, y pose
 *     des lignes. Une table de preuve où l'on peut écrire ne prouve rien.
 *  3. **Le journal ne dit que ce qu'il sait dire.** Un champ sans libellé métier n'est pas
 *     affiché sous son nom de colonne : il est compté. Voir `src/lib/journal.ts`.
 */
export default function Historique({
  entite,
  entiteId,
  titre = "Historique",
}: {
  entite: EntiteJournal;
  entiteId: string;
  titre?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const { estProprietaire } = usePlan();
  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [limite, setLimite] = useState(PAR_PAGE);
  const [encore, setEncore] = useState(false);

  const charger = useCallback(async () => {
    // Une ligne de plus que demandé : c'est ainsi qu'on sait s'il reste quelque chose à afficher
    // sans payer un `count: exact`, qui compte toute la table à chaque ouverture de fiche.
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, created_at, acteur, auteur_nom, action, entity, entity_id, payload")
      .eq("entity", entite)
      .eq("entity_id", entiteId)
      .order("created_at", { ascending: false })
      .limit(limite + 1);
    if (error) {
      // Un échec muet laisserait la carte en « Chargement… » pour toujours : l'exploitant croit
      // à un réseau lent et attend une liste qui n'arrivera jamais.
      toast(errorFr(error), "error");
      setLignes([]);
      return;
    }
    const toutes = (data as LigneJournal[]) ?? [];
    setEncore(toutes.length > limite);
    setLignes(toutes.slice(0, limite));
  }, [supabase, entite, entiteId, limite, toast]);

  useEffect(() => { if (estProprietaire) charger(); }, [charger, estProprietaire]);

  if (!estProprietaire) return null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <History size={16} aria-hidden /> {titre}
      </div>

      {lignes === null ? (
        <Spinner taille="sm" />
      ) : lignes.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          Aucune modification enregistrée pour l&apos;instant. À partir de maintenant, chaque
          changement de prix, de statut ou de coordonnées est daté et signé.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {lignes.map((l) => {
            const e = entreeJournal(l);
            return (
              <li key={e.id} className="border-l-2 border-gray-200 pl-3">
                <div className="text-2xs uppercase tracking-wide text-gray-400">{e.quand}</div>
                <div className="text-sm">
                  <b className="font-medium text-gray-800">{e.qui}</b>{" "}
                  <span className="text-gray-700">{e.phrases.join(", ")}.</span>
                </div>
                {e.nonTraduits > 0 && (
                  <div className="text-2xs text-gray-400">
                    et {e.nonTraduits} autre{e.nonTraduits > 1 ? "s" : ""} champ{e.nonTraduits > 1 ? "s" : ""} technique{e.nonTraduits > 1 ? "s" : ""}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {encore && (
        <div>
          <Button variant="secondary" onClick={() => setLimite((n) => n + PAR_PAGE)}>
            Afficher plus
          </Button>
        </div>
      )}

      <p className="text-2xs text-gray-400">
        Visible par le responsable seul. Conservé {Math.round(JOURS_JOURNAL / 365)} ans, puis effacé
        automatiquement.
      </p>
    </Card>
  );
}
