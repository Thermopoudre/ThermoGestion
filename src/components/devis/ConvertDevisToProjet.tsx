'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Devis = Database['public']['Tables']['devis']['Row']
type Poudre = Database['public']['Tables']['poudres']['Row']

interface ConvertDevisToProjetProps {
  devis: Devis
  poudres: Poudre[]
  atelierId: string
  userId: string
}

// Formater montant en euros
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function ConvertDevisToProjet({ devis, poudres, atelierId, userId }: ConvertDevisToProjetProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Calculs financiers
  const totalTtc = Number(devis.total_ttc) || 0
  const totalHt = Number(devis.total_ht) || 0
  
  const [formData, setFormData] = useState({
    name: `Projet ${devis.numero}`,
    poudre_id: '',
    couches: 1,
    temp_cuisson: '',
    duree_cuisson: '',
    date_depot: new Date().toISOString().split('T')[0],
    date_promise: '',
    workflow_config: [
      { name: 'Préparation', order: 0 },
      { name: 'Application poudre', order: 1 },
      { name: 'Cuisson', order: 2 },
      { name: 'Contrôle qualité', order: 3 },
      { name: 'Prêt', order: 4 },
    ],
    // Options de facturation
    createAcompte: false,
    pourcentageAcompte: 30,
  })
  
  // Calcul du montant d'acompte
  const montantAcompteHt = formData.createAcompte ? (totalHt * formData.pourcentageAcompte / 100) : 0
  const montantAcompteTtc = formData.createAcompte ? (totalTtc * formData.pourcentageAcompte / 100) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Générer numéro projet
      const { data: projetsCount } = await supabase
        .from('projets')
        .select('id', { count: 'exact', head: true })
        .eq('atelier_id', atelierId)

      const year = new Date().getFullYear()
      const nextNum = (projetsCount || 0) + 1
      const numero = `PROJ-${year}-${String(nextNum).padStart(4, '0')}`

      // Créer le projet (sans les champs montant qui peuvent ne pas exister)
      const projetData: Record<string, any> = {
        atelier_id: atelierId,
        client_id: devis.client_id,
        devis_id: devis.id,
        numero,
        name: formData.name,
        status: 'en_cours',
        poudre_id: formData.poudre_id || null,
        couches: formData.couches,
        temp_cuisson: formData.temp_cuisson ? parseInt(formData.temp_cuisson) : null,
        duree_cuisson: formData.duree_cuisson ? parseInt(formData.duree_cuisson) : null,
        date_depot: formData.date_depot || null,
        date_promise: formData.date_promise || null,
        workflow_config: formData.workflow_config,
        current_step: 0,
        pieces: devis.items,
        created_by: userId,
      }

      const { data: projet, error: projetError } = await supabase
        .from('projets')
        .insert(projetData)
        .select()
        .single()

      if (projetError) {
        console.error('Erreur création projet:', projetError)
        throw new Error(projetError.message || 'Erreur lors de la création du projet')
      }

      // Si création d'acompte demandée
      let factureAcompteId = null
      if (formData.createAcompte && montantAcompteHt > 0) {
        // Générer numéro facture via API
        const factureNumeroRes = await fetch('/api/factures/generate-numero', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ atelier_id: atelierId }),
        })
        const { numero: factureNumero } = await factureNumeroRes.json()
        
        // Calculer TVA acompte
        const tvaRate = Number(devis.tva_rate) || 20
        const tvaAcompte = montantAcompteTtc - montantAcompteHt
        
        // Créer la facture d'acompte
        const { data: factureAcompte, error: factureError } = await supabase
          .from('factures')
          .insert({
            atelier_id: atelierId,
            client_id: devis.client_id,
            projet_id: projet.id,
            devis_id: devis.id,
            devis_numero: devis.numero,
            numero: factureNumero,
            type: 'acompte',
            status: 'brouillon',
            payment_status: 'unpaid',
            total_ht: montantAcompteHt,
            total_ttc: montantAcompteTtc,
            tva_rate: tvaRate,
            pourcentage_acompte: formData.pourcentageAcompte,
            items: [{
              designation: `Acompte ${formData.pourcentageAcompte}% - ${devis.numero}`,
              description: `Acompte sur devis ${devis.numero} - ${formData.name}`,
              quantite: 1,
              prix_unitaire: montantAcompteHt,
              total_ht: montantAcompteHt,
            }],
            notes: `Facture d'acompte de ${formData.pourcentageAcompte}% sur le devis ${devis.numero}.\nMontant total du devis : ${formatMoney(totalTtc)} TTC.\nSolde restant : ${formatMoney(totalTtc - montantAcompteTtc)} TTC.`,
            due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +15 jours
            created_by: userId,
          })
          .select()
          .single()
          
        if (factureError) {
          console.error('Erreur création facture acompte:', factureError)
          // On continue même si la facture d'acompte échoue
        } else {
          factureAcompteId = factureAcompte.id
        }
      }

      // Mettre à jour le devis (statut converted)
      const { error: devisError } = await supabase
        .from('devis')
        .update({ status: 'converted' })
        .eq('id', devis.id)

      if (devisError) {
        console.error('Erreur mise à jour devis:', devisError)
        // On continue car le projet est créé
      }

      // Journal d'audit
      await supabase.from('audit_logs').insert({
        atelier_id: atelierId,
        user_id: userId,
        action: 'convert',
        table_name: 'projets',
        record_id: projet.id,
        new_data: { 
          from_devis: devis.id, 
          numero, 
          name: formData.name,
          facture_acompte_id: factureAcompteId,
          montant_acompte: formData.createAcompte ? montantAcompteTtc : 0,
        },
      })

      router.push(`/app/projets/${projet.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la conversion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nom du projet *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="poudre_id" className="block text-sm font-medium text-gray-700 mb-2">
                Poudre utilisée
              </label>
              <select
                id="poudre_id"
                value={formData.poudre_id}
                onChange={(e) => setFormData({ ...formData, poudre_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner une poudre</option>
                {poudres.map(poudre => (
                  <option key={poudre.id} value={poudre.id}>
                    {poudre.marque} {poudre.reference} - {poudre.finition}
                    {poudre.ral && ` (RAL ${poudre.ral})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="couches" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de couches *
              </label>
              <input
                id="couches"
                type="number"
                min="1"
                max="3"
                value={formData.couches}
                onChange={(e) => setFormData({ ...formData, couches: parseInt(e.target.value) || 1 })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="temp_cuisson" className="block text-sm font-medium text-gray-700 mb-2">
                Température cuisson (°C)
              </label>
              <input
                id="temp_cuisson"
                type="number"
                step="1"
                value={formData.temp_cuisson}
                onChange={(e) => setFormData({ ...formData, temp_cuisson: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="200"
              />
            </div>

            <div>
              <label htmlFor="duree_cuisson" className="block text-sm font-medium text-gray-700 mb-2">
                Durée cuisson (min)
              </label>
              <input
                id="duree_cuisson"
                type="number"
                step="1"
                value={formData.duree_cuisson}
                onChange={(e) => setFormData({ ...formData, duree_cuisson: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="15"
              />
            </div>

            <div>
              <label htmlFor="date_depot" className="block text-sm font-medium text-gray-700 mb-2">
                Date dépôt
              </label>
              <input
                id="date_depot"
                type="date"
                value={formData.date_depot}
                onChange={(e) => setFormData({ ...formData, date_depot: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="date_promise" className="block text-sm font-medium text-gray-700 mb-2">
                Date promise (livraison)
              </label>
              <input
                id="date_promise"
                type="date"
                value={formData.date_promise}
                onChange={(e) => setFormData({ ...formData, date_promise: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Workflow par défaut :</strong> Le projet utilisera un workflow standard avec 5 étapes.
              Vous pourrez le modifier après création.
            </p>
          </div>

          {/* Section Facturation Acompte */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-xl">💰</span>
              Facturation
            </h3>
            
            <div className="bg-gray-50 rounded-xl p-5 space-y-4">
              {/* Récap montant devis */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Montant total du devis :</span>
                <span className="font-bold text-gray-900">{formatMoney(totalTtc)} TTC</span>
              </div>
              
              {/* Option acompte */}
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={formData.createAcompte}
                  onChange={(e) => setFormData({ ...formData, createAcompte: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">Créer une facture d'acompte</span>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Une facture d'acompte sera générée automatiquement. La facture de solde sera créée à la fin du projet.
                  </p>
                </div>
              </label>
              
              {/* Détails acompte si activé */}
              {formData.createAcompte && (
                <div className="ml-8 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pourcentage d'acompte
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="10"
                        max="50"
                        step="5"
                        value={formData.pourcentageAcompte}
                        onChange={(e) => setFormData({ ...formData, pourcentageAcompte: parseInt(e.target.value) })}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-lg font-bold min-w-[70px] justify-center">
                        {formData.pourcentageAcompte}%
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>10%</span>
                      <span>30%</span>
                      <span>50%</span>
                    </div>
                  </div>
                  
                  {/* Aperçu des montants */}
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-sm font-medium text-gray-600 mb-3">Aperçu de la facturation</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Acompte ({formData.pourcentageAcompte}%) :</span>
                        <span className="font-semibold text-orange-600">{formatMoney(montantAcompteTtc)} TTC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Solde à facturer :</span>
                        <span className="font-semibold text-gray-900">{formatMoney(totalTtc - montantAcompteTtc)} TTC</span>
                      </div>
                      <div className="border-t border-gray-200 pt-2 mt-2">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-gray-900">Total :</span>
                          <span className="text-gray-900">{formatMoney(totalTtc)} TTC</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 flex items-start gap-2">
                    <span className="text-blue-500">ℹ️</span>
                    <span>La facture de solde sera automatiquement générée lorsque le projet passera au statut "Livré".</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold py-3 px-6 rounded-lg hover:from-green-500 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Conversion...' : '✓ Convertir en projet'}
            </button>
            <a
              href={`/app/devis/${devis.id}`}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
