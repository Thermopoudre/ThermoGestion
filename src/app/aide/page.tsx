import { readFileSync } from 'fs'
import { join } from 'path'

export default function AidePage() {
  const htmlPath = join(process.cwd(), 'site-vitrine', 'aide.html')
  let htmlContent = ''
  
  try {
    htmlContent = readFileSync(htmlPath, 'utf-8')
  } catch (error) {
    htmlContent = '<html><body><h1>Page en cours de chargement...</h1></body></html>'
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  )
}
