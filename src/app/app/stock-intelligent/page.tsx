'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Scale, AlertTriangle, CheckCircle, TrendingDown, BarChart3, RefreshCw, Plus } from 'lucide-react'

interface PoudreStock {
  id: string
  reference: string
  marque: string
  ral: string | null
  finition: string
  stock_poudres: { stock_theorique_kg: number; stock_reel_kg: number | null }[]
  date_peremption: string | null
}

interface SuggestionPesee {
  poudre: PoudreStock
  raison: string
  priorite: number
}

export default function StockIntelligentPage() {
  const supabase = createBrowserClient()
  const [poudres, setPoudres] = useState<PoudreStock[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionPesee[]>([])
  const [loading, setLoading] = useState(true)
  const [showPesee, setShowPesee] = useState<PoudreStock | null>(null)
  const [peseeForm, setPeseeForm] = useState({ poids_brut: '', tare: '0.5' })

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('poudres')
      .select('id, reference, marque, ral, finition, date_peremption, stock_poudres(stock_theorique_kg, stock_reel_kg)')
      .order('reference')

    if (data) {
      setPoudres(data as any)
      // Générer suggestions de pesées quotidiennes (3/jour)
      const sugs: SuggestionPesee[] = []
      for (const p of data as any[]) {
        const sp = p.stock_poudres?.[0]
        if (!sp) continue
        const ecart = sp.stock_reel_kg !== null ? Math.abs(sp.stock_theorique_kg - sp.stock_reel_kg) : null
        
        // Critère 1: Écart > 20% entre théorique et réel
        if (ecart !== null && sp.stock_theorique_kg > 0 && (ecart / sp.stock_theorique_kg) > 0.2) {
          sugs.push({ poudre: p, raison: `Écart important: ${ecart.toFixed(1)} kg (${((ecart / sp.stock_theorique_kg) * 100).toFixed(0)}%)`, priorite: 3 })
        }
        // Critère 2: Pas de pesée récente (stock_reel null)
        else if (sp.stock_reel_kg === null) {
          sugs.push({ poudre: p, raison: 'Aucune pesée enregistrée', priorite: 2 })
        }
        // Critère 3: Stock bas
        else if (sp.stock_theorique_kg < 5) {
          sugs.push({ poudre: p, raison: 'Stock bas - vérification recommandée', priorite: 1 })
        }
      }
      sugs.sort((a, b) => b.priorite - a.priorite)
      setSuggestions(sugs.slice(0, 5))
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handlePesee = async () => {
    if (!showPesee) return
    const poidsBrut = parseFloat(peseeForm.poids_brut)
    const tare = parseFloat(peseeForm.tare) || 0
    const poidsNet = poidsBrut - tare

    const sp = showPesee.stock_poudres?.[0]
    const stockTheorique = sp?.stock_theorique_kg || 0
    const ecart = poidsNet - stockTheorique
    const scoreFiabilite = stockTheorique > 0 ? Math.max(0, 100 - Math.abs(ecart / stockTheorique * 100)) : 100

    // Enregistrer la pesée
    await supabase.from('pesees_stock').insert({
      poudre_id: showPesee.id,
      poids_brut_kg: poidsBrut,
      tare_kg: tare,
      poids_net_kg: poidsNet,
      stock_theorique_avant: stockTheorique,
      ecart_kg: ecart,
      score_fiabilite: scoreFiabilite,
    })

    // Mettre à jour le stock réel
    await supabase.from('stock_poudres')
      .update({ stock_reel_kg: poidsNet })
      .eq('poudre_id', showPesee.id)

    setShowPesee(null)
    setPeseeForm({ poids_brut: '', tare: '0.5' })
    loadData()
  }

  const getScoreColor = (theorique: number, reel: number | null) => {
    if (reel === null) return 'text-gray-400'
    const ecartPct = theorique > 0 ? Math.abs(theorique - reel) / theorique * 100 : 0
    if (ecartPct < 5) return 'text-green-600'
    if (ecartPct < 15) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scale className="w-7 h-7 text-orange-500" />
            Stock Intelligent
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Pesées quotidiennes, réconciliation, score de fiabilité
          </p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
        </button>
      </div>

      {/* Suggestions de pesées quotidiennes */}
      {suggestions.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3">
            <Scale className="w-5 h-5" />
            Pesées suggérées aujourd&apos;hui ({suggestions.length})
          </h3>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-800/50">
                <div>
                  <span className="font-medium">{s.poudre.reference}</span>
                  <span className="text-gray-500 ml-2">{s.poudre.marque}</span>
                  {s.poudre.ral && <span className="text-sm text-gray-400 ml-2">RAL {s.poudre.ral}</span>}
                  <p className="text-sm text-blue-600 dark:text-blue-400">{s.raison}</p>
                </div>
                <button
                  onClick={() => setShowPesee(s.poudre)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Peser
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau de réconciliation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            Réconciliation Stock
          </h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Poudre</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Théorique</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Réel (pesé)</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Écart</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fiabilité</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Péremption</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {poudres.map(p => {
              const sp = p.stock_poudres?.[0]
              const theorique = sp?.stock_theorique_kg || 0
              const reel = sp?.stock_reel_kg
              const ecart = reel !== null && reel !== undefined ? (reel - theorique) : null
              const isExpiring = p.date_peremption && new Date(p.date_peremption) < new Date(Date.now() + 30 * 86400000)
              const isExpired = p.date_peremption && new Date(p.date_peremption) < new Date()
              
              return (
                <tr key={p.id} className={isExpired ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{p.reference}</div>
                    <div className="text-xs text-gray-500">{p.marque} {p.ral ? `RAL ${p.ral}` : ''} {p.finition}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{theorique.toFixed(1)} kg</td>
                  <td className="px-4 py-3 text-center font-mono">{reel !== null && reel !== undefined ? `${reel.toFixed(1)} kg` : '-'}</td>
                  <td className={`px-4 py-3 text-center font-mono font-bold ${ecart !== null ? (Math.abs(ecart) < 1 ? 'text-green-600' : ecart < 0 ? 'text-red-600' : 'text-yellow-600') : 'text-gray-400'}`}>
                    {ecart !== null ? `${ecart > 0 ? '+' : ''}${ecart.toFixed(1)} kg` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {reel !== null && reel !== undefined ? (
                      <span className={`inline-flex items-center gap-1 ${getScoreColor(theorique, reel)}`}>
                        {Math.abs(ecart || 0) < theorique * 0.05 ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {theorique > 0 ? `${Math.max(0, 100 - Math.abs((ecart || 0) / theorique * 100)).toFixed(0)}%` : 'N/A'}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {p.date_peremption ? (
                      <span className={isExpired ? 'text-red-600 font-bold' : isExpiring ? 'text-amber-600' : 'text-gray-500'}>
                        {isExpired ? 'PÉRIMÉE' : new Date(p.date_peremption).toLocaleDateString('fr-FR')}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setShowPesee(p)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200"
                    >
                      Peser
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal pesée */}
      {showPesee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-2">Peser: {showPesee.reference}</h3>
            <p className="text-sm text-gray-500 mb-4">{showPesee.marque} {showPesee.ral ? `RAL ${showPesee.ral}` : ''} {showPesee.finition}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Stock théorique: <strong>{(showPesee.stock_poudres?.[0]?.stock_theorique_kg || 0).toFixed(1)} kg</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Poids brut (kg) *</label>
                <input
                  type="number" step="0.01" autoFocus
                  value={peseeForm.poids_brut}
                  onChange={e => setPeseeForm({ ...peseeForm, poids_brut: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg text-lg font-mono dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Ex: 15.50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tare carton (kg)</label>
                <input
                  type="number" step="0.01"
                  value={peseeForm.tare}
                  onChange={e => setPeseeForm({ ...peseeForm, tare: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              {peseeForm.poids_brut && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-sm">Poids net: <strong className="text-lg">{(parseFloat(peseeForm.poids_brut) - parseFloat(peseeForm.tare || '0')).toFixed(2)} kg</strong></p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handlePesee} disabled={!peseeForm.poids_brut} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold disabled:opacity-50">
                Enregistrer la pesée
              </button>
              <button onClick={() => { setShowPesee(null); setPeseeForm({ poids_brut: '', tare: '0.5' }) }} className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
