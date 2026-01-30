'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Gift, Users, Copy, Check, Share2, Mail, MessageCircle } from 'lucide-react'

export default function ParrainagePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referrals, setReferrals] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, converted: 0, pending: 0, earned: 0 })

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

    // Generate referral code from user ID
    const code = `TG-${user.id.substring(0, 8).toUpperCase()}`
    setReferralCode(code)

    // Mock referral data - in production, this would come from a referrals table
    setReferrals([
      { id: 1, email: 'jean.dupont@example.com', status: 'converted', date: '2026-01-10', reward: 1 },
      { id: 2, email: 'marie.martin@example.com', status: 'pending', date: '2026-01-18', reward: 0 },
    ])

    setStats({
      total: 2,
      converted: 1,
      pending: 1,
      earned: 1, // 1 mois gratuit gagné
    })

    setLoading(false)
  }

  function copyToClipboard() {
    const referralUrl = `https://thermogestion.vercel.app/auth/inscription?ref=${referralCode}`
    navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareVia(method: string) {
    const referralUrl = `https://thermogestion.vercel.app/auth/inscription?ref=${referralCode}`
    const message = `Je te recommande ThermoGestion pour gérer ton atelier de thermolaquage ! Inscris-toi avec mon lien et on gagne tous les deux 1 mois gratuit : ${referralUrl}`
    
    switch (method) {
      case 'email':
        window.open(`mailto:?subject=Découvre ThermoGestion&body=${encodeURIComponent(message)}`)
        break
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`)
        break
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`)
        break
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
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            Programme de Parrainage
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Parrainez vos confrères et gagnez des mois gratuits !
          </p>
        </div>

        {/* How it works */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-orange-600">1</span>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">Partagez votre lien</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Envoyez votre lien de parrainage à vos confrères thermolaqueurs
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-orange-600">2</span>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">Ils s'inscrivent</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Votre filleul crée son compte et souscrit à un abonnement
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-orange-600">3</span>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">Vous gagnez tous les deux</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                1 mois gratuit pour vous ET pour votre filleul !
              </p>
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-6 mb-8 text-white">
          <h2 className="text-xl font-bold mb-4">Votre lien de parrainage</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={`https://thermogestion.vercel.app/auth/inscription?ref=${referralCode}`}
              readOnly
              className="flex-1 px-4 py-3 bg-white/20 rounded-lg text-white placeholder-white/70 focus:outline-none"
            />
            <button
              onClick={copyToClipboard}
              className="px-6 py-3 bg-white text-orange-600 font-bold rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
          <p className="mt-3 text-sm opacity-90">
            Code parrain : <strong>{referralCode}</strong>
          </p>
        </div>

        {/* Share buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Partager rapidement
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => shareVia('email')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Mail className="w-5 h-5" />
              Email
            </button>
            <button
              onClick={() => shareVia('whatsapp')}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </button>
            <button
              onClick={() => shareVia('linkedin')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Share2 className="w-5 h-5" />
              LinkedIn
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
            <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.total}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Invitations envoyées</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
            <p className="text-3xl font-black text-green-600">{stats.converted}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Filleuls inscrits</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
            <p className="text-3xl font-black text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">En attente</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
            <p className="text-3xl font-black text-orange-500">{stats.earned}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Mois gagnés</p>
          </div>
        </div>

        {/* Referral History */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Historique des parrainages
          </h2>
          {referrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Aucun parrainage pour le moment. Partagez votre lien !
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-lg">{referral.email.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{referral.email}</p>
                      <p className="text-sm text-gray-500">{referral.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      referral.status === 'converted'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    }`}>
                      {referral.status === 'converted' ? 'Inscrit' : 'En attente'}
                    </span>
                    {referral.reward > 0 && (
                      <p className="text-sm text-green-600 mt-1">+{referral.reward} mois gratuit</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Terms */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium mb-2">Conditions du programme :</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Le mois gratuit est crédité après le premier paiement du filleul</li>
            <li>Pas de limite de parrainages</li>
            <li>Les mois gratuits sont cumulables</li>
            <li>Offre non applicable aux comptes déjà existants</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
