import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function AidePage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'aide.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Aide')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
