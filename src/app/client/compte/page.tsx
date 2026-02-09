'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { User, Mail, Phone, MapPin, Lock, Bell, Trash2 } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'

export default function ClientComptePage() {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [clientData, setClientData] = useState<any>(null)
  const [clientUser, setClientUser] = useState<any>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  
  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  
  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // Notifications (persistées en DB)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(false)
  const [projectUpdates, setProjectUpdates] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/client/auth/login')
      return
    }
    setAuthUserId(user.id)

    const { data: clientUserData, error } = await supabase
      .from('client_users')
      .select('client_id, atelier_id, notify_email, notify_sms, notify_project_updates')
      .eq('id', user.id)
      .single()

    if (error || !clientUserData) {
      router.push('/client/auth/login')
      return
    }

    setClientUser(clientUserData)
    
    // Charger les préférences de notification depuis la DB
    setEmailNotifications(clientUserData.notify_email ?? true)
    setSmsNotifications(clientUserData.notify_sms ?? false)
    setProjectUpdates(clientUserData.notify_project_updates ?? true)

    // Get client info
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientUserData.client_id)
      .single()

    if (client) {
      setClientData(client)
      setFullName(client.full_name || '')
      setEmail(client.email || '')
      setPhone(client.phone || '')
      setAddress(client.address || '')
      setCity(client.city || '')
      setPostalCode(client.postal_code || '')
    }

    setLoading(false)
  }

  async function handleSaveNotifications() {
    if (!authUserId) return
    setSavingNotifs(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('client_users')
        .update({
          notify_email: emailNotifications,
          notify_sms: smsNotifications,
          notify_project_updates: projectUpdates,
        })
        .eq('id', authUserId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Préférences de notification enregistrées !' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }

    setSavingNotifs(false)
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          full_name: fullName,
          phone: phone,
          address: address,
          city: city,
          postal_code: postalCode,
        })
        .eq('id', clientUser.client_id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }

    setSaving(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
      setSaving(false)
      return
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères' })
      setSaving(false)
      return
    }

    const supabase = createBrowserClient()

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setNewPassword('')
      setConfirmPassword('')
      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès !' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: 'Mon compte' }]} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mon Compte</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gérez vos informations personnelles
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Informations personnelles
          </h2>
        </div>
        
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nom complet
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Adresse
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ville
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Code postal
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Notifications
          </h2>
        </div>
        
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Mises à jour des projets</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recevoir une notification à chaque changement de statut</p>
            </div>
            <input
              type="checkbox"
              checked={projectUpdates}
              onChange={(e) => setProjectUpdates(e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Notifications par email</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recevoir les notifications par email</p>
            </div>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Notifications SMS</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recevoir les alertes importantes par SMS</p>
            </div>
            <input
              type="checkbox"
              checked={smsNotifications}
              onChange={(e) => setSmsNotifications(e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleSaveNotifications}
          disabled={savingNotifs}
          className="mt-4 px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {savingNotifs ? 'Enregistrement...' : 'Enregistrer les préférences'}
        </button>
      </div>

      {/* Password */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Sécurité
          </h2>
        </div>
        
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !newPassword}
            className="px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-6 h-6 text-red-600" />
          <h2 className="text-xl font-bold text-red-800 dark:text-red-300">
            Zone de danger
          </h2>
        </div>
        
        <p className="text-red-700 dark:text-red-400 mb-4">
          La suppression de votre compte est irréversible. Contactez votre atelier si vous souhaitez fermer votre compte.
        </p>
        
        <button className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors">
          Demander la suppression
        </button>
      </div>
    </div>
  )
}
