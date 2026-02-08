import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function MentionsLegalesPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'mentions-legales.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Mentions légales')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
