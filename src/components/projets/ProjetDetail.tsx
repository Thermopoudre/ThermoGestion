'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row']
type Photo = Database['public']['Tables']['photos']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']

interface ProjetDetailProps {
  projet: Projet & {
    clients: Client | null
    poudres: Poudre | null
    devis: { id: string; numero: string; total_ttc: number } | null
  }
  photos: Photo[]
  storageQuota: number
  storageUsed: number
  userId: string
}

const statusColors: Record<string, string> = {
  devis: 'bg-gray-100 text-gray-800',
  en_cours: 'bg-blue-100 text-blue-800',
  en_cuisson: 'bg-orange-100 text-orange-800',
  qc: 'bg-yellow-100 text-yellow-800',
  pret: 'bg-green-100 text-green-800',
  livre: 'bg-purple-100 text-purple-800',
  annule: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  devis: 'Devis',
  en_cours: 'En cours',
  en_cuisson: 'En cuisson',
  qc: 'Contrôle qualité',
  pret: 'Prêt',
  livre: 'Livré',
  annule: 'Annulé',
}

export function ProjetDetail({ projet, photos, storageQuota, storageUsed, userId }: ProjetDetailProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const workflow = (projet.workflow_config as any) || []
  const currentStep = projet.current_step || 0

  // Vérifier quota storage
  const storagePercentage = (storageUsed / storageQuota) * 100
  const canUpload = storagePercentage < 90

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!canUpload) {
      setUploadError('Quota de stockage atteint (90%). Les anciennes photos seront supprimées automatiquement.')
      return
    }

    // Vérifier taille (max 10 MB avant compression)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Fichier trop volumineux (max 10 MB)')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // Utiliser la fonction uploadPhoto depuis lib/storage
      const { uploadPhoto, cleanupOldPhotos } = await import('@/lib/storage')
      
      // Nettoyer les anciennes photos si quota > 90%
      await cleanupOldPhotos(projet.atelier_id)

      // Upload avec compression
      const { path, url, size } = await uploadPhoto(
        file,
        projet.atelier_id,
        projet.id,
        'etape',
        currentStep
      )

      // Enregistrer dans la BDD
      const { data: photoData, error: photoError } = await supabase
        .from('photos')
        .insert({
          atelier_id: projet.atelier_id,
          projet_id: projet.id,
          storage_path: path,
          url: url,
          type: 'etape',
          step_index: currentStep,
          size_bytes: size,
          metadata: {
            original_name: file.name,
            original_size: file.size,
            compressed_size: size,
            uploaded_at: new Date().toISOString(),
          },
          created_by: userId,
        })
        .select()
        .single()

      if (photoError) throw photoError

      // Mettre à jour compteur photos du projet
      await supabase
        .from('projets')
        .update({
          photos_count: (projet.photos_count || 0) + 1,
          photos_size_mb: Number(projet.photos_size_mb || 0) + (size / (1024 * 1024)),
        })
        .eq('id', projet.id)

      // Recalculer quota atelier (après nettoyage potentiel)
      const { data: updatedAtelier } = await supabase
        .from('ateliers')
        .select('storage_used_gb')
        .eq('id', projet.atelier_id)
        .single()

      if (updatedAtelier) {
        const newUsed = Number(updatedAtelier.storage_used_gb) + (size / (1024 * 1024 * 1024))
        await supabase
          .from('ateliers')
          .update({ storage_used_gb: newUsed })
          .eq('id', projet.atelier_id)
      }

      router.refresh()
    } catch (err: any) {
      setUploadError(err.message || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  // Utiliser la fonction de compression depuis lib/storage
  const compressImage = async (file: File): Promise<File> => {
    const { compressImage: compress } = await import('@/lib/storage')
    return compress(file, 2000) // Max 2MB
  }

  const handleNextStep = async () => {
    if (currentStep < workflow.length - 1) {
      const { error } = await supabase
        .from('projets')
        .update({ current_step: currentStep + 1 })
        .eq('id', projet.id)

      if (!error) {
        router.refresh()
      }
    }
  }

  const handlePreviousStep = async () => {
    if (currentStep > 0) {
      const { error } = await supabase
        .from('projets')
        .update({ current_step: currentStep - 1 })
        .eq('id', projet.id)

      if (!error) {
        router.refresh()
      }
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from('projets')
      .update({ status: newStatus })
      .eq('id', projet.id)

    if (!error) {
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* Informations générales */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Statut</label>
            <select
              value={projet.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="devis">Devis</option>
              <option value="en_cours">En cours</option>
              <option value="en_cuisson">En cuisson</option>
              <option value="qc">Contrôle qualité</option>
              <option value="pret">Prêt</option>
              <option value="livre">Livré</option>
              <option value="annule">Annulé</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Client</label>
            <p className="text-gray-900">{projet.clients?.full_name || 'Client supprimé'}</p>
            <p className="text-sm text-gray-600">{projet.clients?.email}</p>
          </div>
          {projet.poudres && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Poudre</label>
              <p className="text-gray-900">
                {projet.poudres.marque} {projet.poudres.reference}
              </p>
              <p className="text-sm text-gray-600">{projet.poudres.finition}</p>
            </div>
          )}
        </div>

        {projet.date_depot && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Date dépôt</label>
              <p className="text-gray-900">{new Date(projet.date_depot).toLocaleDateString('fr-FR')}</p>
            </div>
            {projet.date_promise && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date promise</label>
                <p className="text-gray-900">{new Date(projet.date_promise).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {projet.date_livre && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Date livraison</label>
                <p className="text-gray-900">{new Date(projet.date_livre).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflow */}
      {workflow.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Workflow</h2>
          <div className="space-y-4">
            {workflow.map((step: any, index: number) => (
              <div
                key={index}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 ${
                  index === currentStep
                    ? 'border-blue-500 bg-blue-50'
                    : index < currentStep
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === currentStep
                    ? 'bg-blue-600 text-white'
                    : index < currentStep
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {index < currentStep ? '✓' : index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{step.name || `Étape ${index + 1}`}</p>
                </div>
                {index === currentStep && (
                  <span className="text-sm font-medium text-blue-600">En cours</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={handlePreviousStep}
              disabled={currentStep === 0}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Étape précédente
            </button>
            <button
              onClick={handleNextStep}
              disabled={currentStep >= workflow.length - 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Étape suivante →
            </button>
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Photos</h2>
          <div className="flex items-center gap-4">
            {!canUpload && (
              <p className="text-sm text-yellow-600">
                ⚠️ Quota atteint ({storagePercentage.toFixed(1)}%)
              </p>
            )}
            <label className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-2 px-4 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all cursor-pointer">
              {uploading ? 'Upload...' : '+ Ajouter photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading || !canUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {uploadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {uploadError}
          </div>
        )}

        {photos.length === 0 ? (
          <p className="text-gray-600 text-center py-8">Aucune photo. Ajoutez la première photo du projet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.url}
                  alt={`Photo ${photo.type}`}
                  className="w-full h-48 object-cover rounded-lg border border-gray-200"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                  <a
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 text-white font-medium px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-all"
                  >
                    Voir
                  </a>
                </div>
                <div className="absolute top-2 left-2">
                  <span className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {photo.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          {projet.photos_count || 0} photo{projet.photos_count !== 1 ? 's' : ''} • 
          {projet.photos_size_mb ? ` ${(Number(projet.photos_size_mb) / 1024).toFixed(2)} GB` : ' 0 GB'}
        </div>
      </div>
    </div>
  )
}
