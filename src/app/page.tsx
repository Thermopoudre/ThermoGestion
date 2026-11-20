import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  FileSignature, QrCode, FlaskConical, Smartphone, ArrowRight, Check,
  CircleDot, Factory, ShieldCheck,
} from "lucide-react";
import TrackView from "@/components/TrackView";
import RalStrip from "@/components/RalStrip";
import AvisDemoIndisponible from "@/components/AvisDemoIndisponible";
import { PhoneFrame, DemoSuivi, DemoKanban, DemoDevis, DemoStock } from "@/components/DemoScreens";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/Chrome";
import EtreRappele from "@/components/marketing/EtreRappele";
import { JsonLd, faqJsonLd } from "@/components/JsonLd";
import { OFFRES, PRIX_SIEGE_ANNUEL, PRIX_SIEGE_MENSUEL, SIEGES_INCLUS } from "@/lib/abonnement";
import { nombreFr } from "@/lib/utils";

// Titre ≤ 60 caractères, description ≤ 155 : au-delà, Google les retronque lui-même dans le
// résultat de recherche, avec une coupure qu'on ne maîtrise plus (l'ancien titre faisait 74
// caractères, la description 205 — Lot G, point 1). « Rénovation de jantes » n'a pas la place ici
// et reste porté par sa propre page de destination et son propre titre, indexée séparément.
const TITRE = "Thermogestion — logiciel d'atelier de thermolaquage";
const DESCRIPTION =
  "Devis au m² ou au pouce, signés en ligne. Suivi de production au QR, poudre décomptée à la cuisson. Dès 79 € HT/mois, essai 30 jours sans carte.";

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITRE, description: DESCRIPTION, url: "/", type: "website", locale: "fr_FR", siteName: "Thermogestion" },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
};

/**
 * Réponse directe, extractible, en tête de page.
 *
 * Les moteurs de réponse citent un paragraphe qui répond littéralement à la question posée, avant
 * tout argumentaire, et qui contient des chiffres opposables. Ce bloc est écrit pour ça — pas
 * pour le visiteur, qui lira le héros juste au-dessus.
 */
const REPONSE_DIRECTE =
  "Thermogestion est un logiciel français de gestion d'atelier pour deux métiers : le thermolaquage (peinture poudre) et la rénovation de jantes alu. Il chiffre un devis au m², au mètre linéaire ou au pouce, le fait signer en ligne, suit la production étape par étape au QR code, décompte la poudre à la cuisson et édite factures Factur-X, export FEC et certificats de conformité. Trois formules : 79 € HT par mois avec 2 utilisateurs inclus, 129 € avec 5 utilisateurs et les fonctions d'équipe, 249 € avec 10 utilisateurs et la qualité tracée et opposable. L'utilisateur au-delà des sièges compris coûte 5 € HT par mois. Sans frais de mise en route, avec 30 jours d'essai sans carte bancaire.";

const MODULES = [
  {
    Icon: FileSignature,
    titre: "Devis en 2 minutes, signé en ligne",
    texte:
      "Grille au m², au mètre linéaire ou au pouce pour un jeu de jantes — paliers, finitions, complexité. Le client reçoit un lien et signe au doigt depuis son téléphone. Signature horodatée, adresse IP conservée, valeur d'accord.",
  },
  {
    Icon: QrCode,
    titre: "Production suivie au scan",
    texte:
      "Devis signé = projet créé tout seul. Kanban d'atelier, un QR par projet : un scan valide l'étape et lance le chronomètre. La date promise passe au rouge sur le kanban dès qu'elle approche.",
  },
  {
    Icon: FlaskConical,
    titre: "Poudre décomptée à la cuisson",
    texte:
      "Chaque cuisson décompte le lot consommé, en FIFO et par date limite d'utilisation. Pesées pour recaler le réel, seuil d'alerte par teinte, et le panier de réapprovisionnement Thermopoudre se prépare tout seul.",
  },
  {
    Icon: Smartphone,
    titre: "Vos clients suivent tout seuls",
    texte:
      "Un lien de suivi par projet et par jeu de jantes : le client voit où en sont ses pièces, roue par roue s'il s'agit de jantes. Fini les appels « c'est prêt quand ? ».",
  },
];

