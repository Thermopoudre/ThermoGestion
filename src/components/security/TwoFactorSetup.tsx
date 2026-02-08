'use client'

import { useState, useEffect } from 'react'
import { Shield, ShieldCheck, ShieldOff, Copy, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface TwoFactorSetupProps {
  initialEnabled: boolean
}

type Step = 'idle' | 'qrcode' | 'verify' | 'backup' | 'disable'

export function TwoFactorSetup({ initialEnabled }: TwoFactorSetupProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [step, setStep] = useState<Step>('idle')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedBackup, setCopiedBackup] = useState(false)

  // Initier la configuration 2FA
  async function handleSetup() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur')
        return
      }

      setOtpauthUri(data.otpauthUri)
      // Extraire le secret depuis l'URI otpauth pour affichage manuel
      // Format: otpauth://totp/...?secret=XXXX&issuer=...
      const secretMatch = data.otpauthUri?.match(/secret=([A-Z2-7]+)/i)
      setSecret(secretMatch ? secretMatch[1] : '')
      setStep('qrcode')
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  // Vérifier le code TOTP
  async function handleVerify() {
    if (code.length !== 6) {
      setError('Entrez les 6 chiffres')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action: 'setup' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Code incorrect')
        return
      }

      if (data.backupCodes) {
        setBackupCodes(data.backupCodes)
        setStep('backup')
      }

      setEnabled(true)
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  // Désactiver la 2FA
  async function handleDisable() {
    if (code.length !== 6) {
      setError('Entrez les 6 chiffres de votre application')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur')
        return
      }

      setEnabled(false)
      setStep('idle')
      setCode('')
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopiedBackup(true)
    setTimeout(() => setCopiedBackup(false), 2000)
  }

  // État initial : idle
  if (step === 'idle') {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {enabled ? (
              <ShieldCheck className="w-6 h-6 text-green-500" />
            ) : (
              <Shield className="w-6 h-6 text-gray-400" />
            )}
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Authentification à deux facteurs (2FA)
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {enabled
                  ? 'Protégé par application TOTP (Google Authenticator, Authy, etc.)'
                  : 'Ajouter une couche de sécurité supplémentaire à votre compte'}
              </p>
            </div>
          </div>

          {enabled ? (
            <button
              onClick={() => { setStep('disable'); setCode(''); setError('') }}
              className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              Désactiver
            </button>
          ) : (
            <button
              onClick={handleSetup}
              disabled={loading}
              className="px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activer la 2FA'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Étape 1 : QR Code
  if (step === 'qrcode') {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Configuration 2FA — Étape 1/2
          </h3>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Scannez ce QR Code avec votre application d&apos;authentification
          (Google Authenticator, Authy, 1Password, etc.)
        </p>

        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <QRCodeSVG value={otpauthUri} size={200} level="M" />
          </div>

          <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Impossible de scanner ? Entrez ce code manuellement :
            </p>
            <div className="flex items-center gap-2 mb-4">
              <code className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono break-all">
                {secret}
              </code>
              <button onClick={copySecret} className="p-2 text-gray-400 hover:text-gray-600">
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => { setStep('verify'); setCode(''); setError('') }}
              className="px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              Suivant
            </button>

            <button
              onClick={() => setStep('idle')}
              className="ml-3 px-6 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Étape 2 : Vérification
  if (step === 'verify') {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Configuration 2FA — Étape 2/2
          </h3>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Entrez le code à 6 chiffres affiché par votre application pour confirmer la configuration.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-40 px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            autoFocus
          />
          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vérifier'}
          </button>
        </div>

        <button
          onClick={() => setStep('qrcode')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Retour au QR Code
        </button>
      </div>
    )
  }

  // Étape 3 : Codes de secours
  if (step === 'backup') {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-6 h-6 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            2FA activée avec succès !
          </h3>
        </div>

        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                Sauvegardez vos codes de secours
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Ces codes vous permettent d&apos;accéder à votre compte si vous perdez votre téléphone.
                Chaque code ne peut être utilisé qu&apos;une seule fois.
                <strong> Ils ne seront plus jamais affichés.</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {backupCodes.map((bc, i) => (
            <code
              key={i}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-center font-mono text-sm"
            >
              {bc}
            </code>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyBackupCodes}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            {copiedBackup ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copiedBackup ? 'Copié !' : 'Copier les codes'}
          </button>

          <button
            onClick={() => setStep('idle')}
            className="px-6 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            J&apos;ai sauvegardé mes codes
          </button>
        </div>
      </div>
    )
  }

  // Désactivation
  if (step === 'disable') {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <ShieldOff className="w-6 h-6 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Désactiver la 2FA
          </h3>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Pour confirmer la désactivation, entrez le code à 6 chiffres de votre application.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-40 px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            autoFocus
          />
          <button
            onClick={handleDisable}
            disabled={loading || code.length !== 6}
            className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Désactiver'}
          </button>
        </div>

        <button
          onClick={() => { setStep('idle'); setCode(''); setError('') }}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Annuler
        </button>
      </div>
    )
  }

  return null
}
