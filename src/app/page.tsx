import { readFileSync } from 'fs'
import { join } from 'path'
import { sanitizeStaticHtml } from '@/lib/sanitize-html'

export default function Home() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'index.html')
  let htmlContent = ''
  
  try {
    htmlContent = sanitizeStaticHtml(readFileSync(htmlPath, 'utf-8'))
  } catch (error) {
    // Fallback si le fichier n'existe pas
    htmlContent = `
      <main class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div class="container mx-auto px-4 py-16">
          <div class="max-w-4xl mx-auto text-center">
            <h1 class="text-5xl font-black text-gray-900 mb-6">
              Thermo<span class="text-orange-500">Gestion</span>
            </h1>
            <p class="text-xl text-gray-600 mb-8">
              Logiciel SaaS professionnel pour ateliers de thermolaquage
            </p>
          </div>
        </div>
      </main>
    `
  }

  return (
    <div className="bg-black text-white" dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
