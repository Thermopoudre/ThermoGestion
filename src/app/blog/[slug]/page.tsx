import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar, ArrowLeft, Clock } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export const revalidate = 3600

const DEFAULT_ARTICLES = [
  {
    slug: 'guide-complet-thermolaquage',
    title: 'Le guide complet du thermolaquage en 2026',
    excerpt: 'Tout ce que vous devez savoir sur le thermolaquage : procédé, avantages, normes, certifications et bonnes pratiques.',
    tags: ['guide', 'thermolaquage', 'normes'],
    published_at: '2026-01-15',
    cover_image_url: null,
    read_time: 8,
  },
  {
    slug: 'certifications-qualicoat-qualimarine',
    title: 'Certifications QUALICOAT et QUALIMARINE : tout comprendre',
    excerpt: 'Les certifications qualité sont essentielles pour les ateliers de thermolaquage. Découvrez les exigences et le processus de certification.',
    tags: ['certification', 'QUALICOAT', 'QUALIMARINE'],
    published_at: '2026-01-28',
    cover_image_url: null,
    read_time: 6,
  },
  {
    slug: 'optimiser-consommation-poudre',
    title: 'Comment optimiser la consommation de poudre dans votre atelier',
    excerpt: 'Réduisez vos coûts matière de 15-25% grâce à ces techniques d\'optimisation du rendement poudre.',
    tags: ['optimisation', 'poudre', 'économies'],
    published_at: '2026-02-03',
    cover_image_url: null,
    read_time: 7,
  },
  {
    slug: 'facturation-electronique-2026',
    title: 'Facturation électronique obligatoire 2026 : êtes-vous prêt ?',
    excerpt: 'La facturation électronique Factur-X devient obligatoire en France. Voici ce que les ateliers doivent savoir.',
    tags: ['facturation', 'Factur-X', 'réglementation'],
    published_at: '2026-02-05',
    cover_image_url: null,
    read_time: 5,
  },
  {
    slug: 'maintenance-preventive-four-cuisson',
    title: 'Maintenance préventive du four de cuisson : le planning idéal',
    excerpt: 'Un four bien entretenu c\'est moins de pannes, une meilleure qualité et des économies d\'énergie. Voici notre guide.',
    tags: ['maintenance', 'four', 'qualité'],
    published_at: '2026-02-07',
    cover_image_url: null,
    read_time: 6,
  },
]

