'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

interface Photo {
  id: string
  url: string
  type: string
  created_at: string
}

interface PhotoGalleryProps {
  photos: Photo[]
  projetId: string
  atelierId: string
  canUpload: boolean
  onPhotoAdded?: () => void
}

const PHOTO_TYPES = [
  { key: 'avant', label: 'Avant', icon: '📦', color: 'bg-blue-100 text-blue-700' },
  { key: 'apres', label: 'Après', icon: '✨', color: 'bg-green-100 text-green-700' },
  { key: 'etape', label: 'Étape', icon: '🔧', color: 'bg-amber-100 text-amber-700' },
  { key: 'defaut', label: 'Défaut', icon: '⚠️', color: 'bg-red-100 text-red-700' },
]

export function PhotoGallery({ photos, projetId, atelierId, canUpload, onPhotoAdded }: PhotoGalleryProps) {
  const supabase = createBrowserClient()
  
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState<string>('avant')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Grouper par type
  const photosByType = photos.reduce((acc, photo) => {
    const type = photo.type || 'autre'
    if (!acc[type]) acc[type] = []
    acc[type].push(photo)
    return acc
  }, {} as Record<string, Photo[]>)

  const avantPhotos = photosByType['avant'] || []
  const apresPhotos = photosByType['apres'] || []

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validation
    if (file.size > 10 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 10 MB)')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Seules les images sont acceptées')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Générer un nom unique
      const ext = file.name.split('.').pop()
      const fileName = `${projetId}/${uploadType}_${Date.now()}.${ext}`

      // Upload vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName)

      // Créer l'entrée en base
      const { error: dbError } = await supabase.from('photos').insert({
        projet_id: projetId,
        atelier_id: atelierId,
        storage_path: fileName,
        url: urlData.publicUrl,
        type: uploadType,
        size_bytes: file.size,
      })

      if (dbError) throw dbError

      setShowUploadModal(false)
      onPhotoAdded?.()
      
      // Refresh page
      window.location.reload()
    } catch (err: any) {
      console.error('Erreur upload:', err)
      setError(err.message || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          📸 Photos du projet
        </h2>
        <div className="flex gap-2">
          {avantPhotos.length > 0 && apresPhotos.length > 0 && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                compareMode 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {compareMode ? '✓ Mode comparaison' : '⇆ Comparer avant/après'}
            </button>
          )}
          {canUpload && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 px-4 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all"
            >
              + Ajouter photo
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Mode comparaison */}
      {compareMode && avantPhotos.length > 0 && apresPhotos.length > 0 ? (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-center font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center justify-center gap-2">
                <span className="text-xl">📦</span> AVANT
              </h3>
              <div className="relative aspect-video bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg">
                <img
                  src={avantPhotos[0].url}
                  alt="Avant"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-center text-xs text-gray-500 mt-2">
                {new Date(avantPhotos[0].created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div>
              <h3 className="text-center font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center justify-center gap-2">
                <span className="text-xl">✨</span> APRÈS
              </h3>
              <div className="relative aspect-video bg-white dark:bg-gray-700 rounded-xl overflow-hidden shadow-lg">
                <img
                  src={apresPhotos[0].url}
                  alt="Après"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-center text-xs text-gray-500 mt-2">
                {new Date(apresPhotos[0].created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Galerie normale */
        <>
          {photos.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <span className="text-4xl mb-4 block">📷</span>
              <p className="text-gray-600 dark:text-gray-400">Aucune photo</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Ajoutez des photos avant/après pour documenter votre travail
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Photos Avant */}
              {avantPhotos.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">📦 Avant</span>
                    <span className="text-sm font-normal text-gray-500">({avantPhotos.length})</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {avantPhotos.map(photo => (
                      <PhotoThumbnail 
                        key={photo.id} 
                        photo={photo} 
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Photos Après */}
              {apresPhotos.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">✨ Après</span>
                    <span className="text-sm font-normal text-gray-500">({apresPhotos.length})</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {apresPhotos.map(photo => (
                      <PhotoThumbnail 
                        key={photo.id} 
                        photo={photo} 
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Autres photos */}
              {Object.entries(photosByType)
                .filter(([type]) => !['avant', 'apres'].includes(type))
                .map(([type, typePhotos]) => (
                  <div key={type}>
                    <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm capitalize">{type}</span>
                      <span className="text-sm font-normal text-gray-500">({typePhotos.length})</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {typePhotos.map(photo => (
                        <PhotoThumbnail 
                          key={photo.id} 
                          photo={photo} 
                          onClick={() => setSelectedPhoto(photo)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </>
      )}

      {/* Modal Upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Ajouter une photo
            </h3>

            {/* Sélection du type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type de photo
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PHOTO_TYPES.map(type => (
                  <button
                    key={type.key}
                    onClick={() => setUploadType(type.key)}
                    className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                      uploadType === type.key
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{type.icon}</span>
                    <span className="font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Zone upload */}
            <label className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              uploading 
                ? 'border-orange-300 bg-orange-50' 
                : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50'
            }`}>
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <div className="animate-pulse">
                  <span className="text-3xl">⏳</span>
                  <p className="mt-2 text-gray-600">Upload en cours...</p>
                </div>
              ) : (
                <>
                  <span className="text-3xl">📁</span>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Cliquez ou glissez une image
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Max 10 MB</p>
                </>
              )}
            </label>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal visualisation */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
          >
            ✕
          </button>
          <img
            src={selectedPhoto.url}
            alt="Photo"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

// Composant thumbnail
function PhotoThumbnail({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  return (
    <div 
      className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      <img
        src={photo.url}
        alt={`Photo ${photo.type}`}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <span className="opacity-0 group-hover:opacity-100 text-white text-2xl">🔍</span>
      </div>
    </div>
  )
}
