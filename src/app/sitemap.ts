import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    '',
    '/tarifs',
    '/fonctionnalites',
    '/contact',
    '/aide',
    '/temoignages',
    '/mentions-legales',
    '/cgu',
    '/cgv',
    '/confidentialite',
    '/cookies',
  ]

  return staticPages.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
