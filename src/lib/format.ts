/**
 * Utilitaires de formatage pour ThermoGestion
 */

/**
 * Formate une surface en m² avec le bon nombre de décimales
 * Ex: 9.500 → "9.5", 10.0 → "10", 2.25 → "2.25"
 */
export function formatSurface(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  
  // Arrondir à 2 décimales max
  const rounded = Math.round(value * 100) / 100
  
  // Enlever les zéros inutiles
  return rounded.toString()
}

/**
 * Formate une surface avec l'unité m²
 * Ex: 9.500 → "9.5 m²"
 */
export function formatSurfaceWithUnit(value: number | null | undefined): string {
  return `${formatSurface(value)} m²`
}

/**
 * Formate un montant en euros
 */
export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0 €'
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  }).format(amount)
}

/**
 * Formate un pourcentage
 * Ex: 0.156 → "15.6%"
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '0%'
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Formate une date en français
 */
export function formatDate(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Formate une date relative (il y a X jours)
 */
export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaine${Math.floor(diffDays / 7) > 1 ? 's' : ''}`
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`
  return `Il y a ${Math.floor(diffDays / 365)} an${Math.floor(diffDays / 365) > 1 ? 's' : ''}`
}

/**
 * Formate un poids en kg
 */
export function formatWeight(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0 kg'
  const rounded = Math.round(value * 10) / 10
  return `${rounded} kg`
}

/**
 * Formate une température
 */
export function formatTemperature(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${value}°C`
}

/**
 * Formate une durée en minutes/heures
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '-'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}
