import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'

export default function ContactPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'contact.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Contact')

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
