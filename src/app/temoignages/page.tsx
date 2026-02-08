import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function TemoignagesPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'temoignages.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Témoignages')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
