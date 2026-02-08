'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { QuickCreateClientModal } from '@/components/ui/QuickCreateClientModal'
import type { FactureFormData, FactureItem } from '@/lib/facturation/types'

interface ClientType {
  id: string
  full_name: string
  email: string
  type: string
}

interface CreateFactureFormProps {
  atelierId: string
  clients: ClientType[]
  projets: Array<{ id: string; name: string; numero: string; total_ttc?: number }>
  projetInitial?: any
}

export function CreateFactureForm({
  atelierId,
  clients: initialClients,
  projets,
  projetInitial,
}: CreateFactureFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  // Liste dynamique des clients
  const [clients, setClients] = useState<ClientType[]>(initialClients)
  
  // Modal de création rapide
  const [showClientModal, setShowClientModal] = useState(false)

  const [formData, setFormData] = useState<Partial<FactureFormData> & { categorie_operation?: string }>({
    client_id: projetInitial?.client_id || '',
    projet_id: projetInitial?.id || '',
    type: 'complete',
    categorie_operation: 'services',
    items: projetInitial?.devis?.items
      ? (projetInitial.devis.items as FactureItem[])
      : [
          {
            id: '1',
            designation: '',
            quantite: 1,
            prix_unitaire_ht: 0,
            tva_rate: 20,
            total_ht: 0,
            total_ttc: 0,
          },
        ],
    tva_rate: 20,
    total_ht: 0,
    total_ttc: 0,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projetsFiltres, setProjetsFiltres] = useState(projets)

  // Filtrer les projets selon le client sélectionné
  useEffect(() => {
    if (formData.client_id) {
      // Récupérer les projets du client
      supabase
        .from('projets')
        .select('id, name, numero, total_ttc')
        .eq('atelier_id', atelierId)
        .eq('client_id', formData.client_id)
        .in('status', ['pret', 'livre'])
        .then(({ data }) => {
          setProjetsFiltres(data || [])
        })
    } else {
      setProjetsFiltres([])
    }
  }, [formData.client_id, atelierId, supabase])

  // Calculer les totaux
  const calculateTotals = (items: FactureItem[]) => {
    const totalHt = items.reduce((sum, item) => sum + (item.total_ht || 0), 0)
    const totalTtc = items.reduce((sum, item) => sum + (item.total_ttc || 0), 0)
    return { totalHt, totalTtc }
  }

  const handleItemChange = (index: number, field: keyof FactureItem, value: any) => {
    const newItems = [...(formData.items || [])]
    const item = { ...newItems[index] }

    if (field === 'prix_unitaire_ht' || field === 'quantite' || field === 'tva_rate') {
      item[field] = Number(value) || 0
      const totalHt = item.prix_unitaire_ht * item.quantite
      const totalTva = totalHt * (item.tva_rate / 100)
      item.total_ht = totalHt
      item.total_ttc = totalHt + totalTva
    } else {
      item[field] = value
    }

    newItems[index] = item
    const { totalHt, totalTtc } = calculateTotals(newItems)

    setFormData({
      ...formData,
      items: newItems,
      total_ht: totalHt,
      total_ttc: totalTtc,
    })
  }

  const handleAddItem = () => {
    const newItems = [
      ...(formData.items || []),
      {
        id: Date.now().toString(),
        designation: '',
        quantite: 1,
        prix_unitaire_ht: 0,
        tva_rate: formData.tva_rate || 20,
        total_ht: 0,
        total_ttc: 0,
      },
    ]
    setFormData({ ...formData, items: newItems })
  }

  const handleRemoveItem = (index: number) => {
    const newItems = formData.items?.filter((_, i) => i !== index) || []
    const { totalHt, totalTtc } = calculateTotals(newItems)
    setFormData({
      ...formData,
      items: newItems,
      total_ht: totalHt,
      total_ttc: totalTtc,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.client_id) {
      setError('Sélectionnez un client')
      setLoading(false)
      return
    }

    if (!formData.items || formData.items.length === 0) {
      setError('Ajoutez au moins un item')
      setLoading(false)
      return
    }

    try {
      // Générer le numéro de facture
      const response = await fetch('/api/factures/generate-numero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atelier_id: atelierId }),
      })
      const { numero } = await response.json()

      // Créer la facture
      const { data: facture, error: factureError } = await supabase
        .from('factures')
        .insert({
          atelier_id: atelierId,
          client_id: formData.client_id,
          projet_id: formData.projet_id || null,
          numero,
          type: formData.type,
          categorie_operation: formData.categorie_operation || 'services',
          items: formData.items,
          total_ht: formData.total_ht,
          total_ttc: formData.total_ttc,
          tva_rate: formData.tva_rate,
          acompte_amount: formData.type === 'solde' ? formData.acompte_amount : null,
          due_date: formData.due_date || null,
          notes: formData.notes || null,
          status: 'brouillon',
          payment_status: 'unpaid',
        })
        .select('id')
        .single()

      if (factureError) throw factureError

      router.push(`/app/factures/${facture.id}`)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la facture')
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

        {/* Client et projet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="client_id" className="block text-sm font-medium text-gray-700 mb-2">
              Client *
            </label>
            <div className="flex gap-2">
              <select
                id="client_id"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value, projet_id: '' })}
                required
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner un client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} ({client.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowClientModal(true)}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1 text-sm font-medium whitespace-nowrap"
                title="Créer un nouveau client"
              >
                <span>+</span>
                <span className="hidden sm:inline">Nouveau</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="projet_id" className="block text-sm font-medium text-gray-700 mb-2">
              Projet (optionnel)
            </label>
            <select
              id="projet_id"
              value={formData.projet_id}
              onChange={(e) => setFormData({ ...formData, projet_id: e.target.value })}
              disabled={!formData.client_id}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Aucun projet</option>
              {projetsFiltres.map((projet) => (
                <option key={projet.id} value={projet.id}>
                  {projet.name} (#{projet.numero})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Type de facture */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type de facture *</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="complete"
                checked={formData.type === 'complete'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="mr-2"
              />
              Complète
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="acompte"
                checked={formData.type === 'acompte'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="mr-2"
              />
              Acompte
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="solde"
                checked={formData.type === 'solde'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="mr-2"
              />
              Solde
            </label>
          </div>
        </div>

        {/* Catégorie d'opération (obligation légale Décret 2022-1299) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nature de l&apos;opération *
            <span className="text-xs text-gray-400 ml-1">(mention légale obligatoire)</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="categorie_operation"
                value="services"
                checked={formData.categorie_operation === 'services'}
                onChange={(e) => setFormData({ ...formData, categorie_operation: e.target.value })}
                className="mr-2"
              />
              Prestations de services
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="categorie_operation"
                value="biens"
                checked={formData.categorie_operation === 'biens'}
                onChange={(e) => setFormData({ ...formData, categorie_operation: e.target.value })}
                className="mr-2"
              />
              Livraison de biens
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="categorie_operation"
                value="mixte"
                checked={formData.categorie_operation === 'mixte'}
                onChange={(e) => setFormData({ ...formData, categorie_operation: e.target.value })}
                className="mr-2"
              />
              Biens et services
            </label>
          </div>
        </div>

        {/* Acompte si solde */}
        {formData.type === 'solde' && (
          <div>
            <label htmlFor="acompte_amount" className="block text-sm font-medium text-gray-700 mb-2">
              Montant acompte déjà payé (€)
            </label>
            <input
              id="acompte_amount"
              type="number"
              step="0.01"
              value={formData.acompte_amount || 0}
              onChange={(e) =>
                setFormData({ ...formData, acompte_amount: Number(e.target.value) || 0 })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Items */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-medium text-gray-700">Items facturés *</label>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-sm text-orange-500 hover:text-blue-700 font-medium"
            >
              + Ajouter un item
            </button>
          </div>

          <div className="space-y-4">
            {formData.items?.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 p-4 border border-gray-200 rounded-lg">
                <div className="col-span-12 md:col-span-5">
                  <input
                    type="text"
                    placeholder="Désignation"
                    value={item.designation}
                    onChange={(e) => handleItemChange(index, 'designation', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <input
                    type="number"
                    placeholder="Qté"
                    value={item.quantite}
                    onChange={(e) => handleItemChange(index, 'quantite', e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Prix HT"
                    value={item.prix_unitaire_ht}
                    onChange={(e) => handleItemChange(index, 'prix_unitaire_ht', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="TVA %"
                    value={item.tva_rate}
                    onChange={(e) => handleItemChange(index, 'tva_rate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="col-span-2 md:col-span-1 text-right">
                  <p className="text-sm font-semibold text-gray-900 py-2">
                    {item.total_ttc.toFixed(2)} €
                  </p>
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totaux */}
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Total HT</span>
            <span className="text-lg font-semibold text-gray-900">
              {formData.total_ht?.toFixed(2) || '0.00'} €
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">TVA ({formData.tva_rate}%)</span>
            <span className="text-lg font-semibold text-gray-900">
              {((formData.total_ttc || 0) - (formData.total_ht || 0)).toFixed(2)} €
            </span>
          </div>
          {formData.type === 'solde' && formData.acompte_amount && formData.acompte_amount > 0 && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Acompte</span>
              <span className="text-lg font-semibold text-gray-900">
                - {formData.acompte_amount.toFixed(2)} €
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-4 border-t border-gray-300">
            <span className="text-xl font-bold text-gray-900">
              {formData.type === 'solde' && formData.acompte_amount
                ? 'Solde à payer'
                : 'Total TTC'}
            </span>
            <span className="text-2xl font-bold text-orange-500">
              {(
                formData.type === 'solde' && formData.acompte_amount
                  ? (formData.total_ttc || 0) - formData.acompte_amount
                  : formData.total_ttc || 0
              ).toFixed(2)}{' '}
              €
            </span>
          </div>
        </div>

        {/* Date échéance et notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-2">
              Date d'échéance (optionnel)
            </label>
            <input
              id="due_date"
              type="date"
              value={formData.due_date || ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optionnel)
          </label>
          <textarea
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Notes additionnelles pour la facture..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Création...' : 'Créer la facture'}
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
      <QuickCreateClientModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        atelierId={atelierId}
        onClientCreated={(newClient) => {
          setClients([...clients, { 
            id: newClient.id, 
            full_name: newClient.full_name, 
            email: newClient.email, 
            type: newClient.type 
          }])
          setFormData({ ...formData, client_id: newClient.id, projet_id: '' })
        }}
      />
    </form>
  )
}
