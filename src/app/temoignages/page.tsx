import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export default function TemoignagesPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'temoignages.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Témoignages')

  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      <VitrineFooter />
    </div>
  )
}
