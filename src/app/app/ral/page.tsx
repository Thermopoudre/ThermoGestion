'use client'

import { useState } from 'react'
import { Search, Copy, Check, Heart, Info } from 'lucide-react'

// RAL Classic Colors Database
const ralColors = [
  { code: '1000', name: 'Beige vert', hex: 'BEBD7F' },
  { code: '1001', name: 'Beige', hex: 'C2B078' },
  { code: '1002', name: 'Jaune sable', hex: 'C6A664' },
  { code: '1003', name: 'Jaune signal', hex: 'E5BE01' },
  { code: '1004', name: 'Jaune or', hex: 'CDA434' },
  { code: '1005', name: 'Jaune miel', hex: 'A98307' },
  { code: '1006', name: 'Jaune maïs', hex: 'E4A010' },
  { code: '1007', name: 'Jaune narcisse', hex: 'DC9D00' },
  { code: '1011', name: 'Beige brun', hex: '8A6642' },
  { code: '1012', name: 'Jaune citron', hex: 'C7B446' },
  { code: '1013', name: 'Blanc perlé', hex: 'EAE6CA' },
  { code: '1014', name: 'Ivoire', hex: 'E1CC4F' },
  { code: '1015', name: 'Ivoire clair', hex: 'E6D690' },
  { code: '1016', name: 'Jaune soufre', hex: 'EDFF21' },
  { code: '1017', name: 'Jaune safran', hex: 'F5D033' },
  { code: '1018', name: 'Jaune zinc', hex: 'F8F32B' },
  { code: '1019', name: 'Beige gris', hex: '9E9764' },
  { code: '1020', name: 'Jaune olive', hex: '999950' },
  { code: '1021', name: 'Jaune colza', hex: 'F3DA0B' },
  { code: '1023', name: 'Jaune signalisation', hex: 'FAD201' },
  { code: '1024', name: 'Jaune ocre', hex: 'AEA04B' },
  { code: '1026', name: 'Jaune brillant', hex: 'FFFF00' },
  { code: '1027', name: 'Jaune curry', hex: '9D9101' },
  { code: '1028', name: 'Jaune melon', hex: 'F4A900' },
  { code: '1032', name: 'Jaune genêt', hex: 'D6AE01' },
  { code: '1033', name: 'Jaune dahlia', hex: 'F3A505' },
  { code: '1034', name: 'Jaune pastel', hex: 'EFA94A' },
  { code: '2000', name: 'Orangé jaune', hex: 'ED760E' },
  { code: '2001', name: 'Orangé rouge', hex: 'C93C20' },
  { code: '2002', name: 'Orangé sang', hex: 'CB2821' },
  { code: '2003', name: 'Orangé pastel', hex: 'FF7514' },
  { code: '2004', name: 'Orangé pur', hex: 'F44611' },
  { code: '2008', name: 'Orangé rouge clair', hex: 'F75E25' },
  { code: '2009', name: 'Orangé signalisation', hex: 'F54021' },
  { code: '2010', name: 'Orangé signal', hex: 'D84B20' },
  { code: '2011', name: 'Orangé foncé', hex: 'EC7C26' },
  { code: '2012', name: 'Orangé saumon', hex: 'E55137' },
  { code: '3000', name: 'Rouge feu', hex: 'AF2B1E' },
  { code: '3001', name: 'Rouge signal', hex: 'A52019' },
  { code: '3002', name: 'Rouge carmin', hex: 'A2231D' },
  { code: '3003', name: 'Rouge rubis', hex: '9B111E' },
  { code: '3004', name: 'Rouge pourpre', hex: '75151E' },
  { code: '3005', name: 'Rouge vin', hex: '5E2129' },
  { code: '3007', name: 'Rouge noir', hex: '412227' },
  { code: '3009', name: 'Rouge oxyde', hex: '642424' },
  { code: '3011', name: 'Rouge brun', hex: '781F19' },
  { code: '3012', name: 'Rouge beige', hex: 'C1876B' },
  { code: '3013', name: 'Rouge tomate', hex: 'A12312' },
  { code: '3014', name: 'Vieux rose', hex: 'D36E70' },
  { code: '3015', name: 'Rose clair', hex: 'EA899A' },
  { code: '3016', name: 'Rouge corail', hex: 'B32821' },
  { code: '3017', name: 'Rosé', hex: 'E63244' },
  { code: '3018', name: 'Rouge fraise', hex: 'D53032' },
  { code: '3020', name: 'Rouge signalisation', hex: 'CC0605' },
  { code: '3022', name: 'Rouge saumon', hex: 'D95030' },
  { code: '3024', name: 'Rouge brillant', hex: 'F80000' },
  { code: '3026', name: 'Rouge fluorescent', hex: 'FE0000' },
  { code: '3027', name: 'Rouge framboise', hex: 'C51D34' },
  { code: '3031', name: 'Rouge oriental', hex: 'B32428' },
  { code: '4001', name: 'Lilas rouge', hex: '6D3F5B' },
  { code: '4002', name: 'Violet rouge', hex: '922B3E' },
  { code: '4003', name: 'Violet bruyère', hex: 'DE4C8A' },
  { code: '4004', name: 'Violet bordeaux', hex: '641C34' },
  { code: '4005', name: 'Lilas bleu', hex: '6C4675' },
  { code: '4006', name: 'Pourpre signalisation', hex: 'A03472' },
  { code: '4007', name: 'Violet pourpre', hex: '4A192C' },
  { code: '4008', name: 'Violet signal', hex: '924E7D' },
  { code: '4009', name: 'Violet pastel', hex: 'A18594' },
  { code: '4010', name: 'Télémagenta', hex: 'CF3476' },
  { code: '5000', name: 'Bleu violet', hex: '354D73' },
  { code: '5001', name: 'Bleu vert', hex: '1F3438' },
  { code: '5002', name: 'Bleu outremer', hex: '20214F' },
  { code: '5003', name: 'Bleu saphir', hex: '1D1E33' },
  { code: '5004', name: 'Bleu noir', hex: '18171C' },
  { code: '5005', name: 'Bleu signal', hex: '1E2460' },
  { code: '5007', name: 'Bleu brillant', hex: '3E5F8A' },
  { code: '5008', name: 'Bleu gris', hex: '26252D' },
  { code: '5009', name: 'Bleu azur', hex: '025669' },
  { code: '5010', name: 'Bleu gentiane', hex: '0E294B' },
  { code: '5011', name: 'Bleu acier', hex: '231A24' },
  { code: '5012', name: 'Bleu clair', hex: '3B83BD' },
  { code: '5013', name: 'Bleu cobalt', hex: '1E213D' },
  { code: '5014', name: 'Bleu pigeon', hex: '606E8C' },
  { code: '5015', name: 'Bleu ciel', hex: '2271B3' },
  { code: '5017', name: 'Bleu signalisation', hex: '063971' },
  { code: '5018', name: 'Bleu turquoise', hex: '3F888F' },
  { code: '5019', name: 'Bleu capri', hex: '1B5583' },
  { code: '5020', name: 'Bleu océan', hex: '1D334A' },
  { code: '5021', name: 'Bleu d\'eau', hex: '256D7B' },
  { code: '5022', name: 'Bleu nuit', hex: '252850' },
  { code: '5023', name: 'Bleu distant', hex: '49678D' },
  { code: '5024', name: 'Bleu pastel', hex: '5D9B9B' },
  { code: '6000', name: 'Vert patine', hex: '316650' },
  { code: '6001', name: 'Vert émeraude', hex: '287233' },
  { code: '6002', name: 'Vert feuillage', hex: '2D572C' },
  { code: '6003', name: 'Vert olive', hex: '424632' },
  { code: '6004', name: 'Vert bleu', hex: '1F3A3D' },
  { code: '6005', name: 'Vert mousse', hex: '2F4538' },
  { code: '6006', name: 'Olive gris', hex: '3E3B32' },
  { code: '6007', name: 'Vert bouteille', hex: '343B29' },
  { code: '6008', name: 'Vert brun', hex: '39352A' },
  { code: '6009', name: 'Vert sapin', hex: '31372B' },
  { code: '6010', name: 'Vert herbe', hex: '35682D' },
  { code: '6011', name: 'Vert réséda', hex: '587246' },
  { code: '6012', name: 'Vert noir', hex: '343E40' },
  { code: '6013', name: 'Vert jonc', hex: '6C7156' },
  { code: '6014', name: 'Olive jaune', hex: '47402E' },
  { code: '6015', name: 'Olive noir', hex: '3B3C36' },
  { code: '6016', name: 'Vert turquoise', hex: '1E5945' },
  { code: '6017', name: 'Vert mai', hex: '4C9141' },
  { code: '6018', name: 'Vert jaune', hex: '57A639' },
  { code: '6019', name: 'Vert blanc', hex: 'BDECB6' },
  { code: '6020', name: 'Vert oxyde chromique', hex: '2E3A23' },
  { code: '6021', name: 'Vert pâle', hex: '89AC76' },
  { code: '6022', name: 'Olive brun', hex: '25221B' },
  { code: '6024', name: 'Vert signalisation', hex: '308446' },
  { code: '6025', name: 'Vert fougère', hex: '3D642D' },
  { code: '6026', name: 'Vert opale', hex: '015D52' },
  { code: '6027', name: 'Vert clair', hex: '84C3BE' },
  { code: '6028', name: 'Vert pin', hex: '2C5545' },
  { code: '6029', name: 'Vert menthe', hex: '20603D' },
  { code: '6032', name: 'Vert de sécurité', hex: '317F43' },
  { code: '6033', name: 'Turquoise menthe', hex: '497E76' },
  { code: '6034', name: 'Turquoise pastel', hex: '7FB5B5' },
  { code: '7000', name: 'Gris petit-gris', hex: '78858B' },
  { code: '7001', name: 'Gris argent', hex: '8A9597' },
  { code: '7002', name: 'Gris olive', hex: '7E7B52' },
  { code: '7003', name: 'Gris mousse', hex: '6C7059' },
  { code: '7004', name: 'Gris de sécurité', hex: '969992' },
  { code: '7005', name: 'Gris souris', hex: '646B63' },
  { code: '7006', name: 'Gris beige', hex: '6D6552' },
  { code: '7008', name: 'Gris kaki', hex: '6A5F31' },
  { code: '7009', name: 'Gris vert', hex: '4D5645' },
  { code: '7010', name: 'Gris tente', hex: '4C514A' },
  { code: '7011', name: 'Gris fer', hex: '434B4D' },
  { code: '7012', name: 'Gris basalte', hex: '4E5754' },
  { code: '7013', name: 'Gris brun', hex: '464531' },
  { code: '7015', name: 'Gris ardoise', hex: '434750' },
  { code: '7016', name: 'Gris anthracite', hex: '293133' },
  { code: '7021', name: 'Gris noir', hex: '23282B' },
  { code: '7022', name: 'Gris terre d\'ombre', hex: '332F2C' },
  { code: '7023', name: 'Gris béton', hex: '686C5E' },
  { code: '7024', name: 'Gris graphite', hex: '474A51' },
  { code: '7026', name: 'Gris granit', hex: '2F353B' },
  { code: '7030', name: 'Gris pierre', hex: '8B8C7A' },
  { code: '7031', name: 'Gris bleu', hex: '474B4E' },
  { code: '7032', name: 'Gris silex', hex: 'B8B799' },
  { code: '7033', name: 'Gris ciment', hex: '7D8471' },
  { code: '7034', name: 'Gris jaune', hex: '8F8B66' },
  { code: '7035', name: 'Gris clair', hex: 'D7D7D7' },
  { code: '7036', name: 'Gris platine', hex: '7F7679' },
  { code: '7037', name: 'Gris poussière', hex: '7D7F7D' },
  { code: '7038', name: 'Gris agate', hex: 'B5B8B1' },
  { code: '7039', name: 'Gris quartz', hex: '6C6960' },
  { code: '7040', name: 'Gris fenêtre', hex: '9DA1AA' },
  { code: '7042', name: 'Gris signalisation A', hex: '8D948D' },
  { code: '7043', name: 'Gris signalisation B', hex: '4E5452' },
  { code: '7044', name: 'Gris soie', hex: 'CAC4B0' },
  { code: '7045', name: 'Télégris 1', hex: '909090' },
  { code: '7046', name: 'Télégris 2', hex: '82898F' },
  { code: '7047', name: 'Télégris 4', hex: 'D0D0D0' },
  { code: '8000', name: 'Brun vert', hex: '826C34' },
  { code: '8001', name: 'Brun ocre', hex: '955F20' },
  { code: '8002', name: 'Brun signal', hex: '6C3B2A' },
  { code: '8003', name: 'Brun argile', hex: '734222' },
  { code: '8004', name: 'Brun cuivré', hex: '8E402A' },
  { code: '8007', name: 'Brun fauve', hex: '59351F' },
  { code: '8008', name: 'Brun olive', hex: '6F4F28' },
  { code: '8011', name: 'Brun noisette', hex: '5B3A29' },
  { code: '8012', name: 'Brun rouge', hex: '592321' },
  { code: '8014', name: 'Brun sépia', hex: '382C1E' },
  { code: '8015', name: 'Brun marron', hex: '633A34' },
  { code: '8016', name: 'Brun acajou', hex: '4C2F27' },
  { code: '8017', name: 'Brun chocolat', hex: '45322E' },
  { code: '8019', name: 'Brun gris', hex: '403A3A' },
  { code: '8022', name: 'Brun noir', hex: '212121' },
  { code: '8023', name: 'Brun orangé', hex: 'A65E2E' },
  { code: '8024', name: 'Brun beige', hex: '79553D' },
  { code: '8025', name: 'Brun pâle', hex: '755C48' },
  { code: '8028', name: 'Brun terre', hex: '4E3B31' },
  { code: '9001', name: 'Blanc crème', hex: 'FDFBEF' },
  { code: '9002', name: 'Blanc gris', hex: 'E7EBDA' },
  { code: '9003', name: 'Blanc de sécurité', hex: 'F4F4F4' },
  { code: '9004', name: 'Noir de sécurité', hex: '282828' },
  { code: '9005', name: 'Noir foncé', hex: '0A0A0A' },
  { code: '9006', name: 'Aluminium blanc', hex: 'A5A5A5' },
  { code: '9007', name: 'Aluminium gris', hex: '8F8F8F' },
  { code: '9010', name: 'Blanc pur', hex: 'FFFFFF' },
  { code: '9011', name: 'Noir graphite', hex: '1C1C1C' },
  { code: '9016', name: 'Blanc signalisation', hex: 'F6F6F6' },
  { code: '9017', name: 'Noir signalisation', hex: '1E1E1E' },
  { code: '9018', name: 'Blanc papyrus', hex: 'D7D7D7' },
]

