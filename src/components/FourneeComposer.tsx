"use client";
import { Lightbulb, X } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { nombreFr } from "@/lib/utils";
import { avertissementAjout, cycleLabel, grouperParTeinte, poudreLabel, suggestionLabel, suggestionMeilleureFournee, surfaceTotale, tauxRemplissage } from "@/lib/fournees";
import type { ProjetPretFournee } from "@/lib/types";

/**
 * Composition d'une fournée : liste des projets prêts à cuire (groupés par teinte) d'un côté,
 * composition en cours de l'autre, avec jauge de remplissage et avertissements de compatibilité.
 * Utilisé à la fois pour créer une fournée (page /fournees) et pour compléter une fournée encore
 * planifiée (page /fournees/[id]).
 */
export default function FourneeComposer({
  disponibles,
  selection,
  capaciteM2,
  onAdd,
  onRemove,
  readOnly = false,
}: {
  disponibles: ProjetPretFournee[];
  selection: ProjetPretFournee[];
  capaciteM2: number | null | undefined;
  onAdd: (p: ProjetPretFournee) => void;
  onRemove: (p: ProjetPretFournee) => void;
  readOnly?: boolean;
}) {
  const surface = surfaceTotale(selection);
  const taux = tauxRemplissage(surface, capaciteM2);
  const groupesDispo = grouperParTeinte(disponibles);
  const suggestion = selection.length === 0 ? suggestionMeilleureFournee(groupesDispo, capaciteM2) : null;

  const jaugeCouleur = taux == null ? "bg-gray-300" : taux > 100 ? "bg-red-500" : taux >= 70 ? "bg-brand" : "bg-tpblue";

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold">Remplissage du four</span>
          <span className={taux != null && taux > 100 ? "font-semibold text-red-600" : "font-medium"}>
            {/* Décimales fixées des deux côtés de la barre : voir `nombreFr()`. */}
            {nombreFr(surface, 1, 1)} m²{capaciteM2 ? ` / ${nombreFr(capaciteM2, 1, 1)} m²` : ""}{taux != null ? ` · ${taux} %` : ""}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full transition-all ${jaugeCouleur}`} style={{ width: `${Math.min(100, taux ?? 0)}%` }} />
        </div>
        {!capaciteM2 && <p className="mt-1 text-xs text-gray-500">Capacité du four non renseignée — réglez-la dans Réglages pour voir le taux de remplissage.</p>}
      </Card>

      {suggestion && suggestion.projets.length > 0 && (
        <Card className="border-brand bg-brand-light">
          <div className="flex items-center gap-1.5 text-sm font-medium text-brand-dark"><Lightbulb size={15} aria-hidden /> {suggestionLabel(suggestion)}</div>
          <Button
            variant="primary"
            className="mt-2 w-full"
            onClick={() => suggestion.projets.forEach((p) => onAdd(p))}
          >
            Composer cette fournée
          </Button>
        </Card>
      )}

      {!readOnly && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Projets prêts à cuire ({disponibles.length})</div>
          {groupesDispo.length === 0 && <p className="text-xs text-gray-500">Aucun projet en attente de cuisson.</p>}
          <div className="flex flex-col gap-3">
            {groupesDispo.map((g) => (
              <div key={g.poudre_id ?? "sans-poudre"}>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {poudreLabel(g.poudre)}
                  <span className="font-normal normal-case text-gray-400">{cycleLabel(g.poudre)} · {nombreFr(g.surfaceTotale)} m²</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {g.projets.map((p) => {
                    const avert = avertissementAjout(selection, p);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{p.numero ?? p.nom}</div>
                          <div className="truncate text-xs text-gray-500">{p.clients?.nom} · {nombreFr(p.surface_m2 ?? 0)} m²</div>
                          {avert.message && <div className={`mt-0.5 text-xs ${avert.bloquant ? "font-medium text-red-600" : "text-amber-700"}`}>{avert.message}</div>}
                        </div>
                        <Button variant="secondary" className="shrink-0 !px-3 !py-1.5 text-xs" disabled={avert.bloquant} onClick={() => onAdd(p)}>
                          + Ajouter
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-2 text-sm font-semibold">Composition ({selection.length})</div>
        {selection.length === 0 && <p className="text-xs text-gray-500">Ajoutez des projets depuis la liste ci-dessus.</p>}
        <div className="flex flex-col gap-1.5">
          {selection.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.numero ?? p.nom}</div>
                <div className="truncate text-xs text-gray-500">
                  {p.clients?.nom} · {nombreFr(p.surface_m2 ?? 0)} m²
                  {!memeTeinteQueLePremier(selection, p) && <Badge tone="warning" className="ml-2">Teinte différente</Badge>}
                </div>
              </div>
              {!readOnly && (
                <button aria-label="Retirer" className="shrink-0 px-2 text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => onRemove(p)}>
                  <X size={14} aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function memeTeinteQueLePremier(selection: ProjetPretFournee[], p: ProjetPretFournee) {
  if (selection.length === 0 || selection[0].id === p.id) return true;
  return selection[0].poudre_id === p.poudre_id;
}
