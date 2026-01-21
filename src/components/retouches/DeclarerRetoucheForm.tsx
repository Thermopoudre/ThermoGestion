'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { QuickCreateDefautTypeModal } from '@/components/ui/QuickCreateDefautTypeModal'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row']
type DefautType = Database['public']['Tables']['defaut_types']['Row']

interface DeclarerRetoucheFormProps {
  projet: Projet
  defautTypes: DefautType[]
  atelierId: string
  userId: string
}

export function DeclarerRetoucheForm({
  projet,
  defautTypes: initialDefautTypes,
  atelierId,
  userId,
}: DeclarerRetoucheFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()

  // Liste dynamique des types de défauts
  const [defautTypes, setDefautTypes] = useState<DefautType[]>(initialDefautTypes)
  
  // Modal de création rapide
  const [showDefautTypeModal, setShowDefautTypeModal] = useState(false)

  const [defautTypeId, setDefautTypeId] = useState('')
  const [description, setDescription] = useState('')
  const [actionCorrective, setActionCorrective] = useState('')
  const [stepIndex, setStepIndex] = useState<number | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!description.trim()) {
      setError('La description est obligatoire')
      setLoading(false)
      return
    }

    try {
      let photoUrl: string | null = null

      // Upload photo si fournie
      if (photoFile) {
        const { uploadPhoto } = await import('@/lib/storage')
        const uploadResult = await uploadPhoto(
          photoFile,
          atelierId,
          projet.id,
          'nc'
        )
        photoUrl = uploadResult.url
      }

      // Créer la retouche
      const { data: retouche, error: retoucheError } = await supabase
        .from('retouches')
        .insert({
          atelier_id: atelierId,
          projet_id: projet.id,
          defaut_type_id: defautTypeId || null,
          step_index: stepIndex,
          description: description.trim(),
          photo_url: photoUrl,
          action_corrective: actionCorrective.trim() || null,
          status: 'declaree',
          created_by: userId,
        })
        .select('id')
        .single()

      if (retoucheError) throw retoucheError

      // Notifier les utilisateurs de l'atelier
      try {
        await fetch('/api/notifications/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'retouche_declared',
            atelier_id: atelierId,
            retouche_id: retouche.id,
            projet_name: projet.name,
          }),
        })
      } catch (notifError) {
        console.error('Erreur notification push:', notifError)
        // Ne pas bloquer si notification échoue
      }

      router.push(`/app/projets/${projet.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la déclaration de la retouche')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Type de défaut */}
        <div>
          <label htmlFor="defaut_type" className="block text-sm font-medium text-gray-700 mb-2">
            Type de défaut (optionnel)
          </label>
          <div className="flex gap-2">
            <select
              id="defaut_type"
              value={defautTypeId}
              onChange={(e) => setDefautTypeId(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sélectionner un type</option>
              {defautTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} {type.category ? `(${type.category})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowDefautTypeModal(true)}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1 text-sm font-medium whitespace-nowrap"
              title="Créer un nouveau type de défaut"
            >
              <span>+</span>
              <span className="hidden sm:inline">Nouveau</span>
            </button>
          </div>
          {defautTypes.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              Aucun type de défaut configuré. Cliquez sur "+ Nouveau" pour en créer un.
            </p>
          )}
        </div>

        {/* Étape */}
        <div>
          <label htmlFor="step_index" className="block text-sm font-medium text-gray-700 mb-2">
            Étape où le défaut a été détecté (optionnel)
          </label>
          <input
            id="step_index"
            type="number"
            min="0"
            value={stepIndex || ''}
            onChange={(e) => setStepIndex(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Numéro d'étape"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description du défaut *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Décrivez le défaut constaté..."
          />
        </div>

        {/* Photo */}
        <div>
          <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-2">
            Photo du défaut (optionnel)
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {photoPreview && (
            <div className="mt-4">
              <img
                src={photoPreview}
                alt="Aperçu"
                className="max-w-md rounded-lg border border-gray-300"
              />
            </div>
          )}
        </div>

        {/* Action corrective */}
        <div>
          <label
            htmlFor="action_corrective"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Action corrective (optionnel)
          </label>
          <textarea
            id="action_corrective"
            value={actionCorrective}
            onChange={(e) => setActionCorrective(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Décrivez l'action corrective prévue ou effectuée..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold py-3 px-6 rounded-lg hover:from-red-500 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Déclaration...' : 'Déclarer la retouche'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>

      {/* Modal de création rapide */}
      <QuickCreateDefautTypeModal
        isOpen={showDefautTypeModal}
        onClose={() => setShowDefautTypeModal(false)}
        atelierId={atelierId}
        onDefautTypeCreated={(newDefautType) => {
          setDefautTypes([...defautTypes, newDefautType])
          setDefautTypeId(newDefautType.id)
        }}
      />
    </form>
  )
}
