import Link from 'next/link'
import { BookOpen, Calendar, ArrowRight, Tag } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

export const metadata: Metadata = {
  title: 'Blog — Ressources thermolaquage — ThermoGestion',
  description: 'Articles, guides et actualités sur le thermolaquage, la gestion d\'atelier et les bonnes pratiques métier.',
}

export const revalidate = 3600 // Revalidate chaque heure

// Articles statiques par défaut (avant que le blog DB soit alimenté)
const DEFAULT_ARTICLES = [
  {
    slug: 'guide-complet-thermolaquage',
    title: 'Le guide complet du thermolaquage en 2026',
    excerpt: 'Tout ce que vous devez savoir sur le thermolaquage : procédé, avantages, normes, certifications et bonnes pratiques.',
    tags: ['guide', 'thermolaquage', 'normes'],
    published_at: '2026-01-15',
    cover_image_url: null,
  },
  {
    slug: 'certifications-qualicoat-qualimarine',
    title: 'Certifications QUALICOAT et QUALIMARINE : tout comprendre',
    excerpt: 'Les certifications qualité sont essentielles pour les ateliers de thermolaquage. Découvrez les exigences et le processus de certification.',
    tags: ['certification', 'QUALICOAT', 'QUALIMARINE'],
    published_at: '2026-01-28',
    cover_image_url: null,
  },
  {
    slug: 'optimiser-consommation-poudre',
    title: 'Comment optimiser la consommation de poudre dans votre atelier',
    excerpt: 'Réduisez vos coûts matière de 15-25% grâce à ces techniques d\'optimisation du rendement poudre.',
    tags: ['optimisation', 'poudre', 'économies'],
    published_at: '2026-02-03',
    cover_image_url: null,
  },
  {
    slug: 'facturation-electronique-2026',
    title: 'Facturation électronique obligatoire 2026 : êtes-vous prêt ?',
    excerpt: 'La facturation électronique Factur-X devient obligatoire en France. Voici ce que les ateliers doivent savoir.',
    tags: ['facturation', 'Factur-X', 'réglementation'],
    published_at: '2026-02-05',
    cover_image_url: null,
  },
  {
    slug: 'maintenance-preventive-four-cuisson',
    title: 'Maintenance préventive du four de cuisson : le planning idéal',
    excerpt: 'Un four bien entretenu c\'est moins de pannes, une meilleure qualité et des économies d\'énergie. Voici notre guide.',
    tags: ['maintenance', 'four', 'qualité'],
    published_at: '2026-02-07',
    cover_image_url: null,
  },
]

export default async function BlogPage() {
  let articles = DEFAULT_ARTICLES

  // Tenter de charger depuis Supabase
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('blog_articles')
      .select('slug, title, excerpt, tags, published_at, cover_image_url')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(20)
    
    if (data && data.length > 0) articles = data
  } catch {
    // Utiliser les articles par défaut
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <section className="bg-gradient-to-br from-orange-500 to-red-600 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <BookOpen className="w-16 h-16 mx-auto mb-6 text-orange-200" />
          <h1 className="text-4xl font-black mb-4">Blog & Ressources</h1>
          <p className="text-xl text-orange-100 max-w-2xl mx-auto">
            Articles, guides pratiques et actualités pour les professionnels du thermolaquage
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="space-y-8">
          {articles.map(article => (
            <article key={article.slug} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <time className="text-sm text-gray-500">
                    {article.published_at ? new Date(article.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </time>
                  {(article.tags as string[])?.map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 hover:text-orange-600 transition-colors">
                  <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{article.excerpt}</p>
                <Link href={`/blog/${article.slug}`} className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium text-sm">
                  Lire l&apos;article <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
