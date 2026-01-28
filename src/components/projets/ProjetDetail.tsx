'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ProjetQRCode } from '@/components/projets/ProjetQRCode'
import ProjetTimeline from '@/components/projets/ProjetTimeline'
import { formatSurfaceWithUnit, formatMoney, formatDate } from '@/lib/format'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row']
type Photo = Database['public']['Tables']['photos']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']

type Retouche = Database['public']['Tables']['retouches']['Row'] & {
  defaut_types?: Database['public']['Tables']['defaut_types']['Row']
}

interface ProjetDetailProps {
  projet: Projet & {
    clients: Client | null
    poudres: Poudre | null
    devis: { id: string; numero: string; total_ttc: number } | null
  }
  photos: Photo[]
  retouches?: Retouche[]
  storageQuota: number
  storageUsed: number
  userId: string
}

const statusColors: Record<string, string> = {
  devis: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  en_cours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  en_cuisson: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  qc: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  pret: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  livre: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  annule: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
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

export function ProjetDetail({ projet, photos, retouches = [], storageQuota, storageUsed, userId }: ProjetDetailProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

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

  // Mapping workflow step → statut projet (synchronisé)
  const STEP_STATUS_MAP: Record<number, string> = {
    0: 'en_cours',      // Préparation
    1: 'en_cours',      // Application poudre
    2: 'en_cuisson',    // Cuisson
    3: 'qc',            // Contrôle qualité
    4: 'pret',          // Prêt
  }

  const handleNextStep = async () => {
    if (currentStep < workflow.length - 1) {
      const nextStep = currentStep + 1
      const newStatus = STEP_STATUS_MAP[nextStep] || projet.status
      
      // Utiliser l'API pour synchroniser statut + workflow
      await handleStatusChange(newStatus)
    }
  }

  const handlePreviousStep = async () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1
      const newStatus = STEP_STATUS_MAP[prevStep] || projet.status
      
      // Utiliser l'API pour synchroniser statut + workflow
      await handleStatusChange(newStatus)
    }
  }

  // Permet de cliquer directement sur une étape du workflow
  const handleStepClick = async (stepIndex: number) => {
    if (stepIndex !== currentStep && stepIndex >= 0 && stepIndex < workflow.length) {
      const newStatus = STEP_STATUS_MAP[stepIndex] || projet.status
      await handleStatusChange(newStatus)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setStatusChanging(true)
    setStatusMessage(null)
    
    try {
      const response = await fetch(`/api/projets/${projet.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du changement de statut')
      }
      
      // Afficher un message si des automatisations se sont déclenchées
      const messages: string[] = []
      if (result.factureCreated) {
        messages.push('📧 Facture créée automatiquement')
      }
      if (result.stockUpdated) {
        messages.push('📦 Stock de poudre mis à jour')
      }
      
      if (messages.length > 0) {
        setStatusMessage(messages.join(' • '))
        // Effacer le message après 5 secondes
        setTimeout(() => setStatusMessage(null), 5000)
      }
      
      router.refresh()
    } catch (error: any) {
      console.error('Erreur changement statut:', error)
      setStatusMessage(`❌ ${error.message}`)
    } finally {
      setStatusChanging(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Timeline de suivi - Visible en premier */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-6">Suivi du projet</h2>
        <ProjetTimeline currentStatus={projet.status} />
      </div>

      {/* Informations générales */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Informations</h2>
          <div className="flex gap-2 flex-wrap">
            <ProjetQRCode 
              projetId={projet.id} 
              projetNumero={projet.numero} 
              projetName={projet.name} 
            />
            <Link
              href={`/app/projets/${projet.id}/retouches/new`}
              className="flex-1 sm:flex-none text-center bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Déclarer retouche
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Statut</label>
            <select
              value={projet.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusChanging}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
            >
              <option value="devis">Devis</option>
              <option value="en_cours">En cours</option>
              <option value="en_cuisson">En cuisson</option>
              <option value="qc">Contrôle qualité</option>
              <option value="pret">Prêt</option>
              <option value="livre">Livré</option>
              <option value="annule">Annulé</option>
            </select>
            {statusChanging && (
              <p className="text-xs text-orange-500 dark:text-blue-400 mt-1 flex items-center gap-1">
                <span className="animate-spin">⏳</span> Mise à jour en cours...
              </p>
            )}
            {statusMessage && (
              <p className={`text-xs mt-1 ${statusMessage.startsWith('❌') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {statusMessage}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Client</label>
            <p className="text-gray-900 dark:text-white">{projet.clients?.full_name || 'Client supprimé'}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{projet.clients?.email}</p>
          </div>
          {projet.poudres && (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Poudre</label>
              <p className="text-gray-900 dark:text-white">
                {projet.poudres.marque} {projet.poudres.reference}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{projet.poudres.finition}</p>
            </div>
          )}
        </div>

        {projet.date_depot && (
          <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Date dépôt</label>
              <p className="text-sm sm:text-base text-gray-900 dark:text-white">{new Date(projet.date_depot).toLocaleDateString('fr-FR')}</p>
            </div>
            {projet.date_promise && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Date promise</label>
                <p className="text-sm sm:text-base text-gray-900 dark:text-white">{new Date(projet.date_promise).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {projet.date_livre && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Date livraison</label>
                <p className="text-sm sm:text-base text-gray-900 dark:text-white">{new Date(projet.date_livre).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflow */}
      {workflow.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Workflow</h2>
          <div className="space-y-3 sm:space-y-4">
            {workflow.map((step: any, index: number) => (
              <div
                key={index}
                onClick={() => handleStepClick(index)}
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  index === currentStep
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                    : index < currentStep
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-400 hover:border-green-600'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600'
                } ${statusChanging ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm ${
                  index === currentStep
                    ? 'bg-blue-600 text-white'
                    : index < currentStep
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}>
                  {index < currentStep ? '✓' : index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{step.name || `Étape ${index + 1}`}</p>
                </div>
                {index === currentStep && (
                  <span className="text-xs sm:text-sm font-medium text-orange-500 dark:text-blue-400 shrink-0">En cours</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={handlePreviousStep}
              disabled={currentStep === 0 || statusChanging}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Étape précédente
            </button>
            <button
              onClick={handleNextStep}
              disabled={currentStep >= workflow.length - 1 || statusChanging}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Étape suivante →
            </button>
          </div>
          {statusMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${statusMessage.startsWith('❌') ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
              {statusMessage}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            💡 Cliquez sur une étape ou utilisez les boutons pour avancer le projet. Les automatisations (facture, stock) se déclenchent selon l'étape.
          </p>
        </div>
      )}

      {/* Photos */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Photos</h2>
          <div className="flex items-center gap-4 flex-wrap">
            {!canUpload && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Quota atteint ({storagePercentage.toFixed(1)}%)
              </p>
            )}
            <label className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 px-4 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all cursor-pointer">
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
