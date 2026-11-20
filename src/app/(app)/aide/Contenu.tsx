"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, PageTitle, Spinner } from "@/components/ui";
import { usePlan } from "@/components/PlanProvider";
import { tutorielsPour } from "@/lib/aide";
import { offre, planRequis } from "@/lib/abonnement";
import { useTitreDocument } from "@/lib/titre";

/**
 * Centre d'aide.
 *
 * Rangé par **tâche réelle** et non par écran : personne ne cherche « module de facturation », on
 * cherche « facturer le mois de mars à Dupont ». Les tutoriels qui ne concernent pas le métier
 * choisi à l'inscription sont écartés — un rénovateur de jantes n'a rien à faire dans un tutoriel
 * de planification de fournées, et lui montrer l'inverse lui apprend surtout que le produit n'est
 * pas pour lui.
 */
export default function AidePage() {
  const supabase = useMemo(() => createClient(), []);
  const { ouvert } = usePlan();
  const [metier, setMetier] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ateliers").select("settings").maybeSingle();
      setMetier((data?.settings as { metier?: string } | null)?.metier ?? null);
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTitreDocument("Aide");

  if (chargement) return <Spinner />;
  const liste = tutorielsPour(metier);

  return (
    <div className="flex flex-col gap-4 md:max-w-3xl">
      <PageTitle>Aide</PageTitle>

      <p className="text-sm leading-relaxed text-gray-600">
        Des tutoriels de tâches réelles, écrits dans la langue du métier. Chacun se lit en une fois
        et dit aussi ce que les ateliers ratent d&apos;habitude.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {liste.map((t) => {
          const ferme = t.capacite ? !ouvert(t.capacite) : false;
          const o = t.capacite ? offre(planRequis(t.capacite)) : undefined;
          return (
            <Link
              key={t.slug}
              href={`/aide/${t.slug}`}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-brand" aria-hidden><BookOpen size={18} /></span>
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-gray-900">{t.titre}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{t.resume}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden />{t.duree}</span>
                    {ferme && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium">
                        <Lock size={10} aria-hidden />Formule {o?.nom}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Card className="bg-gray-50">
        <h2 className="font-display text-sm font-semibold text-gray-900">Une question qui n&apos;est pas là ?</h2>
        <p className="mt-1 text-sm text-gray-600">
          Écrivez-nous, on répond nous-mêmes — pas un centre d&apos;appel. Dites-nous ce que vous
          essayiez de faire, c&apos;est ce qui nous sert le plus.
        </p>
        <a
          href="mailto:contact@thermopoudre.fr?subject=Thermogestion%20%E2%80%94%20question"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand min-h-[44px] px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Mail size={15} aria-hidden />
          contact@thermopoudre.fr
        </a>
      </Card>
    </div>
  );
}
