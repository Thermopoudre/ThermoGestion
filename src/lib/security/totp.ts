/**
 * Service TOTP (Time-based One-Time Password)
 * 
 * Implémente la 2FA via RFC 6238 (TOTP) + RFC 4226 (HOTP)
 * Compatible avec Google Authenticator, Authy, 1Password, etc.
 * 
 * Utilise otplib v5+ (API TOTP class)
 */

import { TOTP, generateSecret as genSecret, generateURI } from 'otplib'

// Instance TOTP configurée
const totp = new TOTP()

/**
 * Générer un nouveau secret TOTP
 */
export function generateTOTPSecret(): string {
  return genSecret()
}

/**
 * Générer l'URI otpauth:// pour QR Code
 * Format: otpauth://totp/ThermoGestion:user@email.com?secret=...&issuer=ThermoGestion
 */
export function generateTOTPUri(secret: string, email: string): string {
  return generateURI({
    type: 'totp',
    label: email,
    secret,
    issuer: 'ThermoGestion',
  })
}

/**
 * Vérifier un code TOTP
 */
export function verifyTOTPCode(code: string, secret: string): boolean {
  try {
    return totp.verify({ token: code, secret })
  } catch {
    return false
  }
}

/**
 * Générer des codes de secours (backup codes)
 * 8 codes de 8 caractères alphanumériques
 * Utilise crypto.getRandomValues() pour une génération sécurisée
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Sans I, O, 0, 1 pour éviter la confusion

  for (let i = 0; i < count; i++) {
    const randomBytes = new Uint8Array(8)
    crypto.getRandomValues(randomBytes)
    let code = ''
    for (let j = 0; j < 8; j++) {
      code += chars.charAt(randomBytes[j] % chars.length)
    }
    // Format: XXXX-XXXX pour lisibilité
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
  }

  return codes
}
