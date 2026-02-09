import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'
import { VitrineNav, VitrineFooter } from '@/components/layout/VitrineNav'

export default function CGUPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'cgu.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Conditions Générales d\'Utilisation')

  return (
    <div className="min-h-screen bg-black text-white">
      <VitrineNav />
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      <VitrineFooter />
    </div>
  )
}
