'use client'

import { useState, useMemo } from 'react'
import { Palette, Clock, Zap, CheckCircle2, ArrowRight, Layers } from 'lucide-react'
import Link from 'next/link'

interface Projet {
  id: string
  numero: string
  name: string
  status: string
  poudre?: {
    id: string
    ral?: string
    reference: string
    finition?: string
  } | null
  client?: {
    full_name: string
  } | null
  surface_m2?: number
  date_souhaite?: string
  priority?: number
}

interface BatchingViewProps {
  projets: Projet[]
  onCreateBatch?: (projetIds: string[], ralCode: string) => void
}

interface ColorGroup {
  ral: string
  color: string
  projets: Projet[]
  totalSurface: number
  savingsMinutes: number
}

// Estimation du temps de changement de couleur
const CHANGEMENT_COULEUR_MINUTES = 45

// Couleurs RAL approximatives pour l'affichage
const RAL_COLORS: Record<string, string> = {
  '1000': '#CCC58F', '1001': '#D0B084', '1002': '#D2AA6D', '1003': '#F9A800', '1004': '#E49E00',
  '1005': '#CB8E00', '1006': '#E29000', '1007': '#E88C00', '1011': '#AF8050', '1012': '#DDAF27',
  '1013': '#E3D9C6', '1014': '#DDC49A', '1015': '#E6D2B5', '1016': '#F1DD38', '1017': '#F6A950',
  '1018': '#FACA30', '1019': '#A48F7A', '1020': '#A08F65', '1021': '#F6B600', '1023': '#F7B500',
  '1024': '#BA8F4C', '1026': '#FFFF00', '1027': '#A77F0E', '1028': '#FF9B00', '1032': '#E2A300',
  '1033': '#F99A1C', '1034': '#EB9C52', '1035': '#908370', '1036': '#80643F', '1037': '#F39F18',
  '2000': '#DA6E00', '2001': '#BE4E20', '2002': '#C63927', '2003': '#FA842B', '2004': '#E75B12',
  '2005': '#FF2300', '2007': '#FFA421', '2008': '#F3752C', '2009': '#E15501', '2010': '#D4652F',
  '2011': '#EC7C25', '2012': '#DB6A50', '2013': '#954527',
  '3000': '#AB2524', '3001': '#A02128', '3002': '#A1232B', '3003': '#8D1D2C', '3004': '#6B1C23',
  '3005': '#59191F', '3007': '#3E2022', '3009': '#6D342D', '3011': '#792423', '3012': '#CB8D73',
  '3013': '#9C322E', '3014': '#D47479', '3015': '#E1A6AD', '3016': '#AC4034', '3017': '#D3545F',
  '3018': '#D14152', '3020': '#C1121C', '3022': '#D56D56', '3024': '#FF2D21', '3026': '#FF2A1B',
  '3027': '#B42041', '3028': '#CB3334', '3031': '#AC323B', '3032': '#711521', '3033': '#B24C43',
  '4001': '#8A5A83', '4002': '#933D50', '4003': '#D15B8F', '4004': '#6B1C3F', '4005': '#83639D',
  '4006': '#992572', '4007': '#4A203B', '4008': '#904684', '4009': '#A38995', '4010': '#C63678',
  '4011': '#8773A1', '4012': '#6B6880',
  '5000': '#384C70', '5001': '#1F4764', '5002': '#2B2C7C', '5003': '#2A3756', '5004': '#1D1F2A',
  '5005': '#154889', '5007': '#41678D', '5008': '#313D48', '5009': '#2E5978', '5010': '#13447C',
  '5011': '#232C3F', '5012': '#3481B8', '5013': '#232D53', '5014': '#6C7C98', '5015': '#2874B2',
  '5017': '#0E518D', '5018': '#21888F', '5019': '#1A5784', '5020': '#0B4151', '5021': '#07737A',
  '5022': '#2F2A5A', '5023': '#4D668E', '5024': '#6A93B0', '5025': '#296478', '5026': '#102C54',
  '6000': '#587F40', '6001': '#366735', '6002': '#325928', '6003': '#50533C', '6004': '#024442',
  '6005': '#114232', '6006': '#3C392E', '6007': '#2C3222', '6008': '#37342A', '6009': '#27352A',
  '6010': '#4D6F39', '6011': '#6B7C59', '6012': '#343E40', '6013': '#7C765A', '6014': '#474135',
  '6015': '#3D3D36', '6016': '#00694C', '6017': '#587F40', '6018': '#61993B', '6019': '#B7D9B1',
  '6020': '#37422F', '6021': '#8DA580', '6022': '#3A3327', '6024': '#008351', '6025': '#5E6E3B',
  '6026': '#005F4E', '6027': '#7EBAB5', '6028': '#2E5D34', '6029': '#007243', '6032': '#0F8558',
  '6033': '#478A84', '6034': '#7FB0B2', '6035': '#1B4B35', '6036': '#005D52', '6037': '#008B29',
  '6038': '#00BB2E',
  '7000': '#7E8B92', '7001': '#8F999F', '7002': '#817F68', '7003': '#7A7B6D', '7004': '#9EA0A1',
  '7005': '#6B716F', '7006': '#756F61', '7008': '#745E3D', '7009': '#5D6058', '7010': '#585C56',
  '7011': '#555D61', '7012': '#575D5E', '7013': '#575044', '7015': '#51565C', '7016': '#373F43',
  '7021': '#2E3234', '7022': '#4B4D46', '7023': '#818479', '7024': '#474A50', '7026': '#374447',
  '7030': '#939388', '7031': '#5D6970', '7032': '#B9B9A8', '7033': '#818979', '7034': '#939176',
  '7035': '#C5C7C4', '7036': '#979392', '7037': '#7C7F7E', '7038': '#B4B8B0', '7039': '#6D6B65',
  '7040': '#9EA3A6', '7042': '#8E9291', '7043': '#4E5452', '7044': '#B7B3A8', '7045': '#91969A',
  '7046': '#82898E', '7047': '#CACFD6', '7048': '#898176',
  '8000': '#89693F', '8001': '#9D622B', '8002': '#794D3E', '8003': '#7E4B26', '8004': '#8F4E35',
  '8007': '#6F4A2F', '8008': '#6F4F28', '8011': '#5A3A29', '8012': '#66332B', '8014': '#4A3526',
  '8015': '#5E2F26', '8016': '#4C2B20', '8017': '#442F29', '8019': '#3D3635', '8022': '#1A1718',
  '8023': '#A45729', '8024': '#795038', '8025': '#755847', '8028': '#513A2A', '8029': '#7F4031',
  '9001': '#FDF4E3', '9002': '#F1EADB', '9003': '#FFFFFF', '9004': '#2D2D2B', '9005': '#0A0A0D',
  '9006': '#A5A8A6', '9007': '#8E8E88', '9010': '#F7F7F2', '9011': '#292C2F', '9016': '#F4F8F4',
  '9017': '#2A2D2F', '9018': '#CFD3CD', '9022': '#9C9C9C', '9023': '#7D8471',
}

