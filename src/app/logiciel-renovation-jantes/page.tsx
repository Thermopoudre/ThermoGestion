import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, Palette, Wrench, Gauge, Car, Check } from "lucide-react";
import TrackView from "@/components/TrackView";
import { MarketingHeader, MarketingFooter } from "@/components/marketing/Chrome";
import EtreRappele from "@/components/marketing/EtreRappele";
import { JsonLd, faqJsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/env";
import { PALIERS_JANTE_DEFAUT, DESSINS_JANTE_DEFAUT, FINITIONS_JANTE_DEFAUT } from "@/lib/jantes";

const TITRE = "Logiciel de rénovation de jantes alu — chiffrage au pouce, suivi roue par roue";
const DESCRIPTION =
  "Le seul logiciel français conçu pour un atelier de rénovation de jantes : devis au pouce en deux appuis, teinte d'origine constructeur, bon de prise en charge photographié et signé avant démontage, suivi jante par jante. Tout le métier jantes dès 79 € HT/mois, essai 30 jours sans carte.";

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  keywords: [
    "logiciel rénovation jantes",
    "logiciel atelier jantes alu",
    "gestion atelier rénovation jantes",
    "chiffrage rénovation jante prix au pouce",
    "bon de prise en charge jantes",
    "teinte d'origine constructeur jante",
    "logiciel peinture jantes",
  ],
  alternates: { canonical: "/logiciel-renovation-jantes" },
  openGraph: { title: TITRE, description: DESCRIPTION, url: "/logiciel-renovation-jantes", type: "article", locale: "fr_FR", siteName: "Thermogestion" },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
};

const REPONSE_DIRECTE =
  "Thermogestion est le seul logiciel de gestion français conçu pour les ateliers de rénovation de jantes alu. Il chiffre un jeu de quatre jantes au pouce en deux appuis, applique un coefficient de dessin et de finition, retrouve la teinte d'origine du constructeur à partir du véhicule, édite un bon de prise en charge photographié jante par jante et signé par le garage avant démontage, et suit chaque roue jusqu'à la livraison. Le module jantes est complet dès la formule d'entrée, à 79 € HT par mois avec 2 utilisateurs compris : un rénovateur de jantes qui travaille seul a tout son métier au tarif d'entrée, et l'utilisateur suivant coûte 5 € HT par mois, pas une formule de plus. Essai de 30 jours sans carte bancaire.";

const DOULEURS = [
  {
    Icon: Camera,
    titre: "« Cette jante était déjà voilée quand je vous l'ai déposée. »",
    texte:
      "C'est le litige le plus fréquent et le plus cher du métier, avec le capteur TPMS cassé — 40 à 120 € la pièce, et une relation client abîmée. Le bon de prise en charge se signe en ligne par le garage, avant démontage, avec une photo par jante et l'état constaté roue par roue : rayures, choc de trottoir, corrosion, voile, fissure, peinture écaillée, diamantage piqué. Horodaté, adresse IP du signataire conservée, téléchargeable en PDF.",
  },
  {
    Icon: Palette,
    titre: "« Je la veux dans la teinte d'origine de ma Golf 8. »",
    texte:
      "Votre client ne dit jamais « RAL 7016 ». Vous cherchez le véhicule, vous trouvez la référence du constructeur, et elle est mémorisée pour ce véhicule : le deuxième jeu du même modèle se chiffre tout seul. La référence constructeur n'est imprimée sur le document que si la teinte est réellement celle d'origine — sinon votre client lirait le code d'une autre couleur sur son devis.",
  },
  {
    Icon: Gauge,
    titre: "« C'est prêt quand ? »",
    texte:
      "Le garage a immobilisé une voiture, il rappelle tous les jours. Un lien de suivi par dossier lui montre où en sont ses quatre roues, sans appeler et sans compte à créer. Et tant qu'une jante est en retouche, le jeu n'est pas annoncé prêt : personne ne se déplace pour rien.",
  },
];

const ETAPES_PRODUCTION = [
  "Dépose du pneu", "Décapage", "Dévoilage", "Sablage", "Laquage",
  "Cuisson", "Diamantage CNC", "Vernis", "Repose du pneu", "Équilibrage",
];

const OPERATIONS = [
  "Dévoilage", "Redressage", "Soudure de fissure", "Dépose et repose du pneu",
  "Équilibrage", "Valve TPMS", "Diamantage CNC",
];