const ARTICLE_CONTENTS: Record<string, string> = {
  'guide-complet-thermolaquage': `
<h2>Qu'est-ce que le thermolaquage ?</h2>
<p>Le thermolaquage (ou peinture en poudre) est un procédé de revêtement de surface qui consiste à appliquer une peinture en poudre sèche sur un substrat métallique, puis à la polymériser au four. Contrairement aux peintures liquides, la peinture en poudre ne contient pas de solvant, ce qui en fait une solution plus respectueuse de l'environnement.</p>
<p>Le procédé se décompose en 4 étapes principales : prétraitement de surface, application électrostatique de la poudre, passage au four de cuisson (160-200°C), et refroidissement.</p>

<h2>Les avantages du thermolaquage</h2>
<p>Le thermolaquage offre de nombreux avantages par rapport aux autres techniques de revêtement :</p>
<ul>
  <li><strong>Résistance supérieure :</strong> excellente résistance aux chocs, à la corrosion et aux UV</li>
  <li><strong>Uniformité du revêtement :</strong> épaisseur homogène sur toutes les surfaces, y compris les zones complexes</li>
  <li><strong>Écologie :</strong> 0% de COV (composés organiques volatils), recyclabilité des excédents de poudre</li>
  <li><strong>Productivité :</strong> temps de séchage quasi nul, pas de retouches de coulures</li>
  <li><strong>Finitions variées :</strong> mat, satiné, brillant, texturé, métallisé — palette RAL et RAL Design complète</li>
</ul>

<h2>Les normes et certifications clés</h2>
<p>En 2026, plusieurs normes encadrent la qualité des revêtements par poudre :</p>
<ul>
  <li><strong>ISO 2360 :</strong> mesure de l'épaisseur du revêtement par courant de Foucault</li>
  <li><strong>ISO 2409 (test quadrillage) :</strong> évaluation de l'adhérence</li>
  <li><strong>EN 13438 :</strong> revêtements sur produits en acier galvanisé</li>
  <li><strong>QUALICOAT :</strong> label qualité pour l'architecture et la façade</li>
  <li><strong>QUALIMARINE :</strong> certification pour environnements marins et agressifs</li>
</ul>

<h2>Bonnes pratiques pour un atelier performant</h2>
<p>La qualité du thermolaquage dépend à 70% de la qualité du prétraitement. Une surface mal dégraissée ou phosphatée donnera un revêtement qui s'écaille rapidement. Investir dans une ligne de prétraitement efficace est donc prioritaire.</p>
<p>Pour la gestion quotidienne de votre atelier, un logiciel spécialisé comme ThermoGestion vous permet de tracer chaque étape de production, gérer vos stocks de poudre, et générer vos certificats de conformité en un clic.</p>
  `,

  'certifications-qualicoat-qualimarine': `
<h2>Pourquoi se certifier ?</h2>
<p>Dans un marché où la concurrence est forte, les certifications QUALICOAT et QUALIMARINE sont devenues des arguments commerciaux essentiels. Elles permettent à votre atelier d'accéder à des marchés plus exigeants : menuiseries aluminium pour la construction, mobilier urbain, équipements côtiers...</p>
<p>Concrètement, de nombreux donneurs d'ordre (architectes, collectivités, industriels) imposent ces certifications dans leurs cahiers des charges. Sans elles, vous êtes systématiquement écarté des appels d'offres.</p>

<h2>QUALICOAT : la certification pour l'architecture</h2>
<p>Le label QUALICOAT garantit la qualité des revêtements par poudre et liquide sur aluminium et alliages d'aluminium destinés à des applications architecturales. Il est reconnu dans plus de 40 pays.</p>
<p><strong>Exigences principales :</strong></p>
<ul>
  <li>Épaisseur minimum : 60 µm (classe 1) ou 60 µm avec spécifications supplémentaires (classe 2)</li>
  <li>Adhérence au quadrillage : 0 ou 1 selon ISO 2409</li>
  <li>Test de brouillard salin : 1 000 heures (classe 1) ou 2 000 heures (classe 2)</li>
  <li>Résistance aux UV : test Florida 1 an (classe 1) ou 3 ans (classe 2)</li>
  <li>Audits annuels par organisme agréé</li>
</ul>

<h2>QUALIMARINE : pour les environnements agressifs</h2>
<p>QUALIMARINE est une certification complémentaire à QUALICOAT, destinée aux revêtements exposés à des atmosphères marines ou particulièrement agressives. Elle impose des critères encore plus stricts :</p>
<ul>
  <li>Épaisseur minimum : 80 µm</li>
  <li>Brouillard salin acétique : 3 000 heures</li>
  <li>Test d'immersion : 1 500 heures</li>
  <li>Contrôle de la ligne de prétraitement tous les 6 mois</li>
</ul>

<h2>Le processus de certification</h2>
<p>Pour obtenir ces certifications, votre atelier doit passer par plusieurs étapes : dossier de candidature, audit initial par un organisme agréé (Qualisteelcoat pour la France), tests en laboratoire accrédité, puis audits de surveillance annuels.</p>
<p>ThermoGestion simplifie ce processus en vous permettant de conserver tous vos enregistrements de production (températures four, épaisseurs mesurées, traçabilité des lots de poudre) directement accessibles pour les auditeurs.</p>
  `,

  'optimiser-consommation-poudre': `
<h2>Comprendre le rendement de transfert</h2>
<p>Le rendement de transfert est le rapport entre la quantité de poudre réellement déposée sur la pièce et la quantité de poudre sortie du pistolet. Un rendement moyen en application libre est de 50-65%. Avec une cabine à récupération, vous pouvez atteindre 95-98% en incluant la poudre recyclée.</p>
<p>Améliorer ce rendement est le levier le plus direct pour réduire votre consommation de poudre.</p>

<h2>Les paramètres d'application à optimiser</h2>
<p><strong>1. La tension électrostatique (kV)</strong><br>Une tension trop élevée crée l'effet "cage de Faraday" et réduit l'adhérence dans les recoins. Commencez par 60-70 kV et ajustez selon la géométrie des pièces.</p>
<p><strong>2. Le débit d'air de transport (l/min)</strong><br>Un débit trop élevé éparpille la poudre. Visez le minimum nécessaire pour obtenir un nuage homogène — généralement 300-400 ml/min pour la plupart des poudres.</p>
<p><strong>3. La distance pistolet-pièce (cm)</strong><br>La distance optimale est généralement 20-30 cm. Trop près : surcharge électrostatique. Trop loin : perte de poudre en suspension.</p>
<p><strong>4. La vitesse de convoyage (m/min)</strong><br>Ajustez la vitesse selon le profil des pièces pour garantir une couverture homogène sans surépaisseur inutile.</p>

<h2>Gestion et recyclage de la poudre</h2>
<p>Les excédents de poudre récupérés par cyclone ou filtre peuvent être réintroduits dans le circuit. Cependant, le mélange poudre vierge/recyclée doit respecter un ratio maximum de 30-40% de recyclée pour maintenir la qualité du film.</p>
<p>Stockez toujours vos poudres dans un local tempéré (15-25°C) et à l'abri de l'humidité. Une poudre mal stockée agglomère et génère des défauts (cratères, picots).</p>

<h2>Suivi des consommations avec ThermoGestion</h2>
<p>ThermoGestion intègre un module de gestion des stocks de poudre qui vous permet de suivre votre consommation par projet, par client et par teinte. Identifiez rapidement les teintes qui génèrent le plus de pertes et optimisez vos processus en conséquence.</p>
<p>En suivant ces données sur 3 mois, nos clients constatent en moyenne 18% de réduction sur leurs achats de poudre.</p>
  `,

  'facturation-electronique-2026': `
<h2>Le calendrier de la réforme</h2>
<p>La loi de finances 2024 a confirmé l'obligation de facturation électronique pour les entreprises françaises assujetties à la TVA. Voici le calendrier applicable :</p>
<ul>
  <li><strong>1er septembre 2026 :</strong> obligation de <em>réception</em> des factures électroniques pour toutes les entreprises</li>
  <li><strong>1er septembre 2026 :</strong> obligation d'<em>émission</em> pour les grandes entreprises (&gt;5 000 salariés ou &gt;1,5 Md€ CA)</li>
  <li><strong>1er septembre 2027 :</strong> obligation d'émission pour les ETI (&gt;250 salariés ou &gt;50 M€ CA)</li>
  <li><strong>1er septembre 2027 :</strong> obligation d'émission pour les PME, TPE et microentreprises</li>
</ul>

<h2>Le format Factur-X : qu'est-ce que c'est ?</h2>
<p>Factur-X est le format franco-allemand de facture électronique hybride. Il combine un fichier PDF lisible par l'humain avec des données XML structurées (XRechnung) lisibles par les machines. C'est le format recommandé pour les PME car il est compatible avec les outils existants.</p>
<p>Il existe 5 profils Factur-X selon la richesse des données structurées : MINIMUM, BASIC WL, BASIC, EN 16931 et EXTENDED. Les ateliers de thermolaquage devront utiliser au minimum le profil EN 16931.</p>

<h2>Ce que cela change pour votre atelier</h2>
<p>Concrètement, vous ne pourrez plus envoyer des PDF simples à vos clients assujettis à la TVA. Vos factures devront transiter par une Plateforme de Dématérialisation Partenaire (PDP) agréée par l'administration fiscale.</p>
<p>L'administration fiscale pourra ainsi accéder en temps réel à vos données de facturation (e-reporting). Cela permettra à terme la pré-remplissage de la déclaration de TVA.</p>

<h2>Se préparer dès maintenant</h2>
<p>Ne pas attendre la dernière minute. Voici les actions à entreprendre :</p>
<ul>
  <li>Choisir une PDP agréée (liste disponible sur impots.gouv.fr)</li>
  <li>Mettre à jour votre logiciel de facturation pour qu'il supporte Factur-X</li>
  <li>Former votre comptable ou gestionnaire</li>
  <li>Mettre à jour vos fiches clients avec les données obligatoires (SIRET, adresse de livraison)</li>
</ul>
<p>ThermoGestion intègre nativement la génération de factures au format Factur-X, compatible avec les principales PDP du marché. Vos factures sont automatiquement conformes à la réglementation 2026.</p>
  `,

  'maintenance-preventive-four-cuisson': `
<h2>Pourquoi la maintenance préventive est critique</h2>
<p>Le four de cuisson est le cœur de votre atelier de thermolaquage. Une panne imprévue peut immobiliser votre production pendant 2 à 5 jours, engendrant des pertes directes (production arrêtée) et indirectes (clients mécontents, pénalités de retard). Le coût d'une intervention d'urgence est 3 à 5 fois supérieur à celui d'une maintenance planifiée.</p>
<p>De plus, un four mal entretenu consomme davantage d'énergie : l'isolation dégradée et les brûleurs encrassés peuvent augmenter votre facture énergétique de 15-20%.</p>

<h2>Le planning de maintenance idéal</h2>
<p><strong>Quotidien :</strong></p>
<ul>
  <li>Contrôle visuel des résistances ou brûleurs</li>
  <li>Vérification de la température affichée vs thermocouple de référence</li>
  <li>Nettoyage des filtres d'extraction si présents</li>
</ul>
<p><strong>Hebdomadaire :</strong></p>
<ul>
  <li>Nettoyage de la chambre de cuisson (dépôts de poudre brûlée)</li>
  <li>Contrôle de l'étanchéité des joints de portes</li>
  <li>Vérification des rails de convoyage</li>
</ul>
<p><strong>Mensuel :</strong></p>
<ul>
  <li>Calibration des thermocouples avec sonde de référence étalonnée</li>
  <li>Contrôle et nettoyage des brûleurs (four gaz) ou des résistances (four électrique)</li>
  <li>Vérification du système de ventilation forcée</li>
  <li>Enregistrement du relevé de température sur toute la section du four (profil thermique)</li>
</ul>
<p><strong>Annuel :</strong></p>
<ul>
  <li>Révision complète par un technicien agréé</li>
  <li>Remplacement préventif des résistances ou électrodes d'allumage</li>
  <li>Vérification de l'isolation thermique</li>
  <li>Enregistrement complet du profil de cuisson avec data logger</li>
</ul>

<h2>La traçabilité des maintenances</h2>
<p>Pour les ateliers certifiés QUALICOAT, la tenue d'un registre de maintenance est obligatoire. Les auditeurs vérifieront que les calibrations de thermocouples sont régulièrement réalisées et que les écarts sont dans les tolérances (+/- 5°C selon QUALICOAT).</p>
<p>ThermoGestion intègre un module de suivi des équipements qui vous permet de planifier vos interventions, enregistrer vos contrôles et générer les rapports requis lors des audits de certification.</p>

<h2>Signes avant-coureurs à surveiller</h2>
<p>Ne pas attendre la panne. Ces symptômes indiquent un four qui nécessite une intervention :</p>
<ul>
  <li>Temps de montée en température plus long qu'habituellement</li>
  <li>Consommation électrique ou gaz anormalement élevée</li>
  <li>Écarts de température entre différentes zones du four (&gt;10°C)</li>
  <li>Odeur de brûlé persistante après nettoyage</li>
  <li>Défauts répétitifs sur les pièces (jaunissement, aspect mat irrégulier)</li>
</ul>
  `,
}

