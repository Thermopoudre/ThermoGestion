'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Send, Upload, X, CheckCircle2 } from 'lucide-react'

export default function DemandeDevisPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  
  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    type_pieces: '',
    quantite: '',
    couleur_souhaitee: '',
    finition: 'mat',
    urgence: 'normal',
    date_souhaitee: '',
    notes: '',
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...newFiles].slice(0, 5)) // Max 5 fichiers
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Récupérer l'utilisateur et le client
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: clientUser } = await supabase
        .from('client_users')
        .select('client_id, atelier_id')
        .eq('id', user.id)
        .single()

      if (!clientUser) throw new Error('Client non trouvé')

      // Créer la demande de devis
      const { data: demande, error: demandeError } = await supabase
        .from('demandes_devis')
        .insert({
          client_id: clientUser.client_id,
          atelier_id: clientUser.atelier_id,
          titre: formData.titre,
          description: formData.description,
          type_pieces: formData.type_pieces,
          quantite: formData.quantite ? parseInt(formData.quantite) : null,
          couleur_souhaitee: formData.couleur_souhaitee,
          finition: formData.finition,
          urgence: formData.urgence,
          date_souhaitee: formData.date_souhaitee || null,
          notes: formData.notes,
          status: 'nouvelle',
        })
        .select()
        .single()

      if (demandeError) throw demandeError

      // Upload des fichiers si présents
      if (files.length > 0 && demande) {
        for (const file of files) {
          const ext = file.name.split('.').pop()
          const path = `demandes/${demande.id}/${Date.now()}.${ext}`
          
          await supabase.storage
            .from('documents')
            .upload(path, file)
        }
      }

      setSuccess(true)
      
      // Rediriger après 3 secondes
      setTimeout(() => {
        router.push('/client/dashboard')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-green-50 rounded-2xl p-12">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-green-800 mb-2">
            Demande envoyée avec succès !
          </h1>
          <p className="text-green-600 mb-6">
            Votre demande a été transmise à l'atelier. Vous recevrez un devis rapidement.
          </p>
          <p className="text-sm text-green-500">Redirection automatique...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Demander un devis</h1>
        <p className="text-gray-600">Décrivez votre projet et nous vous répondrons rapidement</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Titre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titre du projet *
          </label>
          <input
            type="text"
            required
            value={formData.titre}
            onChange={e => setFormData({ ...formData, titre: e.target.value })}
            placeholder="Ex: Portail en fer forgé, garde-corps balcon..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description détaillée *
          </label>
          <textarea
            required
            rows={4}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Décrivez les pièces à traiter, dimensions approximatives, état actuel..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Type de pièces */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de pièces
            </label>
            <select
              value={formData.type_pieces}
              onChange={e => setFormData({ ...formData, type_pieces: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Sélectionner...</option>
              <option value="portail">Portail</option>
              <option value="cloture">Clôture</option>
              <option value="garde_corps">Garde-corps</option>
              <option value="mobilier">Mobilier métallique</option>
              <option value="chassis">Châssis / Cadres</option>
              <option value="pieces_industrielles">Pièces industrielles</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de pièces
            </label>
            <input
              type="number"
              min="1"
              value={formData.quantite}
              onChange={e => setFormData({ ...formData, quantite: e.target.value })}
              placeholder="Ex: 1, 10, 50..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Couleur souhaitée
            </label>
            <input
              type="text"
              value={formData.couleur_souhaitee}
              onChange={e => setFormData({ ...formData, couleur_souhaitee: e.target.value })}
              placeholder="Ex: RAL 7016, Noir mat, Blanc..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Finition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Finition
            </label>
            <select
              value={formData.finition}
              onChange={e => setFormData({ ...formData, finition: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="mat">Mat</option>
              <option value="satine">Satiné</option>
              <option value="brillant">Brillant</option>
              <option value="texture">Texturé</option>
              <option value="metallise">Métallisé</option>
            </select>
          </div>

          {/* Urgence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Niveau d'urgence
            </label>
            <select
              value={formData.urgence}
              onChange={e => setFormData({ ...formData, urgence: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="normal">Normal (1-2 semaines)</option>
              <option value="urgent">Urgent (sous 1 semaine)</option>
              <option value="tres_urgent">Très urgent (sous 48h)</option>
            </select>
          </div>

          {/* Date souhaitée */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date souhaitée
            </label>
            <input
              type="date"
              value={formData.date_souhaitee}
              onChange={e => setFormData({ ...formData, date_souhaitee: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes complémentaires
          </label>
          <textarea
            rows={2}
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Informations supplémentaires..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Upload photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photos des pièces (optionnel)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label 
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-gray-600">Cliquez pour ajouter des photos</p>
              <p className="text-sm text-gray-400">Max 5 fichiers</p>
            </label>
          </div>
          
          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Envoyer ma demande
            </>
          )}
        </button>
      </form>
    </div>
  )
}
