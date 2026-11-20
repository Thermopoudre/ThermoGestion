import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ClipboardCheck, FileCheck2, Flame, FlaskConical, Ruler, Timer, X } from "lucide-react";
import TrackView from "@/components/TrackView";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/Chrome";
import EtreRappele from "@/components/marketing/EtreRappele";
import { JsonLd, faqJsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/env";

const TITRE = "Logiciel de sous-traitance thermolaquage — traçabilité, certificat de conformité, Factur-X";
const DESCRIPTION =
  "Pour l'atelier de thermolaquage sous-traitant de 1 à 15 personnes : devis au m² et au mètre linéaire, fournées et fiche de cuisson tracée, lot de poudre chaîné jusqu'à la pièce livrée, registre de contrôles Qualicoat et certificat de conformité, facture Factur-X et export FEC. À partir de 79 € HT/mois, sans mise en route.";

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  keywords: [
    "logiciel thermolaquage artisan",
    "logiciel petit atelier thermolaquage",
    "logiciel sous-traitance thermolaquage",
    "certificat de conformité thermolaquage",
    "registre de contrôles Qualicoat",
    "traçabilité lot de poudre",
    "logiciel devis au m² laquage",
    "logiciel sablage grenaillage gestion",
    "logiciel peinture poudre atelier",
  ],
  alternates: { canonical: "/logiciel-sous-traitance-thermolaquage" },
  openGraph: { title: TITRE, description: DESCRIPTION, url: "/logiciel-sous-traitance-thermolaquage", type: "article", locale: "fr_FR", siteName: "Thermogestion" },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
};

const REPONSE_DIRECTE =
  "Thermogestion est un logiciel de gestion français pour les ateliers de thermolaquage sous-traitants de 1 à 15 personnes. Il chiffre au m² ou au mètre linéaire, fait signer le devis en ligne, planifie les fournées par cycle et par teinte, trace le lot de poudre jusqu'à la pièce livrée, tient le registre des contrôles avec les seuils de votre référentiel (Qualicoat, Qualisteelcoat, Qualimarine, Qualidéco), édite un certificat de conformité opposable, et produit des factures Factur-X avec export FEC. Trois formules : 79 € HT par mois pour le métier complet, 2 utilisateurs compris, 129 € pour 5 utilisateurs avec la planification des fournées et la rentabilité par client, 249 € pour 10 utilisateurs avec le registre de contrôles, le certificat de conformité opposable, la fiche de cuisson tracée et le registre des déchets. Au-delà des utilisateurs compris, chaque utilisateur supplémentaire coûte 5 € HT par mois. Sans frais de mise en route et sans engagement de durée.";

const PREUVES = [
  {
    Icon: FlaskConical,
    titre: "Le lot de poudre, chaîné jusqu'à la pièce livrée",
    texte:
      "Chaque projet porte le lot réellement consommé. Le décompte est fait à la cuisson, en FIFO et par date limite d'utilisation, les lots périmés servis en dernier. Le numéro de lot est repris sur le certificat remis à votre client : quand un donneur d'ordre revient six mois plus tard sur une série, vous savez quoi lui répondre.",
  },
  {
    Icon: Flame,
    titre: "La fiche de cuisson, tracée et retrouvable",
    texte:
      "Consigne, relevé, écart, opérateur, consommation en kWh, lot de poudre, cases de visa. Une fournée clôturée reste accessible, avec son PDF : le document d'audit ne disparaît pas quand on quitte l'écran.",
  },
  {
    Icon: ClipboardCheck,
    titre: "Le registre des contrôles, aux seuils de votre référentiel",
    texte:
      "Six types de contrôle, dont les seuils viennent du référentiel que vous déclarez, et que vous pouvez désactiver un par un si vous ne les pratiquez pas. Le verdict est recalculé par la base de données et non par le navigateur, et un contrôle enregistré ne se modifie plus et ne se supprime pas. Registre des bains et étalonnage des instruments dans la même chaîne, avec un préavis avant échéance.",
  },
  {
    Icon: FileCheck2,
    titre: "Le certificat de conformité qui refuse de mentir",
    texte:
      "Il refuse de s'imprimer sans mesure, avec un instrument non étalonné ou sous une certification expirée — et le blocage est rejoué côté serveur, pas seulement à l'écran. Les contrôles non réalisés sont nommés sur le document plutôt que passés sous silence, et la plage d'épaisseur n'est imprimée que si une épaisseur a été mesurée.",
  },
];

