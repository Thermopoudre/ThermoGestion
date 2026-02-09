import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export default function ConfidentialitePage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'confidentialite.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Politique de confidentialité')

  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      <VitrineFooter />
    </div>
  )
}
