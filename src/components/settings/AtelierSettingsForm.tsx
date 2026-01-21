'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

interface DevisSettings {
  taux_mo_heure: number
  temps_mo_m2: number
  cout_consommables_m2: number
  marge_poudre_pct: number
  marge_mo_pct: number
  tva_rate: number
}

interface RelanceSettings {
  actif: boolean
  delai_premiere_relance_jours: number
  delai_entre_relances_jours: number
  max_relances: number
}

interface AtelierSettingsFormProps {
  atelier: {
    id: string
    name: string
    address?: string | null
    phone?: string | null
    email?: string | null
    siret?: string | null
    tva_intra?: string | null
    rcs?: string | null
    forme_juridique?: string | null
    capital_social?: string | null
    iban?: string | null
    bic?: string | null
    settings?: {
      devis?: DevisSettings
      devis_relance?: RelanceSettings
    } | null
  }
}

export function AtelierSettingsForm({ atelier }: AtelierSettingsFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Paramètres par défaut pour les devis
  const defaultDevisSettings: DevisSettings = {
    taux_mo_heure: 35,
    temps_mo_m2: 0.15,
    cout_consommables_m2: 2,
    marge_poudre_pct: 30,
    marge_mo_pct: 50,
    tva_rate: 20,
  }

  const [formData, setFormData] = useState({
    name: atelier.name || '',
    address: atelier.address || '',
    phone: atelier.phone || '',
    email: atelier.email || '',
    siret: atelier.siret || '',
    tva_intra: atelier.tva_intra || '',
    rcs: atelier.rcs || '',
    forme_juridique: atelier.forme_juridique || '',
    capital_social: atelier.capital_social || '',
    iban: atelier.iban || '',
    bic: atelier.bic || '',
  })

  const [devisSettings, setDevisSettings] = useState<DevisSettings>({
    ...defaultDevisSettings,
    ...(atelier.settings?.devis || {}),
  })

  // Paramètres de relance devis
  const defaultRelanceSettings: RelanceSettings = {
    actif: true,
    delai_premiere_relance_jours: 7,
    delai_entre_relances_jours: 5,
    max_relances: 3,
  }

  const [relanceSettings, setRelanceSettings] = useState<RelanceSettings>({
    ...defaultRelanceSettings,
    ...(atelier.settings?.devis_relance || {}),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: updateError } = await supabase
        .from('ateliers')
        .update({
          name: formData.name,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          siret: formData.siret || null,
          tva_intra: formData.tva_intra || null,
          rcs: formData.rcs || null,
          forme_juridique: formData.forme_juridique || null,
          capital_social: formData.capital_social || null,
          iban: formData.iban || null,
          bic: formData.bic || null,
          settings: {
            ...atelier.settings,
            devis: devisSettings,
            devis_relance: relanceSettings,
          },
        })
        .eq('id', atelier.id)

      if (updateError) throw updateError

      setSuccess(true)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  const inputClasses = "w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
  const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
  const cardClasses = "bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
  const helpTextClasses = "mt-1 text-xs text-gray-500 dark:text-gray-400"

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
          ✅ Paramètres enregistrés avec succès !
        </div>
      )}

      {/* Accès rapide aux templates */}
      <a
        href="/app/parametres/templates"
        className="block bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6 hover:shadow-lg transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-2xl shadow-lg">
              🎨
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">Templates PDF</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Personnalisez le design de vos devis et factures
              </p>
            </div>
          </div>
          <div className="text-purple-500 group-hover:translate-x-2 transition-transform">
            →
          </div>
        </div>
      </a>

      {/* Informations générales */}
      <div className={cardClasses}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          🏭 Informations générales
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className={labelClasses}>
              Nom de l'atelier *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className={inputClasses}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClasses}>
              Adresse complète
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className={inputClasses}
              placeholder="123 Rue de l'Industrie, 75001 Paris"
            />
          </div>

          <div>
            <label className={labelClasses}>
              Téléphone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={inputClasses}
              placeholder="01 23 45 67 89"
            />
          </div>

          <div>
            <label className={labelClasses}>
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClasses}
              placeholder="contact@atelier.fr"
            />
          </div>
        </div>
      </div>

      {/* Informations légales */}
      <div className={cardClasses}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          📋 Informations légales
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Ces informations apparaîtront sur vos factures. Obligatoires pour la conformité française.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelClasses}>
              SIRET <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.siret}
              onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
              className={inputClasses}
              placeholder="123 456 789 00012"
            />
            <p className={helpTextClasses}>14 chiffres</p>
          </div>

          <div>
            <label className={labelClasses}>
              N° TVA Intracommunautaire
            </label>
            <input
              type="text"
              value={formData.tva_intra}
              onChange={(e) => setFormData({ ...formData, tva_intra: e.target.value })}
              className={inputClasses}
              placeholder="FR 12 345678901"
            />
            <p className={helpTextClasses}>Obligatoire si assujetti à la TVA</p>
          </div>

          <div>
            <label className={labelClasses}>
              Forme juridique
            </label>
            <select
              value={formData.forme_juridique}
              onChange={(e) => setFormData({ ...formData, forme_juridique: e.target.value })}
              className={inputClasses}
            >
              <option value="">Sélectionner...</option>
              <option value="Auto-entrepreneur">Auto-entrepreneur / Micro-entreprise</option>
              <option value="EI">Entreprise Individuelle (EI)</option>
              <option value="EIRL">EIRL</option>
              <option value="EURL">EURL</option>
              <option value="SARL">SARL</option>
              <option value="SAS">SAS</option>
              <option value="SASU">SASU</option>
              <option value="SA">SA</option>
              <option value="SNC">SNC</option>
              <option value="SCI">SCI</option>
            </select>
          </div>

          <div>
            <label className={labelClasses}>
              Capital social
            </label>
            <input
              type="text"
              value={formData.capital_social}
              onChange={(e) => setFormData({ ...formData, capital_social: e.target.value })}
              className={inputClasses}
              placeholder="10 000 €"
            />
            <p className={helpTextClasses}>Obligatoire pour les sociétés</p>
          </div>

          <div className="md:col-span-2">
            <label className={labelClasses}>
              RCS (Registre du Commerce et des Sociétés)
            </label>
            <input
              type="text"
              value={formData.rcs}
              onChange={(e) => setFormData({ ...formData, rcs: e.target.value })}
              className={inputClasses}
              placeholder="RCS Paris B 123 456 789"
            />
            <p className={helpTextClasses}>Ville + numéro d'immatriculation</p>
          </div>
        </div>
      </div>

      {/* Informations bancaires */}
      <div className={cardClasses}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          🏦 Informations bancaires
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Pour le paiement par virement (apparaît sur les factures)
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className={labelClasses}>
              IBAN
            </label>
            <input
              type="text"
              value={formData.iban}
              onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
              className={`${inputClasses} font-mono`}
              placeholder="FR76 1234 5678 9012 3456 7890 123"
            />
          </div>

          <div>
            <label className={labelClasses}>
              Code BIC / SWIFT
            </label>
            <input
              type="text"
              value={formData.bic}
              onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
              className={`${inputClasses} font-mono`}
              placeholder="BNPAFRPP"
            />
          </div>
        </div>
      </div>

      {/* Paramètres de calcul des devis */}
      <div className={cardClasses}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          📊 Paramètres de calcul des devis
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Ces paramètres sont utilisés automatiquement pour calculer vos devis. Ils ne peuvent pas être modifiés lors de la création d'un devis.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Section Main d'œuvre */}
          <div className="md:col-span-3">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              👷 Main d'œuvre
            </h3>
          </div>
          
          <div>
            <label className={labelClasses}>
              Taux horaire MO (€/h) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={devisSettings.taux_mo_heure}
              onChange={(e) => setDevisSettings({ ...devisSettings, taux_mo_heure: parseFloat(e.target.value) || 0 })}
              required
              className={`${inputClasses} border-blue-300 bg-blue-50 dark:bg-blue-900/20`}
            />
            <p className={helpTextClasses}>Coût horaire de la main d'œuvre</p>
          </div>

          <div>
            <label className={labelClasses}>
              Temps MO par m² (h/m²)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={devisSettings.temps_mo_m2}
              onChange={(e) => setDevisSettings({ ...devisSettings, temps_mo_m2: parseFloat(e.target.value) || 0 })}
              className={inputClasses}
            />
            <p className={helpTextClasses}>Temps moyen pour traiter 1m²</p>
          </div>

          <div>
            <label className={labelClasses}>
              Marge MO (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="200"
              value={devisSettings.marge_mo_pct}
              onChange={(e) => setDevisSettings({ ...devisSettings, marge_mo_pct: parseFloat(e.target.value) || 0 })}
              className={`${inputClasses} border-green-300 bg-green-50 dark:bg-green-900/20`}
            />
            <p className={helpTextClasses}>Marge appliquée sur la MO</p>
          </div>

          {/* Section Poudre */}
          <div className="md:col-span-3 mt-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              🎨 Poudre
            </h3>
          </div>

          <div>
            <label className={labelClasses}>
              Marge poudre (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="200"
              value={devisSettings.marge_poudre_pct}
              onChange={(e) => setDevisSettings({ ...devisSettings, marge_poudre_pct: parseFloat(e.target.value) || 0 })}
              className={`${inputClasses} border-green-300 bg-green-50 dark:bg-green-900/20`}
            />
            <p className={helpTextClasses}>Marge appliquée sur la poudre</p>
          </div>

          <div>
            <label className={labelClasses}>
              Consommables (€/m²)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={devisSettings.cout_consommables_m2}
              onChange={(e) => setDevisSettings({ ...devisSettings, cout_consommables_m2: parseFloat(e.target.value) || 0 })}
              className={inputClasses}
            />
            <p className={helpTextClasses}>Coût des consommables par m²</p>
          </div>

          <div>
            <label className={labelClasses}>
              TVA par défaut (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="30"
              value={devisSettings.tva_rate}
              onChange={(e) => setDevisSettings({ ...devisSettings, tva_rate: parseFloat(e.target.value) || 0 })}
              className={inputClasses}
            />
            <p className={helpTextClasses}>Taux de TVA appliqué</p>
          </div>
        </div>

        {/* Aperçu calcul */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">💡 Exemple de calcul pour 1m²</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">MO brute:</span>
              <p className="font-bold">{(devisSettings.taux_mo_heure * devisSettings.temps_mo_m2).toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">MO + marge:</span>
              <p className="font-bold text-blue-600">{(devisSettings.taux_mo_heure * devisSettings.temps_mo_m2 * (1 + devisSettings.marge_mo_pct / 100)).toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Consommables:</span>
              <p className="font-bold">{devisSettings.cout_consommables_m2.toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Total HT/m² (hors poudre):</span>
              <p className="font-bold text-orange-600">
                {(
                  devisSettings.taux_mo_heure * devisSettings.temps_mo_m2 * (1 + devisSettings.marge_mo_pct / 100) +
                  devisSettings.cout_consommables_m2
                ).toFixed(2)} €
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Paramètres de relance automatique */}
      <div className={cardClasses}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          📬 Relances automatiques devis
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Recevez des rappels pour relancer les clients qui n'ont pas signé leurs devis.
        </p>
        
        <div className="mb-4">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={relanceSettings.actif}
              onChange={(e) => setRelanceSettings({ ...relanceSettings, actif: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300">Activer les relances automatiques</span>
          </label>
        </div>
        
        {relanceSettings.actif && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClasses}>
                Première relance après (jours)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="30"
                value={relanceSettings.delai_premiere_relance_jours}
                onChange={(e) => setRelanceSettings({ ...relanceSettings, delai_premiere_relance_jours: parseInt(e.target.value) || 7 })}
                className={inputClasses}
              />
              <p className={helpTextClasses}>Jours après l'envoi du devis</p>
            </div>

            <div>
              <label className={labelClasses}>
                Entre chaque relance (jours)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="30"
                value={relanceSettings.delai_entre_relances_jours}
                onChange={(e) => setRelanceSettings({ ...relanceSettings, delai_entre_relances_jours: parseInt(e.target.value) || 5 })}
                className={inputClasses}
              />
              <p className={helpTextClasses}>Délai entre les relances</p>
            </div>

            <div>
              <label className={labelClasses}>
                Nombre max de relances
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="10"
                value={relanceSettings.max_relances}
                onChange={(e) => setRelanceSettings({ ...relanceSettings, max_relances: parseInt(e.target.value) || 3 })}
                className={inputClasses}
              />
              <p className={helpTextClasses}>Arrêter après X relances</p>
            </div>
          </div>
        )}
        
        {relanceSettings.actif && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
            <strong>Exemple :</strong> Avec ces paramètres, un devis envoyé le 1er janvier recevra une notification de relance le {relanceSettings.delai_premiere_relance_jours} janvier, puis le {relanceSettings.delai_premiere_relance_jours + relanceSettings.delai_entre_relances_jours} janvier, etc.
          </div>
        )}
      </div>

      {/* Bouton de soumission */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-8 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enregistrement...' : '💾 Enregistrer les paramètres'}
        </button>
      </div>

      {/* Note légale */}
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>⚠️ Important :</strong> Ces informations sont obligatoires pour émettre des factures conformes à la législation française (article 289 du CGI). 
          Assurez-vous de les remplir correctement avant d'envoyer vos premières factures.
        </p>
      </div>
    </form>
  )
}