const SOCLE = [
  {
    Icon: Ruler,
    titre: "Chiffrer comme vous vendez",
    texte:
      "Grille au m² avec paliers dégressifs, prix au mètre linéaire par famille de profilé avec surface développée recalculée, prestations à prix fixes, bibliothèque de pièces types avec coefficient de complexité, forfait minimum de commande, et une grille négociée par client qui s'applique sans y penser. Le devis part par lien, le client signe au doigt, le projet s'ouvre tout seul.",
  },
  {
    Icon: Timer,
    titre: "Tenir un délai qu'on peut annoncer",
    texte:
      "Les fournées se composent par cycle et par teinte, avec blocage dur quand deux cycles sont incompatibles et une jauge de remplissage du four. La charge réelle donne une date de livraison réaliste sur la fiche projet. Le temps passé se chronomètre au scan, y compris sur un poste partagé où un temps global se répartit au prorata des surfaces.",
  },
  {
    Icon: FileCheck2,
    titre: "Facturer comme l'administration l'exige",
    texte:
      "Facture Factur-X au format PDF/A-3 avec XML CII incorporé, mentions L441-9, L441-10, R.123-237 et article 293 B en franchise en base, acomptes déduits en ligne explicite par taux de TVA, facture mensuelle récapitulative des bons de livraison, avoirs en série séparée, et export FEC conforme pour le contrôle fiscal.",
  },
];

/**
 * Le bloc d'honnêteté.
 *
 * Ce n'est pas de la modestie : une promesse démentie pendant la démonstration coûte plus cher
 * qu'une promesse absente, et un prospect qui lit ce que le produit ne fait pas croit ce qu'il lit
 * ailleurs sur la page. C'est aussi le format que les moteurs de réponse reprennent le plus
 * volontiers, parce qu'il est vérifiable.
 */
const HONNETETE = [
  "Les autres traitements de surface — galvanoplastie, anodisation, cataphorèse, traitement thermique. Thermogestion s'arrête au sablage, à la poudre et au four.",
  "Le multi-sites. Un atelier, une base. Si vous avez trois sites à consolider, il vous faut un ERP.",
  "Les racks, chevalets et crochets consignés. C'est prévu, ce n'est pas fait.",
  "La poudre récupérée et le taux de réemploi. Le stock raisonne en poudre neuve.",
  "L'EDI, les connecteurs comptables et l'API publique. L'export FEC et le CSV couvrent le besoin ; le reste n'existe pas.",
  "Les alertes poussées. Aujourd'hui, l'information vous attend à l'écran : elle ne vient pas encore vous chercher par mail ou par SMS.",
];

const FAQ = [
  {
    q: "Existe-t-il un logiciel de thermolaquage pour un petit atelier ?",
    r: "Oui. Le marché est occupé par deux extrêmes : des ERP métier facturés couramment 5 000 € de mise en route et 1 000 € par mois avec trois ans d'engagement, calibrés pour un sous-traitant de trente personnes avec une équipe administrative ; et des logiciels de facturation d'artisan à 20 ou 30 € qui ignorent totalement la poudre, le four et la traçabilité. Thermogestion occupe l'espace entre les deux : 79 à 249 € HT par mois, sans mise en route, sans engagement, avec le métier dedans — et la qualité opposable dans la formule la plus haute, qui reste quatre fois moins chère que l'offre réduite d'un ERP métier.",
  },
  {
    q: "Le logiciel gère-t-il le référentiel Qualicoat ?",
    r: "Il gère les seuils de contrôle de votre référentiel, quel qu'il soit : Qualicoat, Qualisteelcoat, Qualimarine, Qualidéco ou votre propre barème. Vous déclarez le référentiel, vous cochez les types de contrôle que vous pratiquez réellement, et le registre comme le certificat s'y conforment. Un avertissement apparaît si vous revendiquez un label sans pratiquer le contrôle d'épaisseur. Précision utile : ce logiciel ne délivre aucun label et ne remplace pas un audit — il tient les registres que l'auditeur demande à voir.",
  },
  {
    q: "Comment tracer un lot de poudre jusqu'à la pièce livrée ?",
    r: "Vous réceptionnez un lot avec son numéro, sa quantité et sa date limite d'utilisation. À la cuisson, la consommation se décompte automatiquement sur les lots en FIFO, en servant les lots périmés en dernier. Le projet garde le lot réellement consommé, et ce numéro est repris sur le certificat de conformité remis à votre client. Vous pouvez recaler le réel par des pesées, qui alimentent le rendement en kg par m².",
  },
  {
    q: "Mes factures seront-elles conformes à la facturation électronique ?",
    r: "Oui. Thermogestion produit des factures Factur-X : un PDF/A-3 lisible par un humain, avec le XML CII incorporé et lisible par une machine. Les mentions obligatoires sont portées (articles L441-9, L441-10, R.123-237, et article 293 B pour un atelier en franchise en base), le SIREN du client et l'adresse de livraison sont des champs structurés, et l'export FEC attendu par l'administration est produit au bon format.",
  },
  {
    q: "Je fais du sablage et du grenaillage en plus du laquage. C'est géré ?",
    r: "Oui, comme prestations et comme étapes de production, avec leur temps chronométré et leur coût. En revanche Thermogestion ne modélise pas les bains de traitement chimique au sens d'un ERP de galvanoplastie : il tient un registre des bains avec ses relevés, pas une chimie pilotée.",
  },
  {
    q: "Que se passe-t-il si j'arrête ? Est-ce que je récupère mes données ?",
    r: "Vous téléchargez à tout moment une archive complète : un fichier CSV par table plus un JSON, 38 tables en tout. Aucun engagement de durée, aucun frais de sortie. Seule réserve à connaître : les photos ne sont pas dans l'archive, seuls leurs chemins.",
  },
  {
    q: "Combien de temps faut-il pour démarrer ?",
    r: "Le jour même. La création de l'atelier se fait par numéro SIREN avec remplissage automatique, la grille tarifaire est pré-remplie et vous ajustez vos prix, et l'import CSV ou Excel reprend vos clients, vos prestations et vos poudres avec un aperçu avant écriture. Il n'y a ni projet de déploiement, ni paramétrage à facturer, ni formation obligatoire.",
  },
];