export default function RALPage() {
  const [search, setSearch] = useState('')
  const [selectedColor, setSelectedColor] = useState<typeof ralColors[0] | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const filteredColors = ralColors.filter(color => 
    color.code.includes(search) || 
    color.name.toLowerCase().includes(search.toLowerCase()) ||
    color.hex.toLowerCase().includes(search.toLowerCase())
  )

  function copyToClipboard(text: string, type: string) {
    navigator.clipboard.writeText(text)
    setCopiedCode(type)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  function toggleFavorite(code: string) {
    setFavorites(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Nuancier RAL
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {ralColors.length} couleurs RAL Classic
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par code, nom ou hex..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('grid')}
              className={`px-4 py-3 rounded-xl font-medium ${
                view === 'grid' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              Grille
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-4 py-3 rounded-xl font-medium ${
                view === 'list' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              Liste
            </button>
          </div>
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              Mes favoris
            </h2>
            <div className="flex flex-wrap gap-2">
              {favorites.map(code => {
                const color = ralColors.find(c => c.code === code)
                if (!color) return null
                return (
                  <button
                    key={code}
                    onClick={() => setSelectedColor(color)}
                    className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div 
                      className="w-6 h-6 rounded border border-gray-300"
                      style={{ backgroundColor: `#${color.hex}` }}
                    />
                    <span className="font-mono text-sm">RAL {color.code}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Color Grid */}
        {view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {filteredColors.map((color) => (
              <div
                key={color.code}
                onClick={() => setSelectedColor(color)}
                className="group cursor-pointer"
              >
                <div 
                  className="aspect-square rounded-xl shadow-sm group-hover:shadow-lg transition-all group-hover:scale-105 relative"
                  style={{ backgroundColor: `#${color.hex}` }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(color.code)
                    }}
                    className="absolute top-2 right-2 p-1 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Heart className={`w-4 h-4 ${
                      favorites.includes(color.code) ? 'text-red-500 fill-red-500' : 'text-gray-600'
                    }`} />
                  </button>
                </div>
                <div className="mt-2 text-center">
                  <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">RAL {color.code}</p>
                  <p className="text-xs text-gray-500 truncate">{color.name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Couleur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code RAL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HEX</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredColors.map((color) => (
                  <tr 
                    key={color.code} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => setSelectedColor(color)}
                  >
                    <td className="px-4 py-3">
                      <div 
                        className="w-10 h-10 rounded-lg border border-gray-200"
                        style={{ backgroundColor: `#${color.hex}` }}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                      RAL {color.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {color.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500">
                      #{color.hex}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(color.code)
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                      >
                        <Heart className={`w-5 h-5 ${
                          favorites.includes(color.code) ? 'text-red-500 fill-red-500' : 'text-gray-400'
                        }`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Color Detail Modal */}
        {selectedColor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
              {/* Color Preview */}
              <div 
                className="h-48 relative"
                style={{ backgroundColor: `#${selectedColor.hex}` }}
              >
                <button
                  onClick={() => setSelectedColor(null)}
                  className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30"
                >
                  ✕
                </button>
                <button
                  onClick={() => toggleFavorite(selectedColor.code)}
                  className="absolute top-4 left-4 p-2 bg-white/20 rounded-full hover:bg-white/30"
                >
                  <Heart className={`w-6 h-6 ${
                    favorites.includes(selectedColor.code) ? 'text-red-500 fill-red-500' : 'text-white'
                  }`} />
                </button>
              </div>

              {/* Color Info */}
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  RAL {selectedColor.code}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{selectedColor.name}</p>

                <div className="space-y-3">
                  {/* RAL Code */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">Code RAL</p>
                      <p className="font-mono font-bold text-gray-900 dark:text-white">RAL {selectedColor.code}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`RAL ${selectedColor.code}`, 'ral')}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                    >
                      {copiedCode === 'ral' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-500" />}
                    </button>
                  </div>

                  {/* HEX */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">HEX</p>
                      <p className="font-mono font-bold text-gray-900 dark:text-white">#{selectedColor.hex}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`#${selectedColor.hex}`, 'hex')}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                    >
                      {copiedCode === 'hex' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-500" />}
                    </button>
                  </div>

                  {/* RGB */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">RGB</p>
                      <p className="font-mono font-bold text-gray-900 dark:text-white">
                        {parseInt(selectedColor.hex.slice(0, 2), 16)}, {parseInt(selectedColor.hex.slice(2, 4), 16)}, {parseInt(selectedColor.hex.slice(4, 6), 16)}
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`rgb(${parseInt(selectedColor.hex.slice(0, 2), 16)}, ${parseInt(selectedColor.hex.slice(2, 4), 16)}, ${parseInt(selectedColor.hex.slice(4, 6), 16)})`, 'rgb')}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                    >
                      {copiedCode === 'rgb' ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-500" />}
                    </button>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Les couleurs affichées peuvent varier selon votre écran. 
                      Référez-vous toujours à un nuancier physique RAL officiel.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
