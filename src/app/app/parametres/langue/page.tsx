'use client'

import { useState, useEffect } from 'react'
import { Globe, DollarSign, Calendar, Check } from 'lucide-react'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { locales, currencies, Locale, Currency, formatCurrency, formatDate, formatNumber } from '@/lib/i18n/translations'

export default function LangueSettingsPage() {
  const [locale, setLocale] = useState<Locale>('fr')
  const [currency, setCurrency] = useState<Currency>('EUR')
  const [dateFormat, setDateFormat] = useState('dd/MM/yyyy')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load saved preferences
    const savedLocale = localStorage.getItem('locale') as Locale
    const savedCurrency = localStorage.getItem('currency') as Currency
    const savedDateFormat = localStorage.getItem('dateFormat')
    
    if (savedLocale) setLocale(savedLocale)
    if (savedCurrency) setCurrency(savedCurrency)
    if (savedDateFormat) setDateFormat(savedDateFormat)
  }, [])

  function saveSettings() {
    localStorage.setItem('locale', locale)
    localStorage.setItem('currency', currency)
    localStorage.setItem('dateFormat', dateFormat)
    document.documentElement.lang = locale
    
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const dateFormats = [
    { value: 'dd/MM/yyyy', label: '21/01/2026', example: 'Format européen' },
    { value: 'MM/dd/yyyy', label: '01/21/2026', example: 'Format américain' },
    { value: 'yyyy-MM-dd', label: '2026-01-21', example: 'Format ISO' },
    { value: 'dd.MM.yyyy', label: '21.01.2026', example: 'Format allemand' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <SettingsNav />
        
        <div className="mt-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Langue et formats
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Personnalisez la langue et les formats d'affichage
          </p>

          <div className="space-y-8">
            {/* Language Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-6 h-6 text-orange-500" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Langue</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {locales.map((loc) => (
                  <button
                    key={loc.code}
                    onClick={() => setLocale(loc.code)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      locale === loc.code
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{loc.flag}</span>
                    <div className="text-left">
                      <p className="font-medium text-gray-900 dark:text-white">{loc.name}</p>
                      <p className="text-xs text-gray-500">{loc.code.toUpperCase()}</p>
                    </div>
                    {locale === loc.code && (
                      <Check className="w-5 h-5 text-orange-500 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <DollarSign className="w-6 h-6 text-orange-500" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Devise</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {currencies.map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => setCurrency(curr.code)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      currency === curr.code
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">
                      {curr.symbol}
                    </span>
                    <div className="text-left">
                      <p className="font-medium text-gray-900 dark:text-white">{curr.name}</p>
                      <p className="text-xs text-gray-500">{curr.code}</p>
                    </div>
                    {currency === curr.code && (
                      <Check className="w-5 h-5 text-orange-500 ml-auto" />
                    )}
                  </button>
                ))}
              </div>

              {/* Preview */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Aperçu :</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(1234.56, currency, locale)}
                </p>
              </div>
            </div>

            {/* Date Format Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-orange-500" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Format de date</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dateFormats.map((format) => (
                  <button
                    key={format.value}
                    onClick={() => setDateFormat(format.value)}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      dateFormat === format.value
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-mono font-bold text-gray-900 dark:text-white">{format.label}</p>
                      <p className="text-xs text-gray-500">{format.example}</p>
                    </div>
                    {dateFormat === format.value && (
                      <Check className="w-5 h-5 text-orange-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Number Format Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Aperçu des formats</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Nombre</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatNumber(1234567.89, locale)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Prix</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(1234.50, currency, locale)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Date</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatDate(new Date(), locale, 'long')}
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveSettings}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                  saved
                    ? 'bg-green-500 text-white'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-400 hover:to-red-400'
                }`}
              >
                {saved ? (
                  <>
                    <Check className="w-5 h-5" />
                    Enregistré !
                  </>
                ) : (
                  'Enregistrer les préférences'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
