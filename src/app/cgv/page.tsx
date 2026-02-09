import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export default function CGVPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'cgv.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Conditions Générales de Vente')

  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      <VitrineFooter />
    </div>
  )
}
