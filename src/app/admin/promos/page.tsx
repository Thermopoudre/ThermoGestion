'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Ticket, Plus, Trash2, Copy, Check, Calendar, Users, Percent } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PromoCode {
  id: string
  code: string
  discount_type: 'percent' | 'fixed' | 'months'
  discount_value: number
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_until: string | null
  active: boolean
  description: string
}

export default function PromosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  
  // Form state
  const [newCode, setNewCode] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed' | 'months'>('percent')
  const [discountValue, setDiscountValue] = useState(10)
  const [maxUses, setMaxUses] = useState<number | ''>('')
  const [validUntil, setValidUntil] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    // In production, check if user is super admin
    // Mock data for now
    setPromoCodes([
      {
        id: '1',
        code: 'BIENVENUE2026',
        discount_type: 'percent',
        discount_value: 20,
        max_uses: 100,
        current_uses: 45,
        valid_from: '2026-01-01',
        valid_until: '2026-03-31',
        active: true,
        description: 'Offre de lancement 2026'
      },
      {
        id: '2',
        code: 'SALON-PARIS',
        discount_type: 'months',
        discount_value: 1,
        max_uses: 50,
        current_uses: 12,
        valid_from: '2026-01-15',
        valid_until: '2026-02-15',
        active: true,
        description: 'Salon Industrie Paris'
      },
      {
        id: '3',
        code: 'PARTENAIRE30',
        discount_type: 'percent',
        discount_value: 30,
        max_uses: null,
        current_uses: 8,
        valid_from: '2025-12-01',
        valid_until: null,
        active: true,
        description: 'Partenaires officiels'
      },
    ])
    setLoading(false)
  }

  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = 'TG-'
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewCode(code)
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  async function createPromo(e: React.FormEvent) {
    e.preventDefault()
    // In production, this would save to database
    const newPromo: PromoCode = {
      id: Date.now().toString(),
      code: newCode,
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses === '' ? null : maxUses,
      current_uses: 0,
      valid_from: new Date().toISOString(),
      valid_until: validUntil || null,
      active: true,
      description: description,
    }
    setPromoCodes([newPromo, ...promoCodes])
    setShowCreate(false)
    setNewCode('')
    setDescription('')
  }

  function toggleActive(id: string) {
    setPromoCodes(promoCodes.map(p => 
      p.id === id ? { ...p, active: !p.active } : p
    ))
  }

  function deletePromo(id: string) {
    if (confirm('Supprimer ce code promo ?')) {
      setPromoCodes(promoCodes.filter(p => p.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Codes Promo</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Gérez vos codes de réduction pour les salons et partenaires
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nouveau code
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Ticket className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{promoCodes.length}</p>
                <p className="text-sm text-gray-500">Codes actifs</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {promoCodes.reduce((acc, p) => acc + p.current_uses, 0)}
                </p>
                <p className="text-sm text-gray-500">Utilisations totales</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Percent className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(promoCodes.filter(p => p.discount_type === 'percent').reduce((acc, p) => acc + p.discount_value, 0) / promoCodes.filter(p => p.discount_type === 'percent').length || 0)}%
                </p>
                <p className="text-sm text-gray-500">Réduction moyenne</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {promoCodes.filter(p => p.valid_until && new Date(p.valid_until) > new Date()).length}
                </p>
                <p className="text-sm text-gray-500">Expirent bientôt</p>
              </div>
            </div>
          </div>
        </div>

        {/* Promo Codes List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Réduction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Utilisations</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Validité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {promoCodes.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">{promo.code}</span>
                        <button
                          onClick={() => copyCode(promo.code)}
                          className="p-1 text-gray-400 hover:text-orange-500"
                        >
                          {copied === promo.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-sm text-gray-500">{promo.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {promo.discount_type === 'percent' && `${promo.discount_value}%`}
                        {promo.discount_type === 'fixed' && `${promo.discount_value}€`}
                        {promo.discount_type === 'months' && `${promo.discount_value} mois`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 dark:text-white">{promo.current_uses}</span>
                        {promo.max_uses && (
                          <span className="text-gray-500">/ {promo.max_uses}</span>
                        )}
                      </div>
                      {promo.max_uses && (
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                          <div 
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${Math.min((promo.current_uses / promo.max_uses) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {promo.valid_until ? (
                        <>Jusqu'au {format(new Date(promo.valid_until), 'dd MMM yyyy', { locale: fr })}</>
                      ) : (
                        <span className="text-green-600">Illimité</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(promo.id)}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          promo.active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {promo.active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => deletePromo(promo.id)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Nouveau code promo
              </h2>
              <form onSubmit={createPromo} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      placeholder="MONCODE2026"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateCode}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200"
                    >
                      Générer
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type de réduction
                    </label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="percent">Pourcentage</option>
                      <option value="fixed">Montant fixe</option>
                      <option value="months">Mois gratuits</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Valeur
                    </label>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Utilisations max
                    </label>
                    <input
                      type="number"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Illimité"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date d'expiration
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Salon Industrie Lyon"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400"
                  >
                    Créer le code
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
