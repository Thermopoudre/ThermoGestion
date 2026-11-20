import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import TrackView from "@/components/TrackView";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/Chrome";
import EtreRappele from "@/components/marketing/EtreRappele";
import { JsonLd, faqJsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/env";
import { OFFRES, PRIX_SIEGE_ANNUEL, PRIX_SIEGE_MENSUEL, SIEGES_INCLUS } from "@/lib/abonnement";
import { nombreFr } from "@/lib/utils";

const TITRE = "Prix d'un logiciel de thermolaquage — comparatif honnête 2026";
const DESCRIPTION =
  "Combien coûte un logiciel de gestion pour un atelier de thermolaquage ? Comparatif chiffré entre Excel, un logiciel de facturation d'artisan, un ERP générique, un ERP métier du secteur (4 990 € de mise en route et 980 €/mois) et Thermogestion (79 à 249 € HT/mois, 0 € de mise en route, 5 € HT par utilisateur supplémentaire).";

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  keywords: [
    "prix logiciel thermolaquage",
    "combien coûte un logiciel de gestion d'atelier",
    "logiciel thermolaquage pas cher",
    "alternative ERP thermolaquage",
    "tarif logiciel traitement de surface",
    "comparatif logiciel thermolaquage",
  ],
  alternates: { canonical: "/prix-logiciel-thermolaquage" },
  openGraph: { title: TITRE, description: DESCRIPTION, url: "/prix-logiciel-thermolaquage", type: "article", locale: "fr_FR", siteName: "Thermogestion" },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
};

const REPONSE_DIRECTE =
  "En France, un logiciel de gestion pour atelier de thermolaquage coûte entre 0 € et 40 000 € sur trois ans selon la catégorie. Un logiciel de facturation d'artisan coûte 0 à 32 € par mois mais ignore la poudre, le four et la traçabilité. Un ERP générique demande 10 000 à 50 000 € de mise en œuvre. Un ERP métier du secteur se pratique autour de 4 990 € de frais de mise en route puis 980 € par mois avec trois ans d'engagement, soit environ 40 000 € sur la durée du contrat. Thermogestion coûte 79 à 249 € HT par mois sans frais de mise en route ni engagement, soit 2 844 à 8 964 € sur trois ans, plus 5 € HT par mois et par utilisateur au-delà des utilisateurs compris dans la formule (2 en Atelier, 5 en Équipe, 10 en Certifié).";

type Ligne = {
  solution: string;
  entree: string;
  mensuel: string;
  troisAns: string;
  metier: boolean;
  pour: string;
};

/**
 * Les chiffres de la colonne « ERP métier du secteur » sont les tarifs publics d'un éditeur
 * français spécialisé, relevés sur sa page tarifs le 19 août 2026. Ils sont cités tels quels,
 * sans commentaire dépréciatif : c'est une offre cohérente pour la cible qu'elle vise, et une
 * comparaison déloyale se retourne toujours contre celui qui la fait.
 */
const LIGNES: Ligne[] = [
  {
    solution: "Excel ou un cahier",
    entree: "≈ 0 €",
    mensuel: "0 €",
    troisAns: "≈ 0 € — et beaucoup d'heures",
    metier: false,
    pour: "Les premiers mois d'activité, le temps de savoir ce qu'on fait.",
  },
  {
    solution: "Logiciel de facturation d'artisan",
    entree: "0 €",
    mensuel: "0 à 32 € HT",
    troisAns: "0 à 1 150 € HT",
    metier: false,
    pour: "Faire des devis et des factures propres. Rien de plus : ni poudre, ni four, ni traçabilité, ni certificat.",
  },
  {
    solution: "ERP générique (GPAO)",
    entree: "10 000 à 50 000 €",
    mensuel: "3 000 à 10 000 € / an",
    troisAns: "20 000 à 80 000 € HT",
    metier: false,
    pour: "Une entreprise multi-sites avec une équipe administrative et un intégrateur.",
  },
  {
    solution: "ERP métier du traitement de surface",
    entree: "4 990 € HT",
    mensuel: "980 € HT (680 € sous 1 M€ de CA)",
    troisAns: "≈ 29 500 à 40 300 € HT",
    metier: true,
    pour: "Un sous-traitant industriel de vingt à cinquante personnes, avec un besoin d'accompagnement et de formation.",
  },
  {
    solution: "Thermogestion",
    entree: "0 €",
    // Le siège supplémentaire figure dans la colonne du récurrent, et pas en note : c'est le seul
    // supplément possible, et un prospect qui le découvre après avoir souscrit ne revient pas.
    mensuel: `79 à 249 € HT (+ ${PRIX_SIEGE_MENSUEL} € par utilisateur au-delà des sièges compris)`,
    troisAns: "2 844 à 8 964 € HT",
    metier: true,
    pour: "Un atelier de 1 à 15 personnes, en thermolaquage, en rénovation de jantes, ou les deux.",
  },
];

