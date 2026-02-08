import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function CGUPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'cgu.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Conditions Générales d\'Utilisation')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
