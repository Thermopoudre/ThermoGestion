'use client'

interface StatsOverviewProps {
  caTotal: number
  nbProjets: number
  nbClients: number
  tauxConversion: number
  projetsTaux: number
  delaiMoyen: number
}

export function StatsOverview({
  caTotal,
  nbProjets,
  nbClients,
  tauxConversion,
  projetsTaux,
  delaiMoyen,
}: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="text-2xl mb-2">💰</div>
        <p className="text-sm text-gray-500">CA Total</p>
        <p className="text-xl font-bold text-gray-900">
          {caTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="text-2xl mb-2">🔧</div>
        <p className="text-sm text-gray-500">Projets</p>
        <p className="text-xl font-bold text-gray-900">{nbProjets}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="text-2xl mb-2">👥</div>
        <p className="text-sm text-gray-500">Clients</p>
        <p className="text-xl font-bold text-gray-900">{nbClients}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="text-2xl mb-2">📝</div>
        <p className="text-sm text-gray-500">Taux conversion devis</p>
        <p className="text-xl font-bold text-gray-900">{tauxConversion.toFixed(1)}%</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="text-2xl mb-2">✅</div>
        <p className="text-sm text-gray-500">Projets livrés</p>
        <p className="text-xl font-bold text-gray-900">{projetsTaux.toFixed(1)}%</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="text-2xl mb-2">⏱️</div>
        <p className="text-sm text-gray-500">Délai moyen</p>
        <p className="text-xl font-bold text-gray-900">{delaiMoyen.toFixed(0)} jours</p>
      </div>
    </div>
  )
}
