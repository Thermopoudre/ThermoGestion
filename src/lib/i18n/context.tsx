'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, defaultLocale, Currency, t as translate, formatCurrency as formatCurr, formatNumber as formatNum, formatDate as formatD, formatPercent as formatPct } from './translations'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  currency: Currency
  setCurrency: (currency: Currency) => void
  t: (key: string) => string
  formatCurrency: (amount: number) => string
  formatNumber: (num: number) => string
  formatDate: (date: Date | string, format?: 'short' | 'long' | 'relative') => string
  formatPercent: (value: number) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [currency, setCurrencyState] = useState<Currency>('EUR')

  useEffect(() => {
    // Load saved preferences
    const savedLocale = localStorage.getItem('locale') as Locale
    const savedCurrency = localStorage.getItem('currency') as Currency
    
    if (savedLocale) setLocaleState(savedLocale)
    if (savedCurrency) setCurrencyState(savedCurrency)
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
    document.documentElement.lang = newLocale
  }

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency)
    localStorage.setItem('currency', newCurrency)
  }

  const value: I18nContextType = {
    locale,
    setLocale,
    currency,
    setCurrency,
    t: (key: string) => translate(key, locale),
    formatCurrency: (amount: number) => formatCurr(amount, currency, locale),
    formatNumber: (num: number) => formatNum(num, locale),
    formatDate: (date: Date | string, format?: 'short' | 'long' | 'relative') => formatD(date, locale, format),
    formatPercent: (value: number) => formatPct(value, locale),
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
