import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function CGVPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'cgv.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Conditions Générales de Vente')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
