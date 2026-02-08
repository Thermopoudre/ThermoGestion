import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function TarifsPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'tarifs.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Tarifs')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
