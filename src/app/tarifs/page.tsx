import { join } from 'path'
import { loadAndSanitizeHtml } from '@/lib/sanitize-html'
import { ROICalculator } from '@/components/ui/ROICalculator'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tarifs — ThermoGestion',
  description: 'Plans et tarifs ThermoGestion. Essai gratuit 30 jours, Plan Lite à 29€/mois, Plan Pro à 49€/mois.',
}

export default function TarifsPage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'tarifs.html')
  const htmlContent = loadAndSanitizeHtml(htmlPath, 'Tarifs')

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      {/* Calculateur ROI intégré */}
      <section className="bg-gray-900 py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-white mb-3">
              Combien allez-vous économiser ?
            </h2>
            <p className="text-gray-400">
              Ajustez les curseurs pour estimer votre retour sur investissement
            </p>
          </div>
          <ROICalculator />
        </div>
      </section>
    </>
  )
}
