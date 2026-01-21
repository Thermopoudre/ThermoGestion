'use client'

import { useMemo } from 'react'

interface DevisData {
  id: string
  status: string
  total_ht: number
  total_ttc: number
  created_at: string
  signed_at?: string | null
  client_id: string
}

interface DevisConversionStatsProps {
  devis: DevisData[]
  clients: Array<{ id: string; full_name: string }>
}

// Formater en euros
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function DevisConversionStats({ devis, clients }: DevisConversionStatsProps) {
  const stats = useMemo(() => {
    const total = devis.length
    const acceptes = devis.filter(d => ['accepte', 'converted'].includes(d.status))
    const refuses = devis.filter(d => d.status === 'refuse')
    const expires = devis.filter(d => d.status === 'expire')
    const enAttente = devis.filter(d => d.status === 'envoye')
    const brouillons = devis.filter(d => d.status === 'brouillon')
    
    // Taux de conversion
    const tauxConversion = total > 0 ? (acceptes.length / total) * 100 : 0
    
    // Taux de refus
    const tauxRefus = total > 0 ? (refuses.length / total) * 100 : 0
    
    // Montants
    const montantTotal = devis.reduce((sum, d) => sum + Number(d.total_ht || 0), 0)
    const montantAccepte = acceptes.reduce((sum, d) => sum + Number(d.total_ht || 0), 0)
    const montantEnAttente = enAttente.reduce((sum, d) => sum + Number(d.total_ht || 0), 0)
    const montantPerdu = refuses.concat(expires).reduce((sum, d) => sum + Number(d.total_ht || 0), 0)
    
    // Délai moyen de signature (pour les devis signés)
    const devisSigned = devis.filter(d => d.signed_at)
    let delaiMoyenSignature = 0
    if (devisSigned.length > 0) {
      const totalJours = devisSigned.reduce((sum, d) => {
        const created = new Date(d.created_at)
        const signed = new Date(d.signed_at!)
        const jours = Math.ceil((signed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return sum + jours
      }, 0)
      delaiMoyenSignature = totalJours / devisSigned.length
    }
    
    // Conversion par mois
    const conversionByMonth: Record<string, { total: number; accepte: number }> = {}
    for (const d of devis) {
      const date = new Date(d.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!conversionByMonth[key]) {
        conversionByMonth[key] = { total: 0, accepte: 0 }
      }
      conversionByMonth[key].total++
      if (['accepte', 'converted'].includes(d.status)) {
        conversionByMonth[key].accepte++
      }
    }
    
    // Top clients par taux de conversion
    const clientDevis: Record<string, { total: number; accepte: number; montant: number }> = {}
    for (const d of devis) {
      if (d.client_id) {
        if (!clientDevis[d.client_id]) {
          clientDevis[d.client_id] = { total: 0, accepte: 0, montant: 0 }
        }
        clientDevis[d.client_id].total++
        if (['accepte', 'converted'].includes(d.status)) {
          clientDevis[d.client_id].accepte++
          clientDevis[d.client_id].montant += Number(d.total_ht || 0)
        }
      }
    }
    
    const clientsStats = clients
      .map(c => ({
        ...c,
        total: clientDevis[c.id]?.total || 0,
        accepte: clientDevis[c.id]?.accepte || 0,
        montant: clientDevis[c.id]?.montant || 0,
        taux: clientDevis[c.id]?.total > 0 
          ? (clientDevis[c.id].accepte / clientDevis[c.id].total) * 100 
          : 0,
      }))
      .filter(c => c.total >= 2) // Au moins 2 devis
      .sort((a, b) => b.taux - a.taux)
      .slice(0, 5)

    return {
      total,
      acceptes: acceptes.length,
      refuses: refuses.length,
      expires: expires.length,
      enAttente: enAttente.length,
      brouillons: brouillons.length,
      tauxConversion,
      tauxRefus,
      montantTotal,
      montantAccepte,
      montantEnAttente,
      montantPerdu,
      delaiMoyenSignature,
      conversionByMonth,
      clientsStats,
    }
  }, [devis, clients])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <span className="text-2xl">📈</span>
        Conversion des Devis
      </h3>
      
      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-4">
          <div className="text-3xl font-black text-green-600 dark:text-green-400">
            {stats.tauxConversion.toFixed(1)}%
          </div>
          <div className="text-sm text-green-700 dark:text-green-300 font-medium">
            Taux conversion
          </div>
          <div className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
            {stats.acceptes} / {stats.total} devis
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-4">
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
            {stats.delaiMoyenSignature.toFixed(0)}j
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            Délai moyen
          </div>
          <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
            Création → Signature
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl p-4">
          <div className="text-2xl font-black text-orange-600 dark:text-orange-400">
            {formatMoney(stats.montantEnAttente)}
          </div>
          <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">
            En attente
          </div>
          <div className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-1">
            {stats.enAttente} devis envoyés
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-xl p-4">
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatMoney(stats.montantAccepte)}
          </div>
          <div className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            Montant accepté
          </div>
          <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
            CA potentiel validé
          </div>
        </div>
      </div>
      
      {/* Répartition des statuts */}
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Répartition des devis
        </h4>
        <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          {stats.total > 0 && (
            <>
              <div 
                className="bg-green-500 transition-all" 
                style={{ width: `${(stats.acceptes / stats.total) * 100}%` }}
                title={`Acceptés: ${stats.acceptes}`}
              />
              <div 
                className="bg-yellow-500 transition-all" 
                style={{ width: `${(stats.enAttente / stats.total) * 100}%` }}
                title={`En attente: ${stats.enAttente}`}
              />
              <div 
                className="bg-gray-400 transition-all" 
                style={{ width: `${(stats.brouillons / stats.total) * 100}%` }}
                title={`Brouillons: ${stats.brouillons}`}
              />
              <div 
                className="bg-red-500 transition-all" 
                style={{ width: `${(stats.refuses / stats.total) * 100}%` }}
                title={`Refusés: ${stats.refuses}`}
              />
              <div 
                className="bg-gray-600 transition-all" 
                style={{ width: `${(stats.expires / stats.total) * 100}%` }}
                title={`Expirés: ${stats.expires}`}
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            Acceptés ({stats.acceptes})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
            En attente ({stats.enAttente})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
            Brouillons ({stats.brouillons})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            Refusés ({stats.refuses})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-600 rounded-full"></span>
            Expirés ({stats.expires})
          </span>
        </div>
      </div>
      
      {/* Top clients par conversion */}
      {stats.clientsStats.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Meilleurs taux de conversion (clients)
          </h4>
          <div className="space-y-2">
            {stats.clientsStats.map((client, idx) => (
              <div 
                key={client.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                    idx === 1 ? 'bg-gray-300 text-gray-700' :
                    idx === 2 ? 'bg-amber-600 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {client.full_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {client.accepte}/{client.total} devis acceptés
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 dark:text-green-400">
                    {client.taux.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatMoney(client.montant)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Montant perdu */}
      {stats.montantPerdu > 0 && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-red-800 dark:text-red-300">
                Opportunités perdues
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                {stats.refuses + stats.expires} devis refusés/expirés
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatMoney(stats.montantPerdu)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
