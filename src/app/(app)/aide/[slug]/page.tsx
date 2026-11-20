"use client";
import { use } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Card, PageTitle } from "@/components/ui";
import { VerrouCarte } from "@/components/VerrouPlan";
import { usePlan } from "@/components/PlanProvider";
import { tutoriel } from "@/lib/aide";
import { useTitreDocument } from "@/lib/titre";

export default function TutorielPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { ouvert } = usePlan();
  const t = tutoriel(slug);

  useTitreDocument(t?.titre ?? "Aide");

  if (!t) {
    return (
      <div className="md:max-w-2xl">
        <PageTitle>Tutoriel introuvable</PageTitle>
        <Link href="/aide" className="text-sm font-medium text-brand underline">Retour à l&apos;aide</Link>
      </div>
    );
  }

  // Le tutoriel se lit même quand la formule ne couvre pas la fonction : savoir ce qu'on
  // n'a pas est la moitié de la décision d'achat. On le dit, on ne le cache pas.
  const ferme = t.capacite ? !ouvert(t.capacite) : false;

  return (
    <article className="flex flex-col gap-4 md:max-w-2xl">
      <Link href="/aide" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
        <ArrowLeft size={15} aria-hidden /> Aide
      </Link>

      <PageTitle>{t.titre}</PageTitle>
      <p className="-mt-3 text-sm text-gray-600">{t.resume} · {t.duree}</p>

      {ferme && t.capacite && <VerrouCarte capacite={t.capacite} />}

      <ol className="flex flex-col gap-3">
        {t.etapes.map((e, i) => (
          <li key={e.titre}>
            <Card>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-semibold text-gray-900">{e.titre}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-gray-700">{e.texte}</p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="border-warning/30 bg-warning-light/40">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-warning-dark">
          <AlertTriangle size={15} aria-hidden />
          Ce qui se rate le plus souvent
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-gray-700">
          {t.pieges.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </Card>
    </article>
  );
}
