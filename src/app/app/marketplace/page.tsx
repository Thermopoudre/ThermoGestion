'use client'

import { useState } from 'react'
import { 
  ShoppingBag, Search, Filter, Star, Truck,
  Package, Plus, Heart, ExternalLink, MapPin
} from 'lucide-react'

interface Poudre {
  id: string
  nom: string
  fabricant: string
  code_ral: string | null
  finition: string
  prix_kg: number
  stock_fournisseur: 'disponible' | 'limité' | 'sur_commande'
  delai_livraison: string
  certifications: string[]
  note: number
  image_url: string | null
}

// Catalogue de démonstration
const CATALOGUE: Poudre[] = [
  {
    id: '1', nom: 'Epoxy-Polyester Standard', fabricant: 'AkzoNobel (Interpon)', code_ral: null,
    finition: 'Brillant', prix_kg: 12.50, stock_fournisseur: 'disponible',
    delai_livraison: '2-3 jours', certifications: ['QUALICOAT'], note: 4.5, image_url: null
  },
  {
    id: '2', nom: 'Polyester Superdurable', fabricant: 'Tiger Coatings', code_ral: null,
    finition: 'Mat', prix_kg: 18.90, stock_fournisseur: 'disponible',
    delai_livraison: '3-5 jours', certifications: ['QUALICOAT', 'GSB'], note: 4.8, image_url: null
  },
  {
    id: '3', nom: 'Polyester Texturé', fabricant: 'Jotun Powder Coatings', code_ral: null,
    finition: 'Texturé', prix_kg: 16.50, stock_fournisseur: 'limité',
    delai_livraison: '5-7 jours', certifications: ['QUALICOAT'], note: 4.2, image_url: null
  },
  {
    id: '4', nom: 'Métallisé Premium', fabricant: 'Axalta (Alesta)', code_ral: null,
    finition: 'Métallisé', prix_kg: 24.90, stock_fournisseur: 'disponible',
    delai_livraison: '2-3 jours', certifications: ['QUALICOAT', 'QUALIMARINE'], note: 4.9, image_url: null
  },
  {
    id: '5', nom: 'Epoxy Anti-corrosion', fabricant: 'Sherwin-Williams (Powdura)', code_ral: null,
    finition: 'Satin', prix_kg: 21.00, stock_fournisseur: 'sur_commande',
    delai_livraison: '10-15 jours', certifications: ['QUALIMARINE'], note: 4.6, image_url: null
  },
  {
    id: '6', nom: 'Polyuréthane Extérieur', fabricant: 'PPG (Envirocron)', code_ral: null,
    finition: 'Brillant', prix_kg: 22.50, stock_fournisseur: 'disponible',
    delai_livraison: '3-5 jours', certifications: ['QUALICOAT', 'GSB', 'QUALIMARINE'], note: 4.7, image_url: null
  },
]

