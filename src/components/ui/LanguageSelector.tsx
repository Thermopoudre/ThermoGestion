'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { locales, currencies, Locale, Currency } from '@/lib/i18n/translations'

interface LanguageSelectorProps {
  showCurrency?: boolean
  compact?: boolean
}

export function LanguageSelector({ showCurrency = false, compact = false }: LanguageSelectorProps) {
  const { locale, setLocale, currency, setCurrency } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'language' | 'currency'>('language')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLocale = locales.find(l => l.code === locale)
  const currentCurrency = currencies.find(c => c.code === currency)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${
          compact 
            ? 'p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700' 
            : 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
        } transition-colors`}
      >
        <Globe className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        {!compact && (
          <>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLocale?.flag} {currentLocale?.code.toUpperCase()}
            </span>
            {showCurrency && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {currentCurrency?.symbol}
                </span>
              </>
            )}
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* Tabs */}
          {showCurrency && (
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('language')}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activeTab === 'language'
                    ? 'text-orange-600 border-b-2 border-orange-500'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Langue
              </button>
              <button
                onClick={() => setActiveTab('currency')}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activeTab === 'currency'
                    ? 'text-orange-600 border-b-2 border-orange-500'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Devise
              </button>
            </div>
          )}

          {/* Language List */}
          {activeTab === 'language' && (
            <div className="py-2">
              {locales.map((loc) => (
                <button
                  key={loc.code}
                  onClick={() => {
                    setLocale(loc.code)
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{loc.flag}</span>
                    <span className="text-gray-700 dark:text-gray-300">{loc.name}</span>
                  </div>
                  {locale === loc.code && (
                    <Check className="w-4 h-4 text-orange-500" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Currency List */}
          {activeTab === 'currency' && showCurrency && (
            <div className="py-2">
              {currencies.map((curr) => (
                <button
                  key={curr.code}
                  onClick={() => {
                    setCurrency(curr.code)
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 font-mono font-bold text-gray-600 dark:text-gray-400">
                      {curr.symbol}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">{curr.name}</span>
                    <span className="text-xs text-gray-500">({curr.code})</span>
                  </div>
                  {currency === curr.code && (
                    <Check className="w-4 h-4 text-orange-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