const FAQ = [
  {
    q: "Existe-t-il un logiciel de gestion pour un atelier de rénovation de jantes ?",
    r: "Oui : Thermogestion. C'est aujourd'hui le seul logiciel français qui traite la jante comme un objet de gestion à part entière, avec un chiffrage au pouce, un suivi roue par roue et un bon de prise en charge signé. Les logiciels de garage et de carrosserie classiques traitent la jante comme une ligne de devis avec un temps forfaitaire : ils ne savent ni ce qu'est un chiffrage au pouce, ni ce qu'est un coefficient de dessin, ni suivre quatre roues séparément.",
  },
  {
    q: "Comment se chiffre une rénovation de jante ?",
    r: "Au pouce, puis corrigé par le dessin et par la finition. Le barème livré par défaut dans Thermogestion va de 70 € HT pour une jante de moins de 17 pouces à 130 € HT au-delà de 21 pouces. Le dessin multiplie ce prix de 1 (jante pleine ou 5 branches larges) à 1,4 (multibranches fines ou rayons), parce qu'une multibranches se masque et se poudre bien plus longtemps. La finition multiplie de 1 (teinte unie) à 1,8 (chrome-effet), en passant par le vernis, le bicolore et le diamantage. Vous ajustez tout, et un garage sous contrat garde sa propre grille négociée.",
  },
  {
    q: "Est-ce que je peux facturer une seule jante voilée sur un jeu de quatre ?",
    r: "Oui, et c'est le comportement par défaut. Les opérations mécaniques — dévoilage, redressage, soudure de fissure, dépose et repose du pneu, équilibrage, valve TPMS, diamantage — ne sont pas fondues dans le prix du jeu : chacune apparaît en ligne séparée, quantifiée au nombre de jantes réellement concernées. Une seule jante voilée sur quatre se facture une, pas quatre, et le garage lit pourquoi son devis a augmenté.",
  },
  {
    q: "Comment me protéger d'une réclamation sur un capteur TPMS ?",
    r: "En faisant signer le bon de prise en charge avant de démonter. Il liste les quatre roues, leur position (avant gauche, avant droite, arrière gauche, arrière droite, roue de secours), l'état constaté sur chacune, vos réserves, une photo par jante, et il porte la signature du garage avec son horodatage et l'adresse IP. La valve TPMS est par ailleurs une opération tracée et facturable, comptée à la jante.",
  },
  {
    q: "Le logiciel connaît-il les teintes d'origine des constructeurs ?",
    r: "Oui. Thermogestion est édité par Thermopoudre, seul distributeur en France à proposer toutes les teintes d'origine constructeur pour jantes. Vous cherchez un véhicule, vous obtenez la référence constructeur, et la teinte reste mémorisée pour ce véhicule. Quand une teinte passe sous votre seuil de stock, elle se met d'elle-même au panier de réapprovisionnement.",
  },
  {
    q: "Combien coûte Thermogestion pour un atelier de jantes ?",
    r: "79 € HT par mois, 2 utilisateurs compris, et le module jantes y est entier : chiffrage au pouce, dossier véhicule, suivi roue par roue, teinte d'origine constructeur, bon de prise en charge photographié et signé. Un utilisateur de plus coûte 5 € HT par mois : embaucher un troisième opérateur ne fait pas changer de formule. Ce qui fait passer à 129 € puis à 249 €, ce n'est jamais le métier de la jante : ce sont les fonctions d'équipe — fournées, rentabilité par client, relances — puis la qualité tracée et opposable. Sans frais de mise en route, sans engagement, essai de 30 jours sans carte bancaire, et une démonstration en ligne consultable sans inscription.",
  },
];

const FIL_ARIANE = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Logiciel de rénovation de jantes", item: `${SITE_URL}/logiciel-renovation-jantes` },
  ],
};

function palierLibelle(min: number, max: number | null) {
  if (max == null) return `Plus de ${min} pouces`;
  if (min === 0) return `Moins de ${max} pouces`;
  return `${min} à ${max} pouces`;
}

