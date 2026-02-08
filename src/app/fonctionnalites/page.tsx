import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function FonctionnalitesPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'fonctionnalites.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Fonctionnalités')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
