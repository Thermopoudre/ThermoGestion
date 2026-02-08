import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function ConfidentialitePage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'confidentialite.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Politique de confidentialité')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
