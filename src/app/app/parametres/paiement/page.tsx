'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { SettingsNav } from '@/components/settings/SettingsNav'

export default function PaiementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [showAddCard, setShowAddCard] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createBrowserClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (userData?.atelier_id) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('atelier_id', userData.atelier_id)
        .single()
      
      setSubscription(sub)
    }

    // Mock payment methods - in real app, these would come from Stripe
    setPaymentMethods([
      // Empty for now - user would add cards
    ])
    
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gérez vos moyens de paiement pour l'abonnement
          </p>
        </div>

        <SettingsNav />

        {/* Current Plan */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Votre abonnement
          </h2>
          
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-lg">
                {subscription?.plan === 'trial' ? 'Essai gratuit' : subscription?.plan === 'pro' ? 'Plan Pro' : 'Plan Atelier'}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {subscription?.plan === 'trial' 
                  ? 'Essai gratuit - aucun paiement requis' 
                  : `${subscription?.price_monthly || 0} € / mois`
                }
              </p>
            </div>
            <button className="px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors">
              Modifier le plan
            </button>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Moyens de paiement
            </h2>
            <button 
              onClick={() => setShowAddCard(true)}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              + Ajouter une carte
            </button>
          </div>

          {paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                      VISA
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        •••• •••• •••• {method.last4}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Expire {method.expMonth}/{method.expYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {method.isDefault && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs rounded-full">
                        Par défaut
                      </span>
                    )}
                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💳</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Aucun moyen de paiement enregistré
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {subscription?.plan === 'trial' 
                  ? 'Vous êtes en essai gratuit. Ajoutez une carte pour continuer après la période d\'essai.'
                  : 'Ajoutez une carte bancaire pour payer votre abonnement.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Add Card Modal */}
        {showAddCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Ajouter une carte
                </h3>
                <button 
                  onClick={() => setShowAddCard(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Numéro de carte
                  </label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date d'expiration
                    </label>
                    <input
                      type="text"
                      placeholder="MM/AA"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      CVC
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nom sur la carte
                  </label>
                  <input
                    type="text"
                    placeholder="JEAN DUPONT"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddCard(false)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
                  >
                    Ajouter la carte
                  </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  🔒 Paiement sécurisé par Stripe. Vos données sont cryptées.
                </p>
              </form>
            </div>
          </div>
        )}

        {/* Billing History Link */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Historique de facturation
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Consultez vos factures d'abonnement ThermoGestion
          </p>
          <a 
            href="/app/parametres/abonnement"
            className="inline-flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium hover:underline"
          >
            Voir les factures
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
