'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

interface ImportClientsProps {
  atelierId: string
}

export function ImportClients({ atelierId }: ImportClientsProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<string[]>([])

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setSuccess(null)
    setDuplicates([])

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('Le fichier CSV doit contenir au moins un en-tête et une ligne de données')
      }

      // Parser CSV (format attendu: full_name,email,phone,address,type,siret)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const obj: any = {}
        headers.forEach((header, index) => {
          obj[header] = values[index] || ''
        })
        return obj
      })

      let imported = 0
      let skipped = 0
      const duplicateEmails: string[] = []

      for (const row of data) {
        try {
          // Vérifier champs requis
          if (!row.full_name || !row.email) {
            skipped++
            continue
          }

          // Vérifier doublon (par email)
          const { data: existing } = await supabase
            .from('clients')
            .select('id, email')
            .eq('atelier_id', atelierId)
            .eq('email', row.email)
            .single()

          if (existing) {
            duplicateEmails.push(row.email)
            skipped++
            continue
          }

          // Créer le client
          const { error: insertError } = await supabase
            .from('clients')
            .insert({
              atelier_id: atelierId,
              full_name: row.full_name,
              email: row.email,
              phone: row.phone || null,
              address: row.address || null,
              type: row.type === 'professionnel' ? 'professionnel' : 'particulier',
              siret: row.type === 'professionnel' && row.siret ? row.siret : null,
            })

          if (insertError) {
            skipped++
          } else {
            imported++
          }
        } catch (err) {
          skipped++
        }
      }

      setDuplicates(duplicateEmails)
      setSuccess(`${imported} client(s) importé(s)${skipped > 0 ? `, ${skipped} ignoré(s) (doublons ou erreurs)` : ''}`)
      
      if (imported > 0) {
        setTimeout(() => {
          router.push('/app/clients')
          router.refresh()
        }, 3000)
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Import CSV</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fichier CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            disabled={loading}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <p className="text-sm text-gray-500 mt-2">
            Format attendu : full_name,email,phone,address,type,siret
          </p>
          <p className="text-xs text-gray-400 mt-1">
            type: "particulier" ou "professionnel"
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-6">
            {success}
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-yellow-900 mb-2">Clients déjà existants (doublons) :</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              {duplicates.slice(0, 10).map((email, idx) => (
                <li key={idx}>• {email}</li>
              ))}
              {duplicates.length > 10 && (
                <li className="text-yellow-600">... et {duplicates.length - 10} autre(s)</li>
              )}
            </ul>
            <p className="text-xs text-yellow-700 mt-2">
              Ces clients recevront un email d'invitation pour créer un compte sur le portail client.
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">💡 Astuce</h3>
          <p className="text-sm text-blue-800">
            Les clients en doublon (même email) seront ignorés. 
            Vous pouvez leur envoyer un email d'invitation depuis leur fiche client.
          </p>
        </div>

        <div className="mt-6">
          <a
            href="/app/clients"
            className="text-orange-500 hover:text-blue-700 text-sm font-medium"
          >
            ← Retour à la liste
          </a>
        </div>
      </div>
    </div>
  )
}
