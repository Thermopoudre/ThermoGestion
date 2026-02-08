import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names with tailwind-merge for proper class precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number | null | undefined,
  options: { showDecimals?: boolean; currency?: string } = {}
): string {
  const { showDecimals = true, currency = 'EUR' } = options
  
  if (amount === null || amount === undefined) return '0 €'
  
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount)
}

/**
 * Format a date relative to now
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  
  if (seconds < 60) return 'À l\'instant'
  if (minutes < 60) return `Il y a ${minutes} min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 7) return `Il y a ${days} jour${days > 1 ? 's' : ''}`
  if (weeks < 4) return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`
  if (months < 12) return `Il y a ${months} mois`
  
  return d.toLocaleDateString('fr-FR')
}

/**
 * Format a date for display
 */
export function formatDate(
  date: Date | string | null | undefined,
  options: { format?: 'short' | 'medium' | 'long' | 'full' } = {}
): string {
  if (!date) return '-'
  
  const d = typeof date === 'string' ? new Date(date) : date
  const { format = 'medium' } = options
  
  const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: '2-digit' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  }
  
  return d.toLocaleDateString('fr-FR', formatOptions[format])
}

/**
 * Format a phone number for display
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-'
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  
  // French format: XX XX XX XX XX
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  }
  
  // International format
  if (digits.length > 10) {
    return '+' + digits.slice(0, -10) + ' ' + formatPhone(digits.slice(-10))
  }
  
  return phone
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text
  return text.slice(0, length).trim() + '...'
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Generate a unique ID using cryptographically secure random values
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const randomBytes = new Uint8Array(8)
  crypto.getRandomValues(randomBytes)
  const random = Array.from(randomBytes).map(b => b.toString(36)).join('').slice(0, 9)
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`
}

/**
 * Sanitize a string to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeHtml(str: string | null | undefined): string {
  if (!str) return ''
  
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  
  return str.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char)
}

/**
 * Sanitize an object's string values recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj }
  
  for (const key in sanitized) {
    const value = sanitized[key]
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeHtml(value)
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map(item =>
        typeof item === 'string' ? sanitizeHtml(item) : item
      )
    }
  }
  
  return sanitized
}

/**
 * Sanitize CSV values to prevent CSV injection
 * Values starting with =, +, -, @, \t, \r can trigger formula execution
 */
export function sanitizeCsvValue(value: string | null | undefined): string {
  if (!value) return ''
  
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r']
  const trimmed = value.trim()
  
  if (dangerousChars.some(char => trimmed.startsWith(char))) {
    return `'${trimmed}`
  }
  
  return trimmed
}

/**
 * Validate and sanitize input for server-side operations
 */
export function validateInput(value: string, options: {
  maxLength?: number
  minLength?: number
  pattern?: RegExp
  required?: boolean
} = {}): { valid: boolean; error?: string; value: string } {
  const { maxLength = 500, minLength = 0, pattern, required = false } = options
  
  const sanitized = sanitizeHtml(value?.trim())
  
  if (required && !sanitized) {
    return { valid: false, error: 'Ce champ est requis', value: sanitized }
  }
  
  if (sanitized.length < minLength) {
    return { valid: false, error: `Minimum ${minLength} caractères`, value: sanitized }
  }
  
  if (sanitized.length > maxLength) {
    return { valid: false, error: `Maximum ${maxLength} caractères`, value: sanitized }
  }
  
  if (pattern && !pattern.test(sanitized)) {
    return { valid: false, error: 'Format invalide', value: sanitized }
  }
  
  return { valid: true, value: sanitized }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
