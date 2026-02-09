'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Bell, Send, Clock, CheckCircle, XCircle, 
  Users, FileText, Plus, Trash2, Filter,
  TrendingUp, AlertTriangle, Calendar, Mail
} from 'lucide-react'

interface Relance {
  id: string
  client_id: string | null
  devis_id: string | null
  type: string
  statut: string
  date_relance: string | null
  message: string | null
  created_at: string
  client?: { full_name: string; email: string } | null
  devis?: { numero: string; total_ttc: number; valid_until: string } | null
}

export default function RelancesPage() {
  const [relances, setRelances] = useState<Relance[]>([])
  const [devisExpires, setDevisExpires] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [showAutoGenerate, setShowAutoGenerate] = useState(false)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.user.id).single()
    if (!userData?.atelier_id) return

    // Relances existantes
    const { data: relancesData } = await supabase
      .from('relances_commerciales')
      .select('*')
      .eq('atelier_id', userData.atelier_id)
      .order('created_at', { ascending: false })

    // Devis qui arrivent à expiration ou sont expirés
    const { data: devisData } = await supabase
      .from('devis')
      .select('id, numero, total_ttc, valid_until, status, clients(full_name, email)')
      .eq('atelier_id', userData.atelier_id)
      .in('status', ['envoye'])
      .order('valid_until', { ascending: true })

    const now = new Date()
    const expirantBientot = (devisData || []).filter((d: any) => {
      if (!d.valid_until) return false
      const expDate = new Date(d.valid_until)
      const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntil <= 7 // 7 jours ou moins
    })

    setDevisExpires(expirantBientot)
    setRelances(relancesData || [])
    setLoading(false)
  }

  async function generateRelances() {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.user.id).single()
    if (!userData?.atelier_id) return

    let count = 0
    for (const devis of devisExpires) {
      const daysUntil = Math.ceil((new Date(devis.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      
      // Vérifier qu'on n'a pas déjà une relance pour ce devis
      const existing = relances.find(r => r.devis_id === devis.id && r.statut !== 'annule')
      if (existing) continue

      const message = daysUntil <= 0
        ? `Bonjour, votre devis ${devis.numero} a expiré. Souhaitez-vous le renouveler ?`
        : `Bonjour, votre devis ${devis.numero} expire dans ${daysUntil} jours. N'hésitez pas à nous contacter.`

      await supabase.from('relances_commerciales').insert({
        atelier_id: userData.atelier_id,
        client_id: null, // On n'a pas le client_id directement
        devis_id: devis.id,
        type: daysUntil <= 0 ? 'devis_expire' : 'devis_bientot_expire',
        statut: 'a_envoyer',
        date_relance: new Date().toISOString(),
        message,
      })
      count++
    }

    if (count > 0) {
      alert(`${count} relances générées avec succès`)
    } else {
      alert('Aucune nouvelle relance à générer')
    }

    setShowAutoGenerate(false)
    loadData()
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('relances_commerciales').update({ statut }).eq('id', id)
    loadData()
  }

  async function deleteRelance(id: string) {
    if (!confirm('Supprimer cette relance ?')) return
    await supabase.from('relances_commerciales').delete().eq('id', id)
    loadData()
  }

  const filteredRelances = relances.filter(r => {
    if (filter === 'all') return true
    return r.statut === filter
  })

  const stats = {
    total: relances.length,
    aEnvoyer: relances.filter(r => r.statut === 'a_envoyer').length,
    envoye: relances.filter(r => r.statut === 'envoye').length,
    repondu: relances.filter(r => r.statut === 'repondu').length,
    devisEnDanger: devisExpires.length,
  }

  const statutConfig: Record<string, { label: string; color: string; icon: any }> = {
    a_envoyer: { label: 'A envoyer', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    envoye: { label: 'Envoyé', color: 'bg-blue-100 text-blue-700', icon: Send },
    repondu: { label: 'Répondu', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    annule: { label: 'Annulé', color: 'bg-gray-100 text-gray-500', icon: XCircle },
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-orange-500" />
            Relances commerciales
          </h1>
          <p className="text-gray-500 mt-1">Suivi automatique des devis et relances clients</p>
        </div>
        <button
          onClick={() => setShowAutoGenerate(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 flex items-center gap-2"
        >
          <TrendingUp className="w-5 h-5" />
          Générer les relances
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.devisEnDanger}</p>
          <p className="text-sm text-gray-500">Devis expirant bientôt</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Clock className="w-8 h-8 text-yellow-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.aEnvoyer}</p>
          <p className="text-sm text-gray-500">A envoyer</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Send className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.envoye}</p>
          <p className="text-sm text-gray-500">Envoyées</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.repondu}</p>
          <p className="text-sm text-gray-500">Répondues</p>
        </div>
      </div>

      {/* Devis en danger */}
      {devisExpires.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-red-900 dark:text-red-200 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5" />
            Devis expirant bientôt ({devisExpires.length})
          </h3>
          <div className="space-y-2">
            {devisExpires.slice(0, 5).map((d: any) => {
              const daysUntil = Math.ceil((new Date(d.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              return (
                <div key={d.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{d.numero}</span>
                    <span className="text-sm text-gray-500 ml-2">{(d.clients as any)?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {d.total_ttc?.toFixed(2)} EUR
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      daysUntil <= 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {daysUntil <= 0 ? 'Expiré' : `J-${daysUntil}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Filter className="w-5 h-5 text-gray-400" />
        {['all', 'a_envoyer', 'envoye', 'repondu', 'annule'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {f === 'all' ? 'Toutes' : statutConfig[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Liste des relances */}
      {filteredRelances.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow">
          <Mail className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucune relance</h2>
          <p className="text-gray-500">
            {filter !== 'all' ? 'Aucune relance avec ce filtre' : 'Utilisez le bouton "Générer" pour créer des relances automatiques'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRelances.map(relance => {
            const config = statutConfig[relance.statut] || statutConfig.a_envoyer
            const StatutIcon = config.icon
            return (
              <div key={relance.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <StatutIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {relance.type === 'devis_expire' ? 'Devis expiré' : 
                       relance.type === 'devis_bientot_expire' ? 'Devis bientôt expiré' :
                       relance.type}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{relance.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(relance.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {relance.statut === 'a_envoyer' && (
                    <button
                      onClick={() => updateStatut(relance.id, 'envoye')}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600"
                    >
                      Marquer envoyée
                    </button>
                  )}
                  {relance.statut === 'envoye' && (
                    <button
                      onClick={() => updateStatut(relance.id, 'repondu')}
                      className="px-3 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600"
                    >
                      Répondu
                    </button>
                  )}
                  <button
                    onClick={() => deleteRelance(relance.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal génération auto */}
      {showAutoGenerate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAutoGenerate(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Générer des relances</h2>
            <p className="text-gray-500 mb-4">
              Cette action va analyser vos devis et créer automatiquement des relances pour :
            </p>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-6">
              <li className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Devis expirés</li>
              <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> Devis expirant dans les 7 jours</li>
            </ul>
            <p className="text-sm text-gray-500 mb-6">
              {devisExpires.length} devis détectés pour relance.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAutoGenerate(false)} className="px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100">
                Annuler
              </button>
              <button onClick={generateRelances} className="px-6 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600">
                Générer ({devisExpires.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