const QUAND_ERP = [
  "Vous êtes plus de vingt, sur plusieurs sites, avec une équipe administrative dédiée.",
  "Votre métier couvre la galvanoplastie, l'anodisation ou la cataphorèse autant que la poudre.",
  "Un donneur d'ordre exige un flux EDI ou une intégration à son propre système.",
  "Vous voulez qu'on vienne paramétrer, former et reprendre vos données historiques à votre place.",
  "Un budget de 30 000 à 40 000 € sur trois ans est absorbable sans arbitrage.",
];

const QUAND_NOUS = [
  "Vous êtes entre 1 et 15, et le patron est aussi dans l'atelier.",
  "Vous voulez essayer avant de payer, et voir le produit sans laisser votre numéro.",
  "Vous ne pouvez pas immobiliser 5 000 € ni signer trois ans avant d'avoir vu tourner l'outil.",
  "Vous rénovez des jantes — dans ce cas il n'y a pas d'alternative en France.",
  "Vous voulez pouvoir arrêter, et partir avec vos données.",
];

const FAQ = [
  {
    q: "Combien coûte un logiciel de gestion pour un atelier de thermolaquage ?",
    r: "De 0 € à environ 40 000 € sur trois ans, selon la catégorie. Un logiciel de facturation d'artisan coûte 0 à 32 € par mois mais ne connaît ni la poudre, ni le four, ni la traçabilité. Un ERP générique se chiffre en dizaines de milliers d'euros de mise en œuvre. Un ERP métier du traitement de surface se pratique autour de 4 990 € de mise en route puis 980 € par mois avec trois ans d'engagement. Thermogestion va de 79 € HT par mois, 2 utilisateurs compris, à 249 € HT pour la qualité tracée et opposable, 10 utilisateurs compris, sans frais de mise en route ni engagement. Au-delà des utilisateurs compris, chaque utilisateur supplémentaire coûte 5 € HT par mois ou 50 € HT par an.",
  },
  {
    q: "Pourquoi Thermogestion est-il dix fois moins cher qu'un ERP métier ?",
    r: "Parce qu'il ne vend pas la même chose. Un ERP métier à 980 € par mois inclut huit semaines de déploiement, du paramétrage sur mesure, de la formation, de la reprise de données et un accompagnement continu : c'est une prestation de service, et elle vaut son prix pour une entreprise de trente personnes. Thermogestion est en libre-service : vous créez votre atelier en trente secondes par numéro SIREN, vous importez vos données vous-même depuis un fichier Excel, et vous ajustez une grille tarifaire déjà pré-remplie. Le produit couvre le métier ; l'accompagnement n'est pas dans le prix.",
  },
  {
    q: "Y a-t-il des frais de mise en route ou un engagement ?",
    r: "Non, ni l'un ni l'autre. Aucun frais d'installation, aucune durée minimale, aucune pénalité de sortie. L'essai dure 30 jours et ne demande pas de carte bancaire. À l'année, deux mois sont offerts. Vous pouvez exporter la totalité de vos données à tout moment, sous forme d'une archive contenant un fichier CSV par table.",
  },
  {
    q: "Existe-t-il une alternative moins chère à un ERP de thermolaquage ?",
    r: "Oui, à condition d'accepter un périmètre plus étroit et pas d'accompagnement. Thermogestion couvre le devis au m², au mètre linéaire et au pouce, la production en étapes, les fournées et la fiche de cuisson, le stock de poudre par lot avec date limite d'utilisation, le registre des contrôles et le certificat de conformité, la facture Factur-X et l'export FEC. Il ne couvre pas le multi-sites, l'EDI, les procédés hors poudre, ni les racks consignés. C'est un arbitrage assumé.",
  },
  {
    q: "Que se passe-t-il si mon atelier grandit ?",
    r: "Embaucher ne fait pas changer de formule : chaque utilisateur au-delà de ceux compris coûte 5 € HT par mois, et vous ajoutez le siège vous-même. À trois dans l'atelier, la formule Atelier revient à 84 € HT. Ce qui fait passer en formule Équipe, à 129 € HT, c'est l'organisation qu'une équipe réclame — facturation mensuelle récapitulative, tarifs négociés par client, planification des fournées, rentabilité par client, relances automatiques — et cinq utilisateurs compris au lieu de deux. Le jour où vous passez sur plusieurs sites avec une équipe administrative, un ERP métier devient le bon choix, et vous partirez avec vos données, sans frais de sortie.",
  },
];

