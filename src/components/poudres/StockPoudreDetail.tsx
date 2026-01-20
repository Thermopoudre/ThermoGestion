'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Poudre = Database['public']['Tables']['poudres']['Row']
type StockPoudre = Database['public']['Tables']['stock_poudres']['Row']

interface StockPoudreDetailProps {
  poudre: Poudre
  stock: StockPoudre | null
  atelierId: string
}

export function StockPoudreDetail({ poudre, stock, atelierId }: StockPoudreDetailProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [peseeMode, setPeseeMode] = useState(false)
  
  const [formData, setFormData] = useState({
    poids_brut_kg: '',
    tare_carton_kg: stock?.tare_carton_kg?.toString() || '',
    stock_reel_kg: stock?.stock_reel_kg?.toString() || '',
  })

  const stockTheorique = stock ? Number(stock.stock_theorique_kg) : 0
  const stockReel = stock?.stock_reel_kg ? Number(stock.stock_reel_kg) : null
  const ecart = stockReel !== null ? stockReel - stockTheorique : null
  const ecartPourcentage = stockReel !== null && stockTheorique > 0 
    ? ((ecart! / stockTheorique) * 100).toFixed(1)
    : null

  const handlePesee = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const poidsBrut = parseFloat(formData.poids_brut_kg)
      const tareCarton = parseFloat(formData.tare_carton_kg) || 0
      const stockReel = poidsBrut - tareCarton

      if (stockReel < 0) {
        throw new Error('Le stock réel ne peut pas être négatif')
      }

      // Créer ou mettre à jour le stock
      const stockData = {
        atelier_id: atelierId,
        poudre_id: poudre.id,
        stock_reel_kg: stockReel,
        tare_carton_kg: tareCarton,
        dernier_pesee_at: new Date().toISOString(),
      }

      // Récupérer l'historique existant
      const historiquePesees = stock?.historique_pesees as any[] || []
      const nouvellePesee = {
        date: new Date().toISOString(),
        poids_brut: poidsBrut,
        tare_carton: tareCarton,
        stock_reel: stockReel,
        stock_theorique: stockTheorique,
        ecart: stockReel - stockTheorique,
      }
      historiquePesees.unshift(nouvellePesee)
      // Garder seulement les 20 dernières pesées
      const historiqueLimite = historiquePesees.slice(0, 20)
      
      stockData.historique_pesees = historiqueLimite as any

      if (stock) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('stock_poudres')
          .update(stockData)
          .eq('id', stock.id)

        if (updateError) throw updateError
      } else {
        // Création
        stockData.stock_theorique_kg = stockTheorique
        const { error: insertError } = await supabase
          .from('stock_poudres')
          .insert(stockData)

        if (insertError) throw insertError
      }

      setPeseeMode(false)
      setFormData({ poids_brut_kg: '', tare_carton_kg: formData.tare_carton_kg, stock_reel_kg: '' })
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la pesée')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStockReel = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const stockReel = parseFloat(formData.stock_reel_kg)

      if (!stock) {
        // Créer le stock si n'existe pas
        const { error: insertError } = await supabase
          .from('stock_poudres')
          .insert({
            atelier_id: atelierId,
            poudre_id: poudre.id,
            stock_theorique_kg: stockTheorique,
            stock_reel_kg: stockReel,
            dernier_pesee_at: new Date().toISOString(),
          })

        if (insertError) throw insertError
      } else {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('stock_poudres')
          .update({
            stock_reel_kg: stockReel,
            dernier_pesee_at: new Date().toISOString(),
          })
          .eq('id', stock.id)

        if (updateError) throw updateError
      }

      setPeseeMode(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Informations poudre */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Informations poudre</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Marque</label>
            <p className="text-gray-900">{poudre.marque}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Référence</label>
            <p className="text-gray-900">{poudre.reference}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Type</label>
            <p className="text-gray-900">{poudre.type}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Finition</label>
            <p className="text-gray-900">{poudre.finition}</p>
          </div>
        </div>
      </div>

      {/* Stock actuel */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Stock actuel</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-600 mb-2">Stock théorique</label>
            <p className="text-3xl font-black text-blue-600">{stockTheorique.toFixed(2)} kg</p>
            <p className="text-sm text-gray-600 mt-2">Décrementé par projets/séries</p>
          </div>

          <div className={`border rounded-lg p-6 ${stockReel !== null ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <label className="block text-sm font-medium text-gray-600 mb-2">Stock réel</label>
            <p className={`text-3xl font-black ${stockReel !== null ? 'text-green-600' : 'text-gray-400'}`}>
              {stockReel !== null ? `${stockReel.toFixed(2)} kg` : 'Non pesé'}
            </p>
            {stock?.dernier_pesee_at && (
              <p className="text-sm text-gray-600 mt-2">
                Pesé le {new Date(stock.dernier_pesee_at).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>

          <div className={`border rounded-lg p-6 ${ecart !== null ? (ecart >= 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200') : 'bg-gray-50 border-gray-200'}`}>
            <label className="block text-sm font-medium text-gray-600 mb-2">Écart</label>
            <p className={`text-3xl font-black ${ecart !== null ? (ecart >= 0 ? 'text-yellow-600' : 'text-red-600') : 'text-gray-400'}`}>
              {ecart !== null ? `${ecart >= 0 ? '+' : ''}${ecart.toFixed(2)} kg` : '-'}
            </p>
            {ecartPourcentage !== null && (
              <p className="text-sm text-gray-600 mt-2">
                ({ecartPourcentage}%)
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {!peseeMode ? (
          <div className="flex gap-4">
            <button
              onClick={() => setPeseeMode(true)}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
            >
              📏 Nouvelle pesée
            </button>
            {stockReel !== null && (
              <button
                onClick={() => {
                  setPeseeMode(true)
                  setFormData({ ...formData, stock_reel_kg: stockReel.toString() })
                }}
                className="bg-white border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-50 transition-all"
              >
                ✏️ Modifier stock réel
              </button>
            )}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Nouvelle pesée</h3>
            <form onSubmit={handlePesee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="poids_brut_kg" className="block text-sm font-medium text-gray-700 mb-2">
                    Poids brut (kg) *
                  </label>
                  <input
                    id="poids_brut_kg"
                    type="number"
                    step="0.01"
                    value={formData.poids_brut_kg}
                    onChange={(e) => setFormData({ ...formData, poids_brut_kg: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="5.5"
                  />
                </div>

                <div>
                  <label htmlFor="tare_carton_kg" className="block text-sm font-medium text-gray-700 mb-2">
                    Tare carton (kg)
                  </label>
                  <input
                    id="tare_carton_kg"
                    type="number"
                    step="0.01"
                    value={formData.tare_carton_kg}
                    onChange={(e) => setFormData({ ...formData, tare_carton_kg: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Poids du carton vide</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock réel calculé
                  </label>
                  <div className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg">
                    {formData.poids_brut_kg && (
                      <p className="text-lg font-bold text-gray-900">
                        {(parseFloat(formData.poids_brut_kg || '0') - parseFloat(formData.tare_carton_kg || '0')).toFixed(2)} kg
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50"
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer pesée'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeseeMode(false)
                    setFormData({ poids_brut_kg: '', tare_carton_kg: stock?.tare_carton_kg?.toString() || '', stock_reel_kg: '' })
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Ou modifier directement le stock réel :</h4>
              <form onSubmit={handleUpdateStockReel} className="flex gap-4">
                <input
                  type="number"
                  step="0.01"
                  value={formData.stock_reel_kg}
                  onChange={(e) => setFormData({ ...formData, stock_reel_kg: e.target.value })}
                  placeholder="Stock réel (kg)"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-white border border-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Mettre à jour
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Historique des pesées */}
      {stock?.historique_pesees && (stock.historique_pesees as any[]).length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Historique des pesées</h2>
          <div className="space-y-3">
            {(stock.historique_pesees as any[]).slice(0, 10).map((pesee: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {new Date(pesee.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    Poids brut: {pesee.poids_brut} kg - Tare: {pesee.tare_carton} kg
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{pesee.stock_reel.toFixed(2)} kg</p>
                  {pesee.ecart !== 0 && (
                    <p className={`text-sm ${pesee.ecart >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {pesee.ecart >= 0 ? '+' : ''}{pesee.ecart.toFixed(2)} kg
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
