"use client";
import { montantForfaitMinimum, remiseAffichee, sousTotalRemisable } from "@/lib/utils";
import { euroL, nombreL, textes, type Langue } from "@/lib/i18n";
import type { Remise } from "@/lib/types";

/**
 * Bloc de totaux des pages publiques — devis, facture, bon de livraison.
 *
 * Il existe pour une seule raison : **le client doit pouvoir refaire l'addition**. Les trois pages
 * l'affichaient chacune à leur façon, et le devis en donnait une version qui ne tombait pas juste :
 * « sous-total 13,50 € − remise 1,62 € » puis « total HT 25,00 € », le forfait minimum de 13,12 €
 * étant compté dans le total mais absent du raisonnement.
 *
 * L'ordre reproduit la règle de calcul réelle : la remise porte sur les lignes remisables, puis le
 * plancher de facturation s'ajoute — un plancher qu'on remise n'en est plus un.
 */
export default function BlocTotaux({
  lignes,
  remise,
  totalHt,
  totalTva,
  totalTtc,
  langue,
  className = "mb-6 ml-auto w-56 text-sm",
}: {
  lignes: { total_ht: number | string; meta?: Record<string, unknown> | null }[];
  remise: Remise;
  totalHt: number | string;
  totalTva: number | string;
  totalTtc: number | string;
  langue: Langue;
  className?: string;
}) {
  const t = textes(langue);
  const sousTotal = sousTotalRemisable(lignes);
  // Remise réellement appliquée, déduite du total HT : la somme des parts arrondies par taux de
  // TVA peut valoir un centime de plus que la remise nominale, et c'est le total HT qui fait foi.
  const remiseMontant = remiseAffichee(lignes, remise, totalHt);
  const forfait = montantForfaitMinimum(lignes);
  const detaille = remiseMontant > 0 || forfait > 0;

  return (
    <div className={className}>
      {detaille && (
        <div className="flex justify-between text-gray-500">
          <span>{t.sousTotalHt}</span>
          <span>{euroL(sousTotal, langue)}</span>
        </div>
      )}
      {remiseMontant > 0 && (
        <div className="flex justify-between text-gray-500">
          <span>
            {t.remise}
            {remise?.type === "pct" ? ` (${nombreL(remise.valeur, langue)} %)` : ""}
          </span>
          <span>− {euroL(remiseMontant, langue)}</span>
        </div>
      )}
      {forfait > 0 && (
        <div className="flex justify-between text-gray-500">
          <span>{t.forfaitMinimum}</span>
          <span>+ {euroL(forfait, langue)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>{t.totalHt}</span>
        <b>{euroL(totalHt, langue)}</b>
      </div>
      <div className="flex justify-between text-gray-500">
        <span>{t.tva}</span>
        <span>{euroL(totalTva, langue)}</span>
      </div>
      <div className="flex justify-between border-t pt-1 text-base">
        <span>{t.totalTtc}</span>
        <b>{euroL(totalTtc, langue)}</b>
      </div>
    </div>
  );
}
