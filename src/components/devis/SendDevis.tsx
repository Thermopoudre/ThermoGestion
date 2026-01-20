'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Devis = Database['public']['Tables']['devis']['Row']

interface SendDevisProps {
  devis: Devis & {
    clients: { id: string; full_name: string; email: string } | null
  }
}

export function SendDevis({ devis }: SendDevisProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  
  const defaultMessage = `Bonjour,

Veuillez trouver ci-joint le devis #${devis.numero} pour un montant de ${Number(devis.total_ttc).toLocaleString('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})} TTC.

Ce devis est valable 30 jours.

Cordialement`

  const handleSend = async () => {
    setLoading(true)
    setError(null)

    try {
      if (!devis.clients?.email) {
        throw new Error('Email du client non disponible')
      }

      // Appeler l'API pour envoyer l'email
      const response = await fetch(`/api/devis/${devis.id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messagePersonnalise: message || defaultMessage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi de l\'email')
      }

      // Succès
      router.push(`/app/devis/${devis.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Envoyer le devis par email</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Destinataire :</strong> {devis.clients?.email || 'Email non disponible'}
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Note :</strong> Le devis sera envoyé par email avec le PDF en pièce jointe.
              {devis.clients?.type === 'particulier' && ' Un lien de création de compte client sera inclus.'}
            </p>
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Message (optionnel)
            </label>
            <textarea
              id="message"
              value={message || defaultMessage}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleSend}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Envoi...' : 'Envoyer le devis'}
          </button>
          <a
            href={`/app/devis/${devis.id}`}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </a>
        </div>
      </div>
    </div>
  )
}