export default function LogicielRenovationJantes() {
  return (
    <main className="bg-white text-zinc-900">
      <TrackView event="visit_jantes" />
      <JsonLd data={faqJsonLd(FAQ.map((f) => ({ question: f.q, reponse: f.r })))} />
      <JsonLd data={FIL_ARIANE} />

      <MarketingHeader />

      {/* Hero */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-20">
          <nav aria-label="Fil d'Ariane" className="text-sm text-zinc-400">
            <Link href="/" className="transition hover:text-white">Accueil</Link>
            <span className="px-2" aria-hidden>/</span>
            <span className="text-zinc-300">Rénovation de jantes</span>
          </nav>
          <p className="mt-8 font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">
            Rénovation de jantes alu — garages, centres auto, concessions, préparateurs
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Le seul logiciel français<br />
            <span className="text-tpblue">qui connaît la jante.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-300">
            Ni le prix au pouce, ni le coefficient d&apos;une multibranches, ni la teinte d&apos;origine du
            constructeur, ni le capteur TPMS qu&apos;on vous reprochera d&apos;avoir cassé : aucun autre
            logiciel de gestion ne sait ce que c&apos;est. Celui-ci a été écrit pour ça.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Lien natif : /demo est une route serveur qui pose la session de démonstration. */}
            <a href="/demo" className="inline-flex items-center justify-center gap-2 rounded-lg bg-tpblue px-7 py-4 font-display text-base font-semibold text-ink transition hover:bg-tpblue-soft">
              Voir un dossier jantes en démo <ArrowRight size={18} aria-hidden />
            </a>
            <Link href="/signup" className="inline-flex items-center justify-center rounded-lg border border-ink-line px-7 py-4 text-base font-medium text-zinc-200 transition hover:border-zinc-400 hover:text-white">
              Essayer 30 jours gratuitement
            </Link>
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            Sans inscription pour la démo · Sans carte bancaire pour l&apos;essai · Deux dossiers de jantes déjà remplis
          </p>
        </div>
      </section>

      {/* Réponse directe */}
      <section className="border-b border-zinc-100 bg-zinc-50 py-10">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">
            Existe-t-il un logiciel pour un atelier de rénovation de jantes ?
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-zinc-700">{REPONSE_DIRECTE}</p>
        </div>
      </section>

      {/* Les trois douleurs */}
      <section className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Ce qui coûte cher au quotidien</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight">
            Trois phrases qu&apos;un atelier de jantes entend toutes les semaines
          </h2>
          <div className="mt-10 space-y-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200">
            {DOULEURS.map(({ Icon, titre, texte }) => (
              <div key={titre} className="flex flex-col gap-4 bg-white p-7 sm:flex-row sm:gap-6">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-dark">
                  <Icon size={22} aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold leading-snug">{titre}</h3>
                  <p className="mt-2 leading-relaxed text-zinc-600">{texte}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Le chiffrage au pouce */}
      <section className="border-b border-zinc-100 bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Chiffrage</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight">
            Un jeu de quatre chiffré en deux appuis, au pouce.
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-zinc-600">
            Un garage ne mesure jamais une jante en m² : il l&apos;annonce en pouces. Le prix part donc
            d&apos;un palier au pouce, corrigé par le dessin et par la finition. Voici le barème livré
            par défaut — celui que vous voyez avant d&apos;avoir touché à quoi que ce soit.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="font-display font-semibold">Palier au pouce</h3>
              <p className="mt-1 text-xs text-zinc-500">Prix HT à la jante</p>
              <dl className="mt-4 space-y-2 text-sm">
                {PALIERS_JANTE_DEFAUT.map((p) => (
                  <div key={p.diametre_min} className="flex items-baseline justify-between gap-4 border-b border-zinc-100 pb-2">
                    <dt className="text-zinc-600">{palierLibelle(p.diametre_min, p.diametre_max)}</dt>
                    <dd className="font-display font-semibold">{p.prix_jante_ht} €</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="font-display font-semibold">Coefficient de dessin</h3>
              <p className="mt-1 text-xs text-zinc-500">Le masquage et le poudrage d&apos;une multibranches prennent bien plus de temps</p>
              <dl className="mt-4 space-y-2 text-sm">
                {DESSINS_JANTE_DEFAUT.map((d) => (
                  <div key={d.code} className="flex items-baseline justify-between gap-4 border-b border-zinc-100 pb-2">
                    <dt className="text-zinc-600">{d.libelle}</dt>
                    <dd className="font-display font-semibold">× {d.coef}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="font-display font-semibold">Coefficient de finition</h3>
              <p className="mt-1 text-xs text-zinc-500">Le nombre de passages change tout</p>
              <dl className="mt-4 space-y-2 text-sm">
                {FINITIONS_JANTE_DEFAUT.map((f) => (
                  <div key={f.code} className="flex items-baseline justify-between gap-4 border-b border-zinc-100 pb-2">
                    <dt className="text-zinc-600">{f.libelle}</dt>
                    <dd className="font-display font-semibold">× {f.coef}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="mt-8 rounded-xl border-l-4 border-brand bg-white p-6">
            <p className="font-display font-semibold">Un exemple, avec le barème par défaut</p>
            <p className="mt-2 leading-relaxed text-zinc-600">
              Quatre jantes de 19 pouces, dessin standard, teinte unie : palier 100 € × 1,15 de dessin
              × 1 de finition = <b className="text-zinc-900">115 € HT la jante, 460 € HT le jeu</b>. Le
              logiciel en déduit aussi la surface développée, 1,1 m² par jante, qui alimente la
              consommation de poudre, le coût de cuisson et la charge du four. Si ce garage a une
              grille négociée avec vous, c&apos;est la sienne qui s&apos;applique — sans y penser.
            </p>
          </div>
        </div>
      </section>

      {/* Le parcours */}
      <section className="bg-ink py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-tpblue">Production</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight">
            Un parcours de jantes, pas un parcours de portails.
          </h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-zinc-300">
            Les étapes sont celles de votre atelier, pas celles d&apos;un logiciel générique adapté à la
            va-vite. Chaque étape se valide d&apos;un scan depuis le téléphone, et le chronomètre tourne
            tout seul pour que vous sachiez ce que le dossier vous a réellement coûté.
          </p>
          <ol className="mt-10 flex flex-wrap gap-3">
            {ETAPES_PRODUCTION.map((e, i) => (
              <li key={e} className="flex items-center gap-2 rounded-lg border border-ink-line bg-white/[0.03] px-4 py-2.5 text-sm">
                <span className="font-display text-xs font-semibold text-tpblue">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-zinc-200">{e}</span>
              </li>
            ))}
          </ol>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-ink-line p-7">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-tpblue/15 text-tpblue">
                <Car size={20} aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">Roue par roue jusqu&apos;au bout</h3>
              <p className="mt-2 leading-relaxed text-zinc-300">
                Chaque jante porte sa position, son état, ses photos, ses opérations et son statut.
                Trois jantes prêtes et une en retouche : le jeu n&apos;est pas prêt, et le logiciel le
                sait tout seul — la règle est dans la base, pas dans un écran qu&apos;on peut oublier
                de mettre à jour.
              </p>
            </div>
            <div className="rounded-xl border border-ink-line p-7">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-tpblue/15 text-tpblue">
                <Wrench size={20} aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">Les opérations comptées à la jante</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {OPERATIONS.map((o) => (
                  <li key={o} className="rounded border border-ink-line px-2.5 py-1 text-sm text-zinc-300">{o}</li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                Une seule jante voilée sur quatre se facture une, pas quatre. Et une opération dont la
                prestation n&apos;existe pas dans votre catalogue est ignorée plutôt que facturée à
                zéro : une ligne à 0 € vous ferait croire que vous l&apos;avez vendue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ce que vous obtenez */}
      <section className="border-b border-zinc-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">Les documents</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Ce que le garage reçoit, et ce qui vous protège</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              "Le bon de prise en charge : positions, états constatés, réserves, une photo par jante, signature du garage avant démontage, horodatage et adresse IP. En PDF.",
              "Le devis, au pouce, lisible par une voiture et une teinte — « Jeu de 4 jantes 19″ — Volkswagen Golf (2021) — teinte d'origine Pure Grey (LR7H) » — et non par un numéro interne.",
              "Le lien de suivi : le garage voit l'avancement roue par roue, sans compte à créer et sans vous appeler.",
              "Le bon de livraison signé, puis la facture Factur-X conforme à la facturation électronique, avec export FEC pour votre comptable.",
            ].map((t) => (
              <li key={t} className="flex gap-3 rounded-lg border border-zinc-200 p-5">
                <Check size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                <span className="text-sm leading-relaxed text-zinc-600">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 rounded-lg bg-zinc-50 p-5 text-sm leading-relaxed text-zinc-600">
            <b className="text-zinc-900">Vous faites aussi du thermolaquage de pièces ?</b> Tout le socle
            est là : devis au m² et au mètre linéaire, fournées, stock de poudre, certificat de
            conformité.{" "}
            <Link href="/logiciel-sous-traitance-thermolaquage" className="font-medium text-brand-dark underline underline-offset-2">
              Voir la page sous-traitance thermolaquage
            </Link>.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <p className="font-display text-xs font-semibold uppercase tracking-kicker text-brand">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Rénovation de jantes — questions fréquentes</h2>
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

      <EtreRappele
        origine="jantes"
        titre="Montrez-nous un jeu, on vous montre le dossier."
        texte="Dites-nous combien de jeux vous traitez par mois et comment vous les suivez aujourd'hui. On vous fait la démonstration sur un cas réel du vôtre, sans engagement."
      />

      <MarketingFooter />
    </main>
  );
}
