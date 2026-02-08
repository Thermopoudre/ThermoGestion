import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function CookiesPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'cookies.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Cookies')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
