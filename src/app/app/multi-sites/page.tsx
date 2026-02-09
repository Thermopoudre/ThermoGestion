'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Building2, Plus, MapPin, Users, TrendingUp,
  Settings, BarChart3, Link2, ChevronRight
} from 'lucide-react'

interface Site {
  id: string
  nom: string
  adresse: string
  ville: string
  code_postal: string
  responsable: string
  nb_projets: number
  ca_mois: number
  is_current: boolean
}

export default function MultiSitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [currentAtelier, setCurrentAtelier] = useState<any>(null)

  const supabase = createBrowserClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { data: userData } = await supabase
      .from('users').select('atelier_id, role').eq('id', user.user.id).single()
    if (!userData?.atelier_id) return

    const { data: atelier } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()

    setCurrentAtelier(atelier)

    // Pour le MVP, on montre l'atelier principal
    // La vraie implémentation multi-sites nécessiterait une table `sites` reliée à `ateliers`
    const mainSite: Site = {
      id: atelier?.id || '',
      nom: atelier?.nom || 'Atelier principal',
      adresse: atelier?.adresse || '',
      ville: atelier?.ville || '',
      code_postal: atelier?.code_postal || '',
      responsable: user.user.email || '',
      nb_projets: 0,
      ca_mois: 0,
      is_current: true,
    }

    // Compter les projets et CA
    const { count: projetsCount } = await supabase
      .from('projets')
      .select('*', { count: 'exact', head: true })
      .eq('atelier_id', userData.atelier_id)
      .gte('created_at', new Date(new Date().setDate(1)).toISOString())

    const { data: facturesCaMois } = await supabase
      .from('factures')
      .select('total_ttc')
      .eq('atelier_id', userData.atelier_id)
      .gte('date_facture', new Date(new Date().setDate(1)).toISOString().split('T')[0])

    mainSite.nb_projets = projetsCount || 0
    mainSite.ca_mois = (facturesCaMois || []).reduce((acc: number, f: any) => acc + (f.total_ttc || 0), 0)

    setSites([mainSite])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-orange-500" />
            Multi-sites
          </h1>
          <p className="text-gray-500 mt-1">Gérez plusieurs ateliers depuis un même compte</p>
        </div>
        <button
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 flex items-center gap-2"
          onClick={() => alert('La fonctionnalité multi-sites sera disponible dans la prochaine version. Contactez-nous pour en savoir plus.')}
        >
          <Plus className="w-5 h-5" />
          Ajouter un site
        </button>
      </div>

      {/* Vue consolidée */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Building2 className="w-8 h-8 text-orange-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{sites.length}</p>
          <p className="text-sm text-gray-500">Sites actifs</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <TrendingUp className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {sites.reduce((acc, s) => acc + s.ca_mois, 0).toFixed(0)} EUR
          </p>
          <p className="text-sm text-gray-500">CA consolidé (mois)</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <BarChart3 className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">
            {sites.reduce((acc, s) => acc + s.nb_projets, 0)}
          </p>
          <p className="text-sm text-gray-500">Projets ce mois</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
          <Users className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-black text-gray-900 dark:text-white">{sites.length}</p>
          <p className="text-sm text-gray-500">Responsables</p>
        </div>
      </div>

      {/* Liste des sites */}
      <div className="space-y-4">
        {sites.map(site => (
          <div key={site.id} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-l-4 ${
            site.is_current ? 'border-orange-500' : 'border-gray-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-orange-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{site.nom}</h3>
                    {site.is_current && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        Actuel
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {site.adresse ? `${site.adresse}, ` : ''}{site.code_postal} {site.ville}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Responsable: {site.responsable}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden md:block">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{site.ca_mois.toFixed(0)} EUR</p>
                  <p className="text-xs text-gray-500">CA ce mois</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{site.nb_projets}</p>
                  <p className="text-xs text-gray-500">Projets</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fonctionnalité à venir */}
      <div className="mt-8 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-2xl p-8 text-center">
        <Link2 className="w-12 h-12 mx-auto text-orange-500 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Multi-sites bientôt disponible
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
          Gérez plusieurs ateliers depuis un seul compte : statistiques consolidées, transfert de projets entre sites, 
          gestion des équipes par site, et reporting multi-sites.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 max-w-3xl mx-auto">
          {[
            'Stats consolidées',
            'Transfert de projets',
            'Équipes par site',
            'Stock partagé',
          ].map(feat => (
            <div key={feat} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              {feat}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