const FIL_ARIANE = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Prix d'un logiciel de thermolaquage", item: `${SITE_URL}/prix-logiciel-thermolaquage` },
  ],
};

export default function PrixLogicielThermolaquage() {
  return (
    <main className="bg-white text-zinc-900">
      <TrackView event="visit_prix" />
      <JsonLd data={faqJsonLd(FAQ.map((f) => ({ question: f.q, reponse: f.r })))} />
      <JsonLd data={FIL_ARIANE} />

      <MarketingHeader />

      {/* Hero */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-20">
          <nav aria-label="Fil d'Ariane" className="text-sm text-zinc-400">
            <Link href="/" className="transition hover:text-white">Accueil</Link>
            <span className="px-2" aria-hidden>/</span>
            <span className="text-zinc-300">Prix et comparatif</span>
          </nav>
          <p className="mt-8 font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">Comparatif — août 2026</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Combien coûte un logiciel<br />
            <span className="text-tpblue">de thermolaquage ?</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-300">
            Les écarts vont de 1 à 20 sur ce marché, et personne n&apos;affiche ses prix au même
            endroit. Voici le comparatif que nous aurions voulu trouver — y compris là où nous ne
            sommes pas le bon choix.
          </p>
        </div>
      </section>

      {/* Réponse directe */}
      <section className="border-b border-zinc-100 bg-zinc-50 py-10">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">La réponse courte</h2>
          <p className="mt-3 text-lg leading-relaxed text-zinc-700">{REPONSE_DIRECTE}</p>
        </div>
      </section>

      {/* Le tableau */}
      <section className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-bold tracking-tight">Cinq façons de gérer un atelier, et ce qu&apos;elles coûtent</h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Comparatif du coût d&apos;un logiciel de gestion pour atelier de thermolaquage, par catégorie de solution
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="py-3 pr-4 font-display font-semibold">Solution</th>
                  <th scope="col" className="py-3 pr-4 font-display font-semibold">Entrée</th>
                  <th scope="col" className="py-3 pr-4 font-display font-semibold">Récurrent</th>
                  <th scope="col" className="py-3 pr-4 font-display font-semibold">Sur 3 ans</th>
                  <th scope="col" className="py-3 pr-4 font-display font-semibold">Connaît le métier</th>
                  <th scope="col" className="py-3 font-display font-semibold">Le bon choix pour</th>
                </tr>
              </thead>
              <tbody>
                {LIGNES.map((l) => {
                  const nous = l.solution === "Thermogestion";
                  return (
                    <tr key={l.solution} className={nous ? "border-b border-zinc-200 bg-brand-light/40" : "border-b border-zinc-200"}>
                      <th scope="row" className="py-4 pr-4 font-display font-semibold">{l.solution}</th>
                      <td className="py-4 pr-4 text-zinc-600">{l.entree}</td>
                      <td className="py-4 pr-4 text-zinc-600">{l.mensuel}</td>
                      <td className="py-4 pr-4 font-medium text-zinc-900">{l.troisAns}</td>
                      <td className="py-4 pr-4">
                        {l.metier
                          ? <><Check size={16} className="inline text-brand" aria-hidden /> <span className="sr-only">Oui</span></>
                          : <><X size={16} className="inline text-zinc-400" aria-hidden /> <span className="sr-only">Non</span></>}
                      </td>
                      <td className="py-4 text-zinc-600">{l.pour}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-zinc-500">
            Sources : tarifs publics relevés le 19 août 2026 sur les sites des éditeurs concernés
            (éditeur français spécialisé en traitement de surface pour la ligne « ERP métier » ;
            Tolteck, Obat, Sinao, Henrri et Axonaut pour la ligne « facturation d&apos;artisan »).
            Les fourchettes de l&apos;ERP générique sont celles annoncées publiquement par les
            éditeurs du secteur. Prix hors taxes.
          </p>
        </div>
      </section>

      {/* Les deux colonnes honnêtes */}
      <section className="border-b border-zinc-100 bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-bold tracking-tight">Lequel choisir ?</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-zinc-600">
            Un ERP métier à 980 € par mois n&apos;est pas cher : il est cher <i>pour un atelier de
            trois personnes</i>. Ce qu&apos;il vend n&apos;est pas seulement du logiciel, c&apos;est
            du déploiement, de la formation et un interlocuteur au téléphone — et pour une entreprise
            de trente personnes, ça vaut largement son prix.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-8">
              <h3 className="font-display text-xl font-semibold">Prenez un ERP métier si…</h3>
              <ul className="mt-5 space-y-3">
                {QUAND_ERP.map((t) => (
                  <li key={t} className="flex gap-3 text-sm leading-relaxed text-zinc-600">
                    <Check size={16} className="mt-0.5 shrink-0 text-zinc-400" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border-2 border-brand bg-white p-8">
              <h3 className="font-display text-xl font-semibold">Prenez Thermogestion si…</h3>
              <ul className="mt-5 space-y-3">
                {QUAND_NOUS.map((t) => (
                  <li key={t} className="flex gap-3 text-sm leading-relaxed text-zinc-600">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Nos tarifs */}
      <section id="tarifs" className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-bold tracking-tight">Nos tarifs, en entier</h2>
          <p className="mt-2 text-zinc-600">
            30 jours d&apos;essai sans carte bancaire. À l&apos;année, <b>2 mois offerts</b>. Aucun
            frais de mise en route, aucun engagement de durée.
          </p>
          <div className="mx-auto mt-10 grid max-w-6xl gap-6 lg:grid-cols-3">
            {OFFRES.map((offre, i) => {
              // La formule mise en avant est celle du milieu, pas la plus chère : le plan Certifié
              // ne se recommande qu'à un atelier dont les clients exigent une preuve, et le
              // pousser à tout le monde se retournerait à la première démonstration.
              const recommande = i === 1;
              return (
                <div key={offre.code} className={recommande ? "relative rounded-xl border-2 border-brand p-8" : "rounded-xl border border-zinc-200 p-8"}>
                  {recommande && (
                    <span className="absolute -top-3 left-6 rounded bg-brand px-2.5 py-1 font-display text-xs font-semibold uppercase tracking-wide text-white">
                      Le plus choisi
                    </span>
                  )}
                  <h3 className="font-display font-semibold">{offre.nom}</h3>
                  <div className="mt-3 font-display text-5xl font-bold tracking-tight">
                    {offre.prixMensuel}<span className="text-lg font-medium text-zinc-500"> € HT/mois</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">ou {nombreFr(offre.prixAnnuel, 0)} € HT/an — {offre.argument}</p>
                  <p className="mt-3 border-l-2 border-zinc-200 pl-3 text-sm italic text-zinc-500">{offre.raison}</p>
                  <ul className="mt-6 space-y-2.5 text-sm text-zinc-600">
                    {offre.inclus.map((x) => (
                      <li key={x} className="flex gap-2">
                        <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                        {x}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={
                      recommande
                        ? "mt-8 block rounded-lg bg-brand px-4 py-3 text-center font-display font-semibold text-white transition hover:bg-brand-dark"
                        : "mt-8 block rounded-lg border-2 border-ink px-4 py-3 text-center font-display font-semibold transition hover:bg-zinc-50"
                    }
                  >
                    Commencer l&apos;essai
                  </Link>
                </div>
              );
            })}
          </div>
          {/* La ligne du siège, à côté des formules et pas en bas de page. Un prix caché découvert
              après la souscription est le moyen le plus sûr de perdre la confiance d'un artisan. */}
          <div className="mx-auto mt-10 max-w-3xl overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
              <caption className="px-6 pt-6 text-left font-display font-semibold">
                Utilisateurs compris, et prix de l&apos;utilisateur supplémentaire
              </caption>
              <thead>
                <tr className="border-b border-zinc-200">
                  <th scope="col" className="px-6 py-3 font-display font-semibold">Formule</th>
                  <th scope="col" className="px-6 py-3 font-display font-semibold">Utilisateurs inclus</th>
                  <th scope="col" className="px-6 py-3 font-display font-semibold">Utilisateur en plus</th>
                </tr>
              </thead>
              <tbody>
                {OFFRES.map((o) => (
                  <tr key={o.code} className="border-b border-zinc-100 last:border-0">
                    <th scope="row" className="px-6 py-3 font-medium">{o.nom}</th>
                    <td className="px-6 py-3 text-zinc-600">{SIEGES_INCLUS[o.code]}</td>
                    <td className="px-6 py-3 text-zinc-600">
                      {PRIX_SIEGE_MENSUEL} € HT/mois · {PRIX_SIEGE_ANNUEL} € HT/an
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-6 pb-6 pt-3 text-sm leading-relaxed text-zinc-500">
              Un utilisateur compte tant qu&apos;il est actif, et une invitation en attente occupe sa
              place jusqu&apos;à ce qu&apos;elle expire. Vous ajoutez et retirez un siège vous-même
              depuis l&apos;application, avec le nouveau montant annoncé avant de valider. C&apos;est
              le seul supplément possible : il n&apos;y a ni frais de mise en route, ni option, ni
              module payant.
            </p>
          </div>

          {/* Ce que la marche supplémentaire achète réellement. Sans ce tableau, un prospect
              compare trois nombres et choisit le plus petit ; avec, il choisit celui qui
              correspond à sa situation, et il ne se sent pas floué au troisième mois. */}
          <div className="mx-auto mt-12 max-w-3xl">
            <h3 className="font-display text-xl font-bold tracking-tight">Ce qui fait changer de formule</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Ce n&apos;est jamais le métier. Le thermolaquage et la rénovation de jantes sont
              complets dès la première formule : un rénovateur de jantes qui travaille seul a tout
              son métier à 79 €. Ce qui fait payer plus, c&apos;est le niveau d&apos;organisation puis
              le niveau de preuve que vos clients exigent. Le nombre de personnes, lui, ne fait plus
              changer de formule : il se compte à l&apos;unité, {PRIX_SIEGE_MENSUEL} € HT par mois
              au-delà des utilisateurs compris.
            </p>
            <dl className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
              {[
                {
                  q: "Vous embauchez un troisième, un quatrième opérateur",
                  r: "Pas forcément de formule. Un utilisateur de plus coûte 5 € HT par mois : à trois dans l'atelier, la formule Atelier à 79 € plus un siège fait 84 € HT. Ce qui fait passer à la formule Équipe, à 129 € HT, ce sont les fournées qui se planifient, la rentabilité qui se lit par client, les relances qui partent seules et la facturation mensuelle qui regroupe les bons de livraison de vos donneurs d'ordre — et cinq utilisateurs compris au lieu de deux.",
                },
                {
                  q: "Un client vous demande un certificat, ou vous visez un agrément",
                  r: "Formule Certifié, 249 € HT. Cahier de contrôles avec vos seuils, registre des bains, étalonnage des instruments, non-conformités, fiche de cuisson tracée, certificat de conformité opposable, registre des déchets ICPE et classeur FDS.",
                },
                {
                  q: "Vous êtes seul, ou à deux",
                  r: "Formule Atelier, 79 € HT. Vous n'avez rien à financer de plus : devis au m², au ml et au pouce, dossier jantes complet, production, stock de poudre par lot, bon de livraison signé, Factur-X et export FEC. Deux utilisateurs sont compris.",
                },
                {
                  q: "Vous voulez juste un accès de plus",
                  r: `${PRIX_SIEGE_MENSUEL} € HT par mois, sur la formule que vous avez déjà. Le nombre d'utilisateurs n'est pas une marche entre formules : c'est un compteur. Vous ajoutez le siège depuis Réglages → Équipe, vous voyez le nouveau montant avant de valider, et vous le retirez le jour où la personne s'en va.`,
                },
              ].map(({ q, r }) => (
                <div key={q} className="py-4">
                  <dt className="font-display text-sm font-semibold">{q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-zinc-600">{r}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Client{" "}
            <a href="https://thermopoudre.fr" target="_blank" rel="noreferrer" className="font-medium text-brand-dark underline underline-offset-2">
              Thermopoudre
            </a>{" "}
            ? −20 % sur votre abonnement, tant que votre compte est actif.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Prix et engagement — questions fréquentes</h2>
          <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium marker:content-none">
                  {f.q}
                  <span className="text-zinc-400 transition group-open:rotate-45"><ArrowRight size={16} className="rotate-90" aria-hidden /></span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.r}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link href="/logiciel-renovation-jantes" className="font-medium text-brand-dark underline underline-offset-2">
              Le logiciel de rénovation de jantes
            </Link>
            <Link href="/logiciel-sous-traitance-thermolaquage" className="font-medium text-brand-dark underline underline-offset-2">
              Le logiciel de sous-traitance thermolaquage
            </Link>
          </div>
        </div>
      </section>

      <EtreRappele
        origine="tarifs"
        titre="Un doute sur le bon choix ?"
        texte="Dites-nous votre taille, votre métier et ce que vous utilisez aujourd'hui. Si un autre outil vous convient mieux, on vous le dira — c'est moins coûteux pour tout le monde qu'un abonnement résilié au bout de deux mois."
      />

      <MarketingFooter />
    </main>
  );
}
