'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

interface ImportPoudresProps {
  atelierId: string
}

export function ImportPoudres({ atelierId }: ImportPoudresProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('Le fichier CSV doit contenir au moins un en-tête et une ligne de données')
      }

      // Parser CSV (format attendu: marque,reference,type,ral,finition,densite,epaisseur,consommation,temp_cuisson,duree_cuisson)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const data = lines.slice(1).map(line => {
        const values = line.split(',')
        const obj: any = {}
        headers.forEach((header, index) => {
          obj[header] = values[index]?.trim() || ''
        })
        return obj
      })

      let imported = 0
      let errors = 0

      for (const row of data) {
        try {
          // Vérifier champs requis
          if (!row.marque || !row.reference || !row.type || !row.finition) {
            errors++
            continue
          }

          // Vérifier doublon
          const { data: existing } = await supabase
            .from('poudres')
            .select('id')
            .eq('atelier_id', atelierId)
            .eq('marque', row.marque)
            .eq('reference', row.reference)
            .eq('finition', row.finition)
            .single()

          if (existing) {
            errors++
            continue // Doublon, on skip
          }

          // Créer la poudre
          const { error: insertError } = await supabase
            .from('poudres')
            .insert({
              atelier_id: atelierId,
              marque: row.marque,
              reference: row.reference,
              type: row.type,
              ral: row.ral || null,
              finition: row.finition,
              densite: row.densite ? parseFloat(row.densite) : null,
              epaisseur_conseillee: row.epaisseur_conseillee ? parseFloat(row.epaisseur_conseillee) : null,
              consommation_m2: row.consommation ? parseFloat(row.consommation) : null,
              temp_cuisson: row.temp_cuisson ? parseInt(row.temp_cuisson) : null,
              duree_cuisson: row.duree_cuisson ? parseInt(row.duree_cuisson) : null,
              source: 'manual',
            })

          if (insertError) {
            errors++
          } else {
            imported++
          }
        } catch (err) {
          errors++
        }
      }

      setSuccess(`${imported} poudre(s) importée(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`)
      
      if (imported > 0) {
        setTimeout(() => {
          router.push('/app/poudres')
          router.refresh()
        }, 2000)
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
            Format attendu : marque,reference,type,ral,finition,densite,epaisseur,consommation,temp_cuisson,duree_cuisson
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Import depuis Thermopoudre</h3>
          <p className="text-sm text-blue-800">
            L'import automatique depuis le module PrestaShop Thermopoudre sera disponible après développement du module.
            Pour l'instant, utilisez l'import CSV.
          </p>
        </div>

        <div className="mt-6">
          <a
            href="/app/poudres"
            className="text-orange-500 hover:text-blue-700 text-sm font-medium"
          >
            ← Retour au catalogue
          </a>
        </div>
      </div>
    </div>
  )
}
