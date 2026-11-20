"use client";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { usePlan } from "@/components/PlanProvider";
import { LIBELLE_CAPACITE, offre, planRequis, type Capacite } from "@/lib/abonnement";
import { eur } from "@/lib/utils";

/**
 * Écran fermé par la formule.
 *
 * Trois règles tirées des refus précédents :
 *  1. On **nomme la fonction et on dit à quoi elle sert**. « Passez au plan supérieur » ne vend
 *     rien : l'exploitant ne sait pas ce qu'il rate.
 *  2. On donne **le prix**, tout de suite. Un cadenas sans montant fait fermer l'onglet.
 *  3. On ne ment pas sur l'état des données : ce qui a déjà été saisi reste lisible et
 *     exportable, seule la création est fermée. C'est exactement ce que fait la base.
 */
export function VerrouCarte({ capacite }: { capacite: Capacite }) {
  const { estProprietaire, essai } = usePlan();
  const requis = planRequis(capacite);
  const o = offre(requis);
  const libelle = LIBELLE_CAPACITE[capacite];

  return (
    <Card className="flex flex-col items-start gap-3 border-brand/30 bg-brand-light/30">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand">
          <Lock size={16} aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-gray-900">{libelle.titre}</h2>
          <p className="text-xs font-medium text-brand-dark">
            Formule {o?.nom} — {eur(o?.prixMensuel ?? 0)} HT/mois
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-gray-700">{libelle.pourquoi}</p>

      <p className="text-xs text-gray-600">
        Ce que vous avez déjà saisi reste consultable et exportable. Seule la création de nouvelles
        écritures est fermée tant que votre formule ne couvre pas cette fonction.
      </p>

      {estProprietaire ? (
        <Link
          href="/abonnement"
          className="rounded-lg bg-brand min-h-[44px] px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {essai ? `Revenir à l'essai complet` : `Passer en formule ${o?.nom}`} →
        </Link>
      ) : (
        <p className="text-xs text-gray-500">
          Demandez au responsable de l&apos;atelier d&apos;ouvrir cette fonction.
        </p>
      )}
    </Card>
  );
}

/** Rend l'écran si la formule le couvre, la carte d'explication sinon. */
export default function VerrouPlan({
  capacite,
  children,
}: {
  capacite: Capacite;
  children: React.ReactNode;
}) {
  const { ouvert } = usePlan();
  if (ouvert(capacite)) return <>{children}</>;
  return (
    <div className="md:max-w-2xl">
      <VerrouCarte capacite={capacite} />
    </div>
  );
}

/** Petit cadenas d'appel : signale une fonction fermée sans occuper tout l'écran. */
export function PastilleVerrou({ capacite, className = "" }: { capacite: Capacite; className?: string }) {
  const { ouvert } = usePlan();
  if (ouvert(capacite)) return null;
  const o = offre(planRequis(capacite));
  return (
    <span
      title={`Formule ${o?.nom}`}
      className={`inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-2xs font-medium text-gray-500 ${className}`}
    >
      <Lock size={10} aria-hidden />
      {o?.nom}
    </span>
  );
}
