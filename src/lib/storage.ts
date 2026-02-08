import { createBrowserClient } from './supabase/client'

// Utilitaires pour la gestion du stockage Supabase

export const STORAGE_BUCKETS = {
  photos: 'photos',
  pdfs: 'pdfs',
  signatures: 'signatures',
} as const

/**
 * Compression d'image côté client
 * Réduit la taille à ~500KB-2MB pour stockage
 */
export async function compressImage(file: File, maxSizeKB: number = 2000): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file) // Fallback
          return
        }

        // Calculer dimensions (max 2000px côté le plus long)
        let width = img.width
        let height = img.height
        const maxDimension = 2000

        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width
            width = maxDimension
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // Essayer WebP d'abord, puis JPG
        let quality = 0.85
        let mimeType = 'image/webp'

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file)
                return
              }

              const sizeKB = blob.size / 1024

              if (sizeKB <= maxSizeKB) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                  type: mimeType,
                  lastModified: Date.now(),
                })
                resolve(compressedFile)
              } else if (quality > 0.5) {
                // Réduire qualité et réessayer
                quality -= 0.1
                tryCompress()
              } else if (mimeType === 'image/webp') {
                // Essayer JPG si WebP trop lourd
                mimeType = 'image/jpeg'
                quality = 0.85
                tryCompress()
              } else {
                // Dernier recours: accepter le fichier même si trop gros
                resolve(file)
              }
            },
            mimeType,
            quality
          )
        }

        tryCompress()
      }
      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Erreur lecture fichier'))
    reader.readAsDataURL(file)
  })
}

/**
 * Upload photo avec compression automatique
 */
export async function uploadPhoto(
  file: File,
  atelierId: string,
  projetId: string,
  type: 'avant' | 'apres' | 'etape' | 'nc' | 'autre' = 'etape',
  stepIndex?: number
): Promise<{ path: string; url: string; size: number }> {
  const supabase = createBrowserClient()

  // Compression
  const compressedFile = await compressImage(file, 2000) // Max 2MB

  // Générer nom fichier unique
  const extension = compressedFile.name.split('.').pop() || 'webp'
  const randomBytes = new Uint8Array(8)
  crypto.getRandomValues(randomBytes)
  const randomStr = Array.from(randomBytes).map(b => b.toString(36)).join('').slice(0, 10)
  const fileName = `${Date.now()}-${randomStr}.${extension}`
  const filePath = `${atelierId}/${projetId}/${fileName}`

  // Upload
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.photos)
    .upload(filePath, compressedFile, {
      contentType: compressedFile.type,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Erreur upload: ${uploadError.message}`)
  }

  // URL publique
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKETS.photos)
    .getPublicUrl(filePath)

  return {
    path: filePath,
    url: urlData.publicUrl,
    size: compressedFile.size,
  }
}

/**
 * Vérifier quota storage atelier
 */
export async function checkStorageQuota(atelierId: string): Promise<{
  used: number
  quota: number
  percentage: number
  canUpload: boolean
}> {
  const supabase = createBrowserClient()

  const { data: atelier } = await supabase
    .from('ateliers')
    .select('storage_quota_gb, storage_used_gb')
    .eq('id', atelierId)
    .single()

  if (!atelier) {
    throw new Error('Atelier non trouvé')
  }

  const used = Number(atelier.storage_used_gb)
  const quota = atelier.storage_quota_gb
  const percentage = (used / quota) * 100
  const canUpload = percentage < 90

  return { used, quota, percentage, canUpload }
}

/**
 * Supprimer les photos les plus anciennes si quota > 90%
 * (Automatique, appelé lors de l'upload)
 */
export async function cleanupOldPhotos(atelierId: string): Promise<void> {
  const supabase = createBrowserClient()

  const { data: atelier } = await supabase
    .from('ateliers')
    .select('storage_quota_gb, storage_used_gb')
    .eq('id', atelierId)
    .single()

  if (!atelier) return

  const used = Number(atelier.storage_used_gb)
  const quota = atelier.storage_quota_gb
  const percentage = (used / quota) * 100

  if (percentage < 90) return // Pas besoin de nettoyer

  // Récupérer les photos des projets les plus anciens
  const { data: oldPhotos } = await supabase
    .from('photos')
    .select('id, storage_path, size_bytes, projet_id')
    .eq('atelier_id', atelierId)
    .order('created_at', { ascending: true })
    .limit(50) // Supprimer par batch de 50

  if (!oldPhotos || oldPhotos.length === 0) return

  // Supprimer les fichiers du storage
  const pathsToDelete = oldPhotos.map(p => p.storage_path)
  await supabase.storage.from(STORAGE_BUCKETS.photos).remove(pathsToDelete)

  // Supprimer les enregistrements BDD
  const idsToDelete = oldPhotos.map(p => p.id)
  await supabase.from('photos').delete().in('id', idsToDelete)

  // Recalculer storage_used_gb
  const totalSizeDeleted = oldPhotos.reduce((sum, p) => sum + Number(p.size_bytes), 0)
  const newUsed = Math.max(0, used - (totalSizeDeleted / (1024 * 1024 * 1024)))

  await supabase
    .from('ateliers')
    .update({ storage_used_gb: newUsed })
    .eq('id', atelierId)
}