type ArticleRow = {
  slug: string
  title: string
  excerpt: string
  tags: string[] | null
  published_at: string | null
  cover_image_url: string | null
  content: string | null
  read_time?: number
}

export async function generateStaticParams() {
  return DEFAULT_ARTICLES.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const defaultArticle = DEFAULT_ARTICLES.find((a) => a.slug === slug)
  if (!defaultArticle) return {}
  return {
    title: `${defaultArticle.title} — ThermoGestion`,
    description: defaultArticle.excerpt,
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let article: ArticleRow | null = null

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('blog_articles')
      .select('slug, title, excerpt, tags, published_at, cover_image_url, content')
      .eq('slug', slug)
      .eq('published', true)
      .single()

    if (data) article = data
  } catch {
    // Supabase indisponible ou article absent — fallback
  }

  if (!article) {
    const defaultArticle = DEFAULT_ARTICLES.find((a) => a.slug === slug)
    if (!defaultArticle) notFound()
    article = {
      ...defaultArticle,
      content: ARTICLE_CONTENTS[slug] || null,
    }
  }

  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const readTime = (article as ArticleRow & { read_time?: number }).read_time

  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />

      {/* Hero article */}
      <section className="pt-32 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <div className="max-w-3xl mx-auto px-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au blog
          </Link>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {(article.tags as string[]).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded-full text-xs border border-orange-500/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-black text-white mb-6 leading-tight">
            {article.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            {publishedDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {publishedDate}
              </span>
            )}
            {readTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {readTime} min de lecture
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Contenu */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Excerpt */}
        <p className="text-lg text-gray-300 leading-relaxed mb-10 pb-10 border-b border-gray-800">
          {article.excerpt}
        </p>

        {/* Corps de l'article */}
        {article.content ? (
          <div
            className="prose prose-invert prose-orange max-w-none
              prose-headings:font-bold prose-headings:text-white
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-li:text-gray-300
              prose-strong:text-white
              prose-a:text-orange-400 hover:prose-a:text-orange-300"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        ) : (
          <div className="text-center py-16 text-gray-500">
            <p>Le contenu de cet article sera disponible prochainement.</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 p-8 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl border border-orange-500/20 text-center">
          <h3 className="text-xl font-bold text-white mb-3">
            Gérez votre atelier plus efficacement
          </h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            ThermoGestion est le logiciel conçu spécifiquement pour les ateliers de thermolaquage.
          </p>
          <Link
            href="/auth/inscription"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-400 hover:to-red-400 transition-all"
          >
            Essai gratuit 30 jours
          </Link>
        </div>

        {/* Retour blog */}
        <div className="mt-10 pt-8 border-t border-gray-800">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voir tous les articles
          </Link>
        </div>
      </div>

      <VitrineFooter />
    </div>
  )
}