const ETAPES = [
  { n: "01", t: "Créez votre atelier", d: "30 secondes, par numéro SIREN. Grille tarifaire pré-remplie, vous ajustez vos prix." },
  { n: "02", t: "Reprenez vos données", d: "Import CSV ou Excel de vos clients, prestations et poudres. Aperçu avant écriture, dédoublonnage, gratuit." },
  { n: "03", t: "Envoyez votre premier devis", d: "Le client signe en ligne, le projet part en production tout seul." },
];

const FAQ = [
  {
    q: "Thermogestion, c'est fait pour quel type d'atelier ?",
    r: "Pour deux métiers. D'un côté le thermolaquage et la sous-traitance de traitement de surface : sablage, poudrage, cuisson, de l'artisan seul à l'équipe de quinze. De l'autre la rénovation de jantes alu : garages, centres auto, concessions et préparateurs. Si vous faites des devis, de la production en étapes et que vous consommez de la poudre, c'est fait pour vous.",
  },
  {
    q: "Ça gère vraiment la rénovation de jantes ?",
    r: "C'est le seul logiciel du marché français qui la gère. Chiffrage au pouce avec coefficient de dessin et de finition, teinte d'origine constructeur mémorisée par véhicule, suivi roue par roue, opérations mécaniques (dévoilage, redressage, soudure, TPMS, équilibrage) comptées à la jante concernée, et un bon de prise en charge photographié jante par jante et signé par le garage avant démontage. Le barème livré par défaut va de 70 € HT pour une jante de moins de 17 pouces à 130 € HT au-delà de 21 pouces, et vous ajustez tout.",
  },
  {
    q: "Combien ça coûte, par rapport à un ERP de thermolaquage ?",
    r: "Trois formules, sans frais de mise en route et sans engagement : Atelier à 79 € HT par mois pour le métier complet — jantes comprises — avec 2 utilisateurs inclus, Équipe à 129 € avec 5 utilisateurs, la planification des fournées et la rentabilité par client, Certifié à 249 € avec 10 utilisateurs, le cahier de contrôles et le certificat de conformité opposable. Au-delà des utilisateurs compris dans votre formule, chaque utilisateur supplémentaire coûte 5 € HT par mois, ou 50 € HT par an : il n'y a pas d'autre supplément, et rien à découvrir après la souscription. Les ERP métier du secteur demandent couramment 5 000 € de mise en route, 1 000 € par mois et trois ans d'engagement : c'est justifié pour un sous-traitant industriel de trente personnes avec une équipe administrative, pas pour un atelier de trois.",
  },
  {
    q: "Puis-je délivrer un certificat de conformité à mon client ?",
    r: "Oui, et le document refuse de s'imprimer quand les mesures ne le permettent pas. Les seuils sont ceux du référentiel que vous déclarez (Qualicoat, Qualisteelcoat, Qualimarine, Qualidéco ou votre propre barème), le verdict de conformité est recalculé par la base de données et non par le navigateur, un contrôle enregistré ne peut plus être ni modifié ni supprimé, et les contrôles non réalisés sont nommés sur le certificat. Un instrument non étalonné et une certification expirée bloquent l'édition.",
  },
  {
    q: "Et si mon client conteste un choc ou un capteur TPMS cassé ?",
    r: "Le bon de prise en charge est signé en ligne par le garage avant démontage, avec une photo par jante et l'état constaté roue par roue. Il est horodaté, l'adresse IP du signataire est conservée, et il est téléchargeable en PDF. C'est le document qui règle le litige le plus fréquent et le plus cher du métier.",
  },
  {
    q: "Mes factures seront-elles conformes à la facturation électronique ?",
    r: "Oui. Thermogestion produit des factures Factur-X au format PDF/A-3 avec le XML CII incorporé, porte les mentions légales obligatoires (articles L441-9, L441-10, R.123-237 et, en franchise en base, l'article 293 B) et exporte le FEC attendu par l'administration en cas de contrôle, ainsi qu'un CSV pour votre comptable.",
  },
  {
    q: "Il faut installer quelque chose ?",
    r: "Non. Ça marche dans le navigateur, sur téléphone, tablette et PC. Ajoutez l'application à votre écran d'accueil et elle se comporte comme une application native. Les écrans d'atelier sont pensés pour être utilisés avec des gants.",
  },
  {
    q: "Mes données sont où, et puis-je les récupérer ?",
    r: "Hébergées en Europe, chiffrées, isolées par atelier — un atelier ne peut techniquement pas lire les données d'un autre. Vous téléchargez à tout moment une archive complète : un fichier CSV par table plus un JSON, 38 tables. Seule réserve à connaître : les photos ne sont pas dans l'archive, seuls leurs chemins.",
  },
  {
    q: "Et si j'arrête ?",
    r: "Sans engagement, vous arrêtez quand vous voulez. L'essai de 30 jours ne demande pas de carte bancaire, et vos données restent exportables.",
  },
];