export default function MarketplacePage() {
  const [search, setSearch] = useState('')
  const [filterFinition, setFilterFinition] = useState<string>('all')
  const [filterStock, setFilterStock] = useState<string>('all')
  const [favorites, setFavorites] = useState<string[]>([])
  const [cart, setCart] = useState<{ poudreId: string; qty: number; ral: string }[]>([])

  const filtered = CATALOGUE.filter(p => {
    if (search) {
      const s = search.toLowerCase()
      if (!p.nom.toLowerCase().includes(s) && !p.fabricant.toLowerCase().includes(s)) return false
    }
    if (filterFinition !== 'all' && p.finition.toLowerCase() !== filterFinition) return false
    if (filterStock !== 'all' && p.stock_fournisseur !== filterStock) return false
    return true
  })

  const stockConfig: Record<string, { label: string; color: string }> = {
    disponible: { label: 'En stock', color: 'bg-green-100 text-green-700' },
    limité: { label: 'Stock limité', color: 'bg-orange-100 text-orange-700' },
    sur_commande: { label: 'Sur commande', color: 'bg-gray-100 text-gray-500' },
  }

  function addToCart(poudreId: string) {
    const existing = cart.find(c => c.poudreId === poudreId)
    if (existing) {
      setCart(cart.map(c => c.poudreId === poudreId ? { ...c, qty: c.qty + 25 } : c))
    } else {
      setCart([...cart, { poudreId, qty: 25, ral: '' }])
    }
  }

  const cartTotal = cart.reduce((acc, item) => {
    const poudre = CATALOGUE.find(p => p.id === item.poudreId)
    return acc + (poudre?.prix_kg || 0) * item.qty
  }, 0)

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-orange-500" />
            Marketplace Poudres
          </h1>
          <p className="text-gray-500 mt-1">Commandez vos poudres directement auprès des fabricants</p>
        </div>
        {cart.length > 0 && (
          <button className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 flex items-center gap-2 relative">
            <ShoppingBag className="w-5 h-5" />
            Panier ({cart.reduce((acc, c) => acc + c.qty, 0)} kg)
            <span className="text-sm">{cartTotal.toFixed(0)} EUR</span>
          </button>
        )}
      </div>

      {/* Recherche + Filtres */}
      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, fabricant..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <select
          value={filterFinition}
          onChange={(e) => setFilterFinition(e.target.value)}
          className="px-3 py-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="all">Toutes finitions</option>
          <option value="brillant">Brillant</option>
          <option value="mat">Mat</option>
          <option value="satin">Satin</option>
          <option value="texturé">Texturé</option>
          <option value="métallisé">Métallisé</option>
        </select>
        <select
          value={filterStock}
          onChange={(e) => setFilterStock(e.target.value)}
          className="px-3 py-2.5 border rounded-xl dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="all">Tous stocks</option>
          <option value="disponible">En stock</option>
          <option value="limité">Stock limité</option>
          <option value="sur_commande">Sur commande</option>
        </select>
      </div>

      {/* Grille produits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(poudre => (
          <div key={poudre.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            {/* Image placeholder */}
            <div className="h-32 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 flex items-center justify-center relative">
              <Package className="w-12 h-12 text-orange-500 opacity-50" />
              <button
                onClick={() => {
                  if (favorites.includes(poudre.id)) {
                    setFavorites(favorites.filter(f => f !== poudre.id))
                  } else {
                    setFavorites([...favorites, poudre.id])
                  }
                }}
                className="absolute top-3 right-3 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full hover:bg-white"
              >
                <Heart className={`w-4 h-4 ${favorites.includes(poudre.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
              </button>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockConfig[poudre.stock_fournisseur]?.color}`}>
                  {stockConfig[poudre.stock_fournisseur]?.label}
                </span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{poudre.note}</span>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white">{poudre.nom}</h3>
              <p className="text-sm text-gray-500 mb-2">{poudre.fabricant}</p>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{poudre.finition}</span>
                {poudre.certifications.map(cert => (
                  <span key={cert} className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs">
                    {cert}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <Truck className="w-3 h-3" />
                  {poudre.delai_livraison}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black text-orange-600">{poudre.prix_kg.toFixed(2)} EUR</p>
                  <p className="text-xs text-gray-500">/kg - min 25 kg</p>
                </div>
                <button
                  onClick={() => addToCart(poudre.id)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  25 kg
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow">
          <ShoppingBag className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucun produit trouvé</h2>
          <p className="text-gray-500">Essayez de modifier vos filtres de recherche</p>
        </div>
      )}

      {/* Info livraison */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <Truck className="w-6 h-6 text-blue-600" />
          <h3 className="font-bold text-blue-900 dark:text-blue-200">Livraison & conditions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800 dark:text-blue-300">
          <div>
            <p className="font-medium">Livraison France métropolitaine</p>
            <p className="text-blue-600">Gratuite dès 100 kg commandés</p>
          </div>
          <div>
            <p className="font-medium">Minimum de commande</p>
            <p className="text-blue-600">25 kg par référence</p>
          </div>
          <div>
            <p className="font-medium">Paiement</p>
            <p className="text-blue-600">30 jours fin de mois, SEPA ou CB</p>
          </div>
        </div>
      </div>
    </div>
  )
}
