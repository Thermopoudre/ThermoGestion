import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TrackView from "@/components/TrackView";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/Chrome";
import { JsonLd, faqJsonLd } from "@/components/JsonLd";
import { ASTUCES, TUTORIELS } from "@/lib/aide";

/**
 * Centre d'aide public.
 *
 * Lot G, point 6 : le centre d'aide réel (`/aide`, dans `(app)`) est fermé aux visiteurs sans
 * session — 47 blocs de contenu métier de première main, invisibles pour un moteur de recherche
 * et pour un prospect qui cherche « comment chiffrer une rénovation de jantes » avant de payer.
 * `/aide` est déjà pris par cet écran privé, d'où `/aide-publique` (repli prévu au CDC).
 *
 * Le contenu n'est PAS réécrit ici : chaque réponse est reprise mot pour mot de `lib/aide.ts`
 * (les astuces de première visite et les résumés de tutoriels affichés dans l'application), pour
 * ne jamais promettre en public une fonction que l'écran ne tient pas. Neuf questions plutôt que
 * les 47 blocs bruts : celles qui répondent à une intention de recherche réelle, une par module
 * du produit, avec assez de métier dedans pour qu'un exploitant reconnaisse son atelier.
 */

const TITRE = "Aide — Thermogestion";
const DESCRIPTION =
  "Comment chiffrer un devis, réceptionner des jantes, lancer une fournée, sortir un certificat. Les questions les plus fréquentes, sans compte.";

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: "/aide-publique" },
  openGraph: { title: TITRE, description: DESCRIPTION, url: "/aide-publique", type: "article", locale: "fr_FR", siteName: "Thermogestion" },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
};

// Question posée comme un exploitant la poserait, réponse reprise verbatim de `lib/aide.ts`.
// `verifierPresence()` (utilisé par le test SEO) s'assure qu'aucune de ces réponses ne s'est
// détachée de sa source si le contenu de l'aide change plus tard.
const QUESTIONS = [
  { q: "Comment un devis est-il chiffré ?", r: ASTUCES.devis.texte },
  { q: "Comment fonctionne le tableau de production (kanban) ?", r: ASTUCES.projets.texte },
  { q: "Comment réceptionner un jeu de jantes sans risquer un litige ?", r: ASTUCES.jantes.texte },
  { q: "Comment remplir une fournée sans rater une cuisson ?", r: ASTUCES.fournees.texte },
  { q: "Que demande vraiment un référentiel qualité (Qualicoat, Qualisteelcoat…) ?", r: ASTUCES.qualite.texte },
  { q: "Pourquoi le stock de poudre sort-il par date de péremption ?", r: ASTUCES.stock.texte },
  { q: "Comment facturer un mois de livraisons sans perdre la remise négociée ?", r: ASTUCES.factures.texte },
  { q: "Comment savoir quel client coûte de l'argent à l'atelier ?", r: ASTUCES.pilotage.texte },
  {
    q: "Peut-on reprendre ses clients et ses tarifs depuis un tableur Excel ?",
    r: `${TUTORIELS.find((t) => t.slug === "reprendre-donnees")!.resume} L'aperçu se vérifie avant toute écriture, et rien n'est enregistré tant qu'il n'a pas été validé.`,
  },
] as const;

export default function AidePublique() {
  return (
    <main className="bg-white text-zinc-900">
      <TrackView event="visit_aide_publique" />
      <JsonLd data={faqJsonLd(QUESTIONS.map(({ q, r }) => ({ question: q, reponse: r })))} />

      <MarketingHeader />

      <section className="border-b border-zinc-100 bg-ink py-16 text-white">
        <div className="mx-auto max-w-3xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">Centre d&apos;aide</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Les questions qu&apos;on nous pose le plus, avant et après l&apos;essai
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-zinc-300">
            Neuf réponses de fond, écrites pour le métier plutôt que pour l&apos;écran — les mêmes
            que celles qui accompagnent chaque atelier une fois connecté.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4">
          <div className="divide-y divide-zinc-200 border-y border-zinc-200">
            {QUESTIONS.map(({ q, r }) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-display font-semibold marker:content-none">
                  {q}
                  <span className="text-zinc-400 transition group-open:rotate-45">
                    <ArrowRight size={16} className="rotate-90" aria-hidden />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">{r}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
            <h2 className="font-display text-xl font-bold tracking-tight">Une question qui n&apos;est pas ici ?</h2>
            <p className="max-w-md text-sm leading-relaxed text-zinc-600">
              Visitez l&apos;atelier de démonstration pour voir l&apos;écran en vrai, ou lancez
              votre essai — chaque atelier connecté a son propre centre d&apos;aide, avec les
              tutoriels complets pas à pas.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {/* Lien natif et non <Link> : /demo est une route serveur qui pose la session de
                  démonstration, le routeur client de Next la court-circuiterait. */}
              <a href="/demo" className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white">
                Visiter la démo
              </a>
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-display font-semibold text-white transition hover:bg-brand-dark">
                Essai gratuit 30 jours <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
