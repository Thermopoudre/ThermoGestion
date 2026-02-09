/**
 * Watermark photos — Utilitaire pour ajouter un filigrane
 * sur les photos de projets avant stockage
 */

export interface WatermarkConfig {
  enabled: boolean
  text: string
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'
  opacity: number // 0.1 - 0.9
  fontSize: number // en pixels
  color: string
}

const DEFAULT_CONFIG: WatermarkConfig = {
  enabled: true,
  text: 'ThermoGestion',
  position: 'bottom-right',
  opacity: 0.3,
  fontSize: 24,
  color: '#FFFFFF',
}

/**
 * Applique un watermark sur une image côté client (Canvas API)
 * @param imageFile Le fichier image source
 * @param config Configuration du watermark
 * @returns Un blob de l'image avec watermark
 */
export async function applyWatermark(
  imageFile: File | Blob,
  config: Partial<WatermarkConfig> = {}
): Promise<Blob> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  if (!cfg.enabled) {
    return imageFile
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(imageFile)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas context not available'))
        return
      }

      // Dessiner l'image originale
      ctx.drawImage(img, 0, 0)

      // Configurer le watermark
      ctx.globalAlpha = cfg.opacity
      ctx.font = `bold ${cfg.fontSize}px Arial, sans-serif`
      ctx.fillStyle = cfg.color
      
      // Ajouter une ombre pour la lisibilité
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2

      const textMetrics = ctx.measureText(cfg.text)
      const textWidth = textMetrics.width
      const textHeight = cfg.fontSize
      const padding = 20

      let x: number, y: number

      switch (cfg.position) {
        case 'top-left':
          ctx.textAlign = 'left'
          x = padding
          y = textHeight + padding
          break
        case 'top-right':
          ctx.textAlign = 'right'
          x = canvas.width - padding
          y = textHeight + padding
          break
        case 'bottom-left':
          ctx.textAlign = 'left'
          x = padding
          y = canvas.height - padding
          break
        case 'center':
          ctx.textAlign = 'center'
          x = canvas.width / 2
          y = canvas.height / 2
          // En mode center, ajouter un watermark diagonal
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(-Math.PI / 6) // -30 degrés
          ctx.fillText(cfg.text, 0, 0)
          ctx.restore()
          ctx.globalAlpha = 1
          URL.revokeObjectURL(url)
          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
            'image/jpeg',
            0.92
          )
          return
        case 'bottom-right':
        default:
          ctx.textAlign = 'right'
          x = canvas.width - padding
          y = canvas.height - padding
          break
      }

      ctx.fillText(cfg.text, x, y)

      // Ajouter la date en petit
      ctx.globalAlpha = cfg.opacity * 0.7
      ctx.font = `${Math.round(cfg.fontSize * 0.5)}px Arial, sans-serif`
      const dateText = new Date().toLocaleDateString('fr-FR')
      
      if (cfg.position.includes('right')) {
        ctx.textAlign = 'right'
        ctx.fillText(dateText, x, y + Math.round(cfg.fontSize * 0.7))
      } else {
        ctx.textAlign = 'left'
        ctx.fillText(dateText, x, y + Math.round(cfg.fontSize * 0.7))
      }

      ctx.globalAlpha = 1
      URL.revokeObjectURL(url)

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
        'image/jpeg',
        0.92
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Vérifie si le watermark est activé pour l'atelier
 */
export function isWatermarkEnabled(atelier: any): boolean {
  return atelier?.watermark_enabled === true
}

/**
 * Obtient la config watermark pour l'atelier
 */
export function getWatermarkConfig(atelier: any): WatermarkConfig {
  return {
    enabled: atelier?.watermark_enabled || false,
    text: atelier?.nom || 'ThermoGestion',
    position: 'bottom-right',
    opacity: 0.3,
    fontSize: 24,
    color: '#FFFFFF',
  }
}
