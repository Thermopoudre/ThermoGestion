import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export default function MentionsLegalesPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'mentions-legales.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Mentions légales')

  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      <VitrineFooter />
    </div>
  )
}