export default function BatchingView({ projets, onCreateBatch }: BatchingViewProps) {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Grouper les projets par couleur RAL
  const colorGroups = useMemo<ColorGroup[]>(() => {
    const groups = new Map<string, Projet[]>()
    
    projets
      .filter(p => p.status === 'en_cours' || p.status === 'devis')
      .forEach(projet => {
        const ral = projet.poudre?.ral || 'SANS_RAL'
        if (!groups.has(ral)) {
          groups.set(ral, [])
        }
        groups.get(ral)!.push(projet)
      })

    return Array.from(groups.entries())
      .map(([ral, projs]) => ({
        ral,
        color: RAL_COLORS[ral] || '#808080',
        projets: projs.sort((a, b) => (a.priority || 0) - (b.priority || 0)),
        totalSurface: projs.reduce((sum, p) => sum + (p.surface_m2 || 0), 0),
        savingsMinutes: projs.length > 1 ? (projs.length - 1) * CHANGEMENT_COULEUR_MINUTES : 0
      }))
      .sort((a, b) => b.projets.length - a.projets.length)
  }, [projets])

  // Total des économies
  const totalSavings = useMemo(() => {
    return colorGroups
      .filter(g => g.projets.length > 1)
      .reduce((sum, g) => sum + g.savingsMinutes, 0)
  }, [colorGroups])

  const toggleGroup = (ral: string) => {
    const newSelected = new Set(selectedGroups)
    if (newSelected.has(ral)) {
      newSelected.delete(ral)
    } else {
      newSelected.add(ral)
    }
    setSelectedGroups(newSelected)
  }

  const handleCreateBatch = (group: ColorGroup) => {
    if (onCreateBatch) {
      onCreateBatch(group.projets.map(p => p.id), group.ral)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
              <Layers className="w-6 h-6 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Regroupement par couleur (Batching)
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Optimisez votre production en regroupant les projets de même couleur
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Couleurs différentes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{colorGroups.length}</p>
          </div>
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Projets regroupables</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {colorGroups.filter(g => g.projets.length > 1).reduce((sum, g) => sum + g.projets.length, 0)}
            </p>
          </div>
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Économie potentielle</p>
            <p className="text-2xl font-bold text-green-600">{Math.floor(totalSavings / 60)}h {totalSavings % 60}min</p>
          </div>
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Batches optimaux</p>
            <p className="text-2xl font-bold text-purple-600">{colorGroups.filter(g => g.projets.length > 1).length}</p>
          </div>
        </div>
      </div>

      {/* Grille des groupes de couleurs */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
        {colorGroups.map((group) => (
          <div
            key={group.ral}
            className={`bg-white dark:bg-gray-800 rounded-xl border-2 transition-all ${
              selectedGroups.has(group.ral)
                ? 'border-purple-500 shadow-lg'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            {/* Header du groupe */}
            <div 
              className="p-4 cursor-pointer"
              onClick={() => toggleGroup(group.ral)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg shadow-inner border-2 border-white"
                    style={{ backgroundColor: group.color }}
                  />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {group.ral === 'SANS_RAL' ? 'Sans RAL' : `RAL ${group.ral}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {group.projets.length} projet{group.projets.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {group.savingsMinutes > 0 && (
                  <div className="flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-sm">
                    <Zap className="w-4 h-4" />
                    -{group.savingsMinutes}min
                  </div>
                )}
              </div>
            </div>

            {/* Liste des projets */}
            <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-2">
              {group.projets.map((projet) => (
                <Link
                  key={projet.id}
                  href={`/app/projets/${projet.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      projet.status === 'en_cours' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{projet.numero}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[150px]">
                        {projet.client?.full_name}
                      </p>
                    </div>
                  </div>
                  {projet.surface_m2 && (
                    <span className="text-xs text-gray-500">{projet.surface_m2.toFixed(1)} m²</span>
                  )}
                </Link>
              ))}

              {/* Total surface */}
              {group.totalSurface > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                  <span className="text-sm text-gray-500">Surface totale</span>
                  <span className="font-semibold">{group.totalSurface.toFixed(1)} m²</span>
                </div>
              )}

              {/* Bouton créer batch */}
              {group.projets.length > 1 && onCreateBatch && (
                <button
                  onClick={() => handleCreateBatch(group)}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Créer un batch
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {colorGroups.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Aucun projet en attente de traitement</p>
        </div>
      )}
    </div>
  )
}