/** Les deux portes d'entrée. C'est le bloc qui décide de la suite de la visite. */
const METIERS = [
  {
    Icon: CircleDot,
    kicker: "Vous rénovez des jantes",
    titre: "Un jeu chiffré en deux appuis, et une roue qui ne se perd plus",
    texte:
      "Prix au pouce, dessin et finition, teinte d'origine constructeur, suivi roue par roue, bon de prise en charge photographié et signé avant démontage. Aucun autre logiciel français ne connaît la jante.",
    href: "/logiciel-renovation-jantes",
    cta: "Le logiciel de rénovation de jantes",
  },
  {
    Icon: Factory,
    kicker: "Vous laquez pour d'autres",
    titre: "La traçabilité que votre donneur d'ordre réclame, sans ERP à 1 000 € par mois",
    texte:
      "Devis au m² et au mètre linéaire, fournées et fiche de cuisson tracée, lot de poudre chaîné jusqu'à la pièce livrée, registre de contrôles et certificat de conformité, Factur-X et FEC.",
    href: "/logiciel-sous-traitance-thermolaquage",
    cta: "Le logiciel de sous-traitance thermolaquage",
  },
];

const PREUVES_QUALITE = [
  "Six types de contrôle, avec les seuils du référentiel que vous déclarez — et les contrôles que vous ne pratiquez pas se désactivent au lieu de bloquer.",
  "Le verdict de conformité est rendu par la base de données, jamais par le navigateur : un relevé ne peut pas être déclaré conforme s'il ne l'est pas, ni l'inverse.",
  "Un contrôle enregistré ne se modifie plus et ne se supprime pas. La correction passe par une nouvelle mesure, qui prime.",
  "Le certificat refuse de s'imprimer sans mesure, avec un instrument non étalonné ou sous une certification expirée — et il nomme les contrôles non réalisés.",
  "Registre des contrôles et registre des bains en PDF, prêts à poser sur la table de l'auditeur.",
];

