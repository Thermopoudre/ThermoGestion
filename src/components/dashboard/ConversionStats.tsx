'use client'

interface ConversionStatsProps {
  totalDevis: number
  devisAcceptes: number
  devisRefuses: number
  tauxConversion: number
  tempsSignatureMoyen: number // en jours
  montantMoyenDevis: number
}

export function ConversionStats({
  totalDevis,
  devisAcceptes,
  devisRefuses,
  tauxConversion,
  tempsSignatureMoyen,
  montantMoyenDevis,
}: ConversionStatsProps) {
  const devisEnCours = totalDevis - devisAcceptes - devisRefuses

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📊 Conversion Devis</h3>
      
      {/* Barre de progression */}
      <div className="mb-4">
        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div 
            className="bg-green-500 transition-all duration-500"
            style={{ width: `${totalDevis > 0 ? (devisAcceptes / totalDevis) * 100 : 0}%` }}
            title={`${devisAcceptes} accepté(s)`}
          />
          <div 
            className="bg-yellow-500 transition-all duration-500"
            style={{ width: `${totalDevis > 0 ? (devisEnCours / totalDevis) * 100 : 0}%` }}
            title={`${devisEnCours} en cours`}
          />
          <div 
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${totalDevis > 0 ? (devisRefuses / totalDevis) * 100 : 0}%` }}
            title={`${devisRefuses} refusé(s)`}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Acceptés ({devisAcceptes})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            En cours ({devisEnCours})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            Refusés ({devisRefuses})
          </span>
        </div>
      </div>

      {/* Stats détaillées */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{tauxConversion.toFixed(0)}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Taux conversion</p>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{tempsSignatureMoyen.toFixed(0)}j</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Temps moyen</p>
        </div>
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {montantMoyenDevis.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Panier moyen</p>
        </div>
      </div>
    </div>
  )
}