const FIL_ARIANE = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Logiciel de sous-traitance thermolaquage", item: `${SITE_URL}/logiciel-sous-traitance-thermolaquage` },
  ],
};

export default function LogicielSousTraitanceThermolaquage() {
  return (
    <main className="bg-white text-zinc-900">
      <TrackView event="visit_industrie" />
      <JsonLd data={faqJsonLd(FAQ.map((f) => ({ question: f.q, reponse: f.r })))} />
      <JsonLd data={FIL_ARIANE} />

      <MarketingHeader />

      {/* Hero */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-20">
          <nav aria-label="Fil d'Ariane" className="text-sm text-zinc-400">
            <Link href="/" className="transition hover:text-white">Accueil</Link>
            <span className="px-2" aria-hidden>/</span>
            <span className="text-zinc-300">Sous-traitance thermolaquage</span>
          </nav>
          <p className="mt-8 font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">
            Sous-traitance thermolaquage — sablage, grenaillage, poudrage, cuisson
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            La preuve que votre donneur d&apos;ordre réclame.<br />
            <span className="text-tpblue">Sans ERP à 1 000 € par mois.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-300">
            Un atelier de trois à quinze personnes n&apos;a pas besoin d&apos;un progiciel avec huit
            semaines de déploiement et trois ans d&apos;engagement. Il a besoin de chiffrer juste, de
            tenir sa date, et de <b className="text-white">pouvoir prouver ce qu&apos;il a fait</b> —
            le lot, la cuisson, la mesure, le certificat, la facture.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-tpblue px-7 py-4 font-display text-base font-semibold text-ink transition hover:bg-tpblue-soft">
              Essayer 30 jours gratuitement <ArrowRight size={18} aria-hidden />
            </Link>
            {/* Lien natif : /demo est une route serveur qui pose la session de démonstration. */}
            <a href="/demo" className="inline-flex items-center justify-center rounded-lg border border-ink-line px-7 py-4 text-base font-medium text-zinc-200 transition hover:border-zinc-400 hover:text-white">
              Visiter la démo — sans inscription
            </a>
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            0 € de mise en route · Sans engagement de durée · Vos données exportables à tout moment
          </p>
        </div>
      </section>

      {/* Réponse directe */}
      <section className="border-b border-zinc-100 bg-zinc-50 py-10">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">
            Quel logiciel pour un atelier de thermolaquage sous-traitant ?
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-zinc-700">{REPONSE_DIRECTE}</p>
        </div>
      </section>

      {/* Les quatre preuves */}
      <section className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Traçabilité</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight">
            Quatre documents, et une chaîne qui les relie
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-zinc-600">
            La traçabilité ne vaut que si elle tient bout à bout. Ici, le lot réceptionné, la fournée
            cuite, la mesure relevée et le certificat imprimé sont le même fil — pas quatre écrans
            qu&apos;on remplit à la main en espérant qu&apos;ils concordent.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-2">
            {PREUVES.map(({ Icon, titre, texte }) => (
              <div key={titre} className="bg-white p-7">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-dark">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold leading-snug">{titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{texte}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 rounded-lg border-l-4 border-brand bg-zinc-50 p-5 text-sm leading-relaxed text-zinc-600">
            <b className="text-zinc-900">Ce qui rend le certificat opposable</b>, c&apos;est qu&apos;on ne
            peut pas le forcer. Le verdict de conformité est calculé par la base de données à partir
            des valeurs relevées, quelle que soit la valeur envoyée par le navigateur ; un contrôle
            enregistré n&apos;a aucune voie de suppression ; et l&apos;édition du certificat est
            refusée côté serveur, pas seulement grisée à l&apos;écran. Un document qu&apos;on peut
            contourner ne vaut rien devant un auditeur.
          </p>
        </div>
      </section>

      {/* Le socle */}
      <section className="bg-ink py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">Le quotidien</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight">
            Chiffrer, tenir le délai, facturer.
          </h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {SOCLE.map(({ Icon, titre, texte }) => (
              <div key={titre} className="rounded-xl border border-ink-line p-7">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-tpblue/15 text-tpblue">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ce que le produit ne fait pas */}
      <section className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Franchise</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Ce que Thermogestion ne fait pas</h2>
          <p className="mt-3 leading-relaxed text-zinc-600">
            Autant que vous le sachiez avant la démonstration plutôt que pendant. Si l&apos;un de ces
            points est indispensable chez vous, il vous faut un autre outil, et nous vous le dirons.
          </p>
          <ul className="mt-8 space-y-3">
            {HONNETETE.map((t) => (
              <li key={t} className="flex gap-3 rounded-lg border border-zinc-200 p-4">
                <X size={18} className="mt-0.5 shrink-0 text-zinc-400" aria-hidden />
                <span className="text-sm leading-relaxed text-zinc-600">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm leading-relaxed text-zinc-600">
            En revanche, ce qui est annoncé plus haut sur cette page est en production et se montre en
            démonstration.{" "}
            <Link href="/prix-logiciel-thermolaquage" className="font-medium text-brand-dark underline underline-offset-2">
              Voir le comparatif honnête avec Excel, un ERP générique et un ERP métier du secteur
            </Link>.
          </p>
        </div>
      </section>

      {/* Pour qui */}
      <section className="border-b border-zinc-100 bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-bold tracking-tight">C&apos;est pour vous si…</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <ul className="space-y-3">
              {[
                "Vous êtes entre 1 et 15 personnes et vous laquez pour d'autres.",
                "Un donneur d'ordre vous a déjà demandé un certificat ou une attestation de conformité.",
                "Vous tenez vos contrôles sur un classeur, un cahier ou un tableur.",
                "Vous ne savez pas dire ce qu'un chantier vous a réellement coûté.",
                "Vous devez passer à la facturation électronique et vous ne savez pas par où commencer.",
              ].map((t) => (
                <li key={t} className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4">
                  <Check size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                  <span className="text-sm leading-relaxed text-zinc-700">{t}</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-3">
              {[
                "Vous êtes trente personnes sur trois sites avec une équipe administrative dédiée.",
                "Votre métier principal est la galvanoplastie, l'anodisation ou la cataphorèse.",
                "Votre donneur d'ordre exige un flux EDI ou une intégration à son propre ERP.",
                "Vous cherchez d'abord un outil de comptabilité ou un CRM commercial.",
              ].map((t) => (
                <li key={t} className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4">
                  <X size={18} className="mt-0.5 shrink-0 text-zinc-400" aria-hidden />
                  <span className="text-sm leading-relaxed text-zinc-500">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-8 text-sm text-zinc-600">
            Colonne de gauche : c&apos;est pour vous. Colonne de droite : ce n&apos;est pas pour vous, et
            le dire tout de suite vous fera gagner une heure.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Sous-traitance thermolaquage — questions fréquentes</h2>
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
          <p className="mt-8 rounded-lg bg-zinc-50 p-5 text-sm leading-relaxed text-zinc-600">
            <b className="text-zinc-900">Vous rénovez aussi des jantes ?</b> C&apos;est le seul logiciel
            français qui les gère vraiment, avec un chiffrage au pouce et un suivi roue par roue.{" "}
            <Link href="/logiciel-renovation-jantes" className="font-medium text-brand-dark underline underline-offset-2">
              Voir la page rénovation de jantes
            </Link>.
          </p>
        </div>
      </section>

      <EtreRappele
        origine="sous-traitance"
        titre="Parlons de votre atelier, pas du logiciel."
        texte="Dites-nous ce que vous laquez, pour qui, et ce qu'on vous demande de prouver. On vous montre la chaîne complète sur un cas proche du vôtre, sans engagement et sans commercial."
      />

      <MarketingFooter />
    </main>
  );
}