// Ni `async`, ni `searchParams` : lire l'URL ici forçait Next à rendre la page dynamiquement à
// chaque visite (`x-vercel-cache: MISS`, TTFB 480 ms au lieu de 170 sur les pages filles — Lot G,
// point 1). Le seul besoin réel — l'avis « démo indisponible » — est déplacé dans un composant
// client, `AvisDemoIndisponible`, posé en Suspense juste en dessous.
export default function Home() {
  return (
    <main className="bg-white text-zinc-900">
      <TrackView event="visit_landing" />
      <JsonLd data={faqJsonLd(FAQ.map((f) => ({ question: f.q, reponse: f.r })))} />

      <MarketingHeader />

      {/* Hero */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1fr_auto]">
          <div>
            {/* H1 unique de la page, et le seul à porter le mot-clé métier (Lot G, point 1) :
                l'ancien H1 était la phrase d'accroche « Du devis signé… », visuellement forte
                mais sans terme cherché. Elle devient le sous-titre visuel juste en dessous ; le
                H1 porte maintenant ce qu'un moteur associe à la requête. */}
            <p className="font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">
              Du devis signé à la pièce livrée, sans paperasse
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Logiciel de gestion d&apos;atelier<br />
              <span className="text-tpblue">thermolaquage et rénovation de jantes.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">
              Devis au m² — ou au pouce pour un jeu de jantes — en deux minutes. Signature en ligne,
              suivi de production au QR code, stock de poudre décompté à la cuisson. Pensé pour le
              métier, utilisable avec des gants.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-tpblue px-7 py-4 font-display text-base font-semibold text-ink transition hover:bg-tpblue-soft">
                Essayer gratuitement 30 jours <ArrowRight size={18} aria-hidden />
              </Link>
              {/* Lien natif et non <Link> : /demo est une route serveur qui pose la session de
                  démonstration, le routeur client de Next la court-circuiterait. */}
              <a href="/demo" className="inline-flex items-center justify-center rounded-lg border border-ink-line px-7 py-4 text-base font-medium text-zinc-200 transition hover:border-zinc-400 hover:text-white">
                Visiter la démo — sans inscription
              </a>
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              Sans carte bancaire · Sans engagement · 0 € de mise en route · Données hébergées en Europe
            </p>
            <Suspense fallback={null}>
              <AvisDemoIndisponible />
            </Suspense>
          </div>
          <div className="hidden justify-center lg:flex">
            <div className="rotate-2 transition hover:rotate-0">
              <PhoneFrame label="Ce que voit votre client, en temps réel">
                <DemoSuivi />
              </PhoneFrame>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="flex items-center gap-4 border-t border-ink-line pt-6">
              <RalStrip />
              <p className="text-sm text-zinc-400">
                <b className="text-zinc-200">Un devis signé en plus par mois rembourse l&apos;abonnement.</b>{" "}
                Vos clients signent depuis leur téléphone au lieu de « rappeler la semaine prochaine ».
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Réponse directe — le paragraphe qu'un moteur de réponse peut citer tel quel */}
      <section className="border-b border-zinc-100 bg-zinc-50 py-10">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">
            Qu&apos;est-ce que Thermogestion ?
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-zinc-700">{REPONSE_DIRECTE}</p>
        </div>
      </section>

      {/* Les deux métiers — le cœur du positionnement */}
      <section id="metiers" className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Deux métiers</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight">
            Un logiciel de thermolaquage. Et le seul qui connaisse la jante.
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-zinc-600">
            Ce sont deux métiers, deux vocabulaires et deux façons de chiffrer. Ils partagent la même
            cabine, le même four et la même poudre — donc le même logiciel, avec deux parcours.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {METIERS.map(({ Icon, kicker, titre, texte, href, cta }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col rounded-xl border border-zinc-200 p-8 transition hover:border-brand hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-light text-brand-dark">
                  <Icon size={22} aria-hidden />
                </span>
                <p className="mt-5 font-display text-xs font-semibold uppercase tracking-kicker text-brand">{kicker}</p>
                <h3 className="mt-2 font-display text-xl font-semibold leading-snug">{titre}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-zinc-600">{texte}</p>
                <span className="mt-6 inline-flex items-center gap-2 font-display font-semibold text-brand-dark">
                  {cta}
                  <ArrowRight size={16} className="transition group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Le produit</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight">Tout l&apos;atelier dans votre poche</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
            {MODULES.map(({ Icon, titre, texte }) => (
              <div key={titre} className="bg-white p-7">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-dark">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section className="border-b border-zinc-100 bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">L&apos;app en vrai</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight">Trois écrans qui font le boulot</h2>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Pas de tableau de bord gadget : le devis que votre client signe, le kanban que votre équipe scanne,
            le stock qui vous prévient avant la panne de poudre.
          </p>
          <div className="mt-10 flex flex-wrap items-start justify-center gap-8 lg:justify-between">
            <PhoneFrame label="Le devis, signé au doigt en 30 secondes">
              <DemoDevis />
            </PhoneFrame>
            <PhoneFrame label="La production, pilotée au scan">
              <DemoKanban />
            </PhoneFrame>
            <PhoneFrame label="Le stock qui prévient avant la panne">
              <DemoStock />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* Qualité — l'argument que personne d'autre ne vend */}
      <section className="bg-ink py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">
            Qualité — Qualicoat, Qualisteelcoat, Qualimarine, Qualidéco
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight">
            Le certificat de conformité qui refuse de mentir.
          </h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-zinc-300">
            Un document qu&apos;on peut forcer ne vaut rien devant un auditeur. Ici, la contrainte est
            posée dans la base de données, pas dans l&apos;écran — et c&apos;est vérifiable.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PREUVES_QUALITE.map((p) => (
              <li key={p} className="flex gap-3 rounded-lg border border-ink-line bg-white/[0.03] p-5">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-tpblue" aria-hidden />
                <span className="text-sm leading-relaxed text-zinc-300">{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-zinc-400">
            <Link href="/logiciel-sous-traitance-thermolaquage" className="font-medium text-tpblue underline underline-offset-2">
              Voir en détail ce que la traçabilité couvre
            </Link>{" "}
            — lot de poudre, fiche de cuisson, registre des bains, étalonnage, registre des déchets.
          </p>
        </div>
      </section>

      {/* Démarrage */}
      <section className="border-b border-zinc-100 bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Démarrage</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">En production le jour même</h2>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Pas de projet de déploiement, pas de paramétrage à facturer, pas de formation obligatoire.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {ETAPES.map((e) => (
              <div key={e.n} className="border-l-2 border-brand pl-5">
                <div className="font-display text-3xl font-bold text-zinc-300">{e.n}</div>
                <h3 className="mt-2 font-display font-semibold">{e.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">{e.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Exclusif Thermopoudre */}
      <section className="bg-ink py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-10 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">Exclusif — connecté à Thermopoudre</p>
              <h2 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight">
                Votre poudre commandée avant d&apos;être à sec.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-zinc-300">
                Thermogestion connaît votre consommation réelle : quand une teinte passe sous le seuil,
                elle se met d&apos;elle-même au panier de réapprovisionnement, prêt à envoyer à
                thermopoudre.fr — toutes les teintes RAL et toutes les teintes d&apos;origine
                constructeur pour les jantes. L&apos;éditeur de ce logiciel est votre fournisseur de
                poudre : aucun autre ne peut faire ça.
              </p>
              <p className="mt-6 inline-block rounded-lg border border-tpblue/40 bg-tpblue/10 px-4 py-2.5 text-sm font-medium text-white">
                Client Thermopoudre actif : <b className="text-tpblue">−20 %</b> sur votre abonnement,
                tant que votre compte est actif.
              </p>
            </div>
            <RalStrip size={22} className="hidden flex-col !items-stretch gap-2 sm:flex" />
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Tarifs</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Simple, sans surprise</h2>
          <p className="mt-2 text-zinc-600">
            30 jours d&apos;essai gratuit, sans carte bancaire. À l&apos;année : <b>2 mois offerts</b>.
            Aucun frais de mise en route, aucun engagement de durée.
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
          {/* Le siège supplémentaire est annoncé au même endroit que les formules, et pas en note
              de bas de page : un prix découvert après la souscription est ce qui coûte le plus
              cher en confiance chez un artisan. */}
          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <h3 className="font-display font-semibold">L&apos;utilisateur supplémentaire</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Chaque formule comprend des utilisateurs :{" "}
              {OFFRES.map((o) => `${o.nom} ${SIEGES_INCLUS[o.code]}`).join(", ")}. Au-delà, un
              utilisateur coûte <b>{PRIX_SIEGE_MENSUEL} € HT par mois</b> ({PRIX_SIEGE_ANNUEL} € HT par
              an, deux mois offerts comme sur les formules). Vous l&apos;ajoutez et vous le retirez
              depuis l&apos;application, sans nous écrire.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Changer de formule ne sert donc plus à embaucher : la formule Équipe s&apos;achète pour
              la planification des fournées, la rentabilité par client et les relances, pas pour un
              accès de plus.
            </p>
          </div>
          <p className="mt-6 text-center text-sm text-zinc-500">
            <Link href="/prix-logiciel-thermolaquage" className="font-medium text-brand-dark underline underline-offset-2">
              Comparer avec Excel, un ERP générique et un ERP métier du secteur
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Questions fréquentes</h2>
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
        </div>
      </section>

      <EtreRappele origine="accueil" />

      {/* CTA final */}
      <section className="bg-ink py-20 text-center text-white">
        <div className="mx-auto max-w-2xl px-4">
          <RalStrip className="justify-center" />
          <h2 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Votre prochain devis peut être signé ce soir.
          </h2>
          <Link href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-tpblue px-8 py-4 font-display text-lg font-semibold text-ink transition hover:bg-tpblue-soft">
            Créer mon atelier — essai 30 jours <ArrowRight size={18} aria-hidden />
          </Link>
          <p className="mt-4 text-sm text-zinc-300">
            Pas encore convaincu ? <a href="/demo" className="font-medium text-tpblue underline underline-offset-2">Visitez l&apos;atelier de démonstration</a> — aucun compte, aucune carte.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
