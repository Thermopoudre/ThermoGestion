import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatPhone,
  truncate,
  getInitials,
  isEmpty,
  sanitizeHtml,
  sanitizeCsvValue,
  validateInput,
  cn,
} from '@/lib/utils'

// ── formatCurrency ────────────────────────────────────────────
describe('formatCurrency', () => {
  it('formate un montant positif en euros', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('€')
  })

  it('retourne "0 €" pour null/undefined', () => {
    expect(formatCurrency(null)).toBe('0 €')
    expect(formatCurrency(undefined)).toBe('0 €')
  })

  it('respecte l\'option showDecimals', () => {
    const result = formatCurrency(100, { showDecimals: false })
    expect(result).not.toContain(',00')
  })
})

// ── formatPhone ───────────────────────────────────────────────
describe('formatPhone', () => {
  it('formate un numéro français 10 chiffres', () => {
    expect(formatPhone('0601020304')).toBe('06 01 02 03 04')
  })

  it('retourne "-" pour null/undefined', () => {
    expect(formatPhone(null)).toBe('-')
    expect(formatPhone(undefined)).toBe('-')
  })

  it('conserve un numéro trop court tel quel', () => {
    expect(formatPhone('0601')).toBe('0601')
  })
})

// ── truncate ──────────────────────────────────────────────────
describe('truncate', () => {
  it('ne tronque pas si la longueur est suffisante', () => {
    expect(truncate('Bonjour', 50)).toBe('Bonjour')
  })

  it('tronque avec ellipsis', () => {
    const result = truncate('Un texte très long qui dépasse la limite', 10)
    expect(result).toHaveLength(13) // 10 chars + "..."
    expect(result).toContain('...')
  })
})

// ── getInitials ───────────────────────────────────────────────
describe('getInitials', () => {
  it('retourne les 2 premières initiales', () => {
    expect(getInitials('Jean Dupont')).toBe('JD')
  })

  it('fonctionne avec un seul mot', () => {
    expect(getInitials('Jean')).toBe('J')
  })

  it('retourne "?" pour null', () => {
    expect(getInitials(null)).toBe('?')
  })

  it('limite à 2 caractères pour les noms longs', () => {
    expect(getInitials('Jean Pierre Dupont')).toBe('JP')
  })
})

// ── isEmpty ───────────────────────────────────────────────────
describe('isEmpty', () => {
  it('détecte null et undefined', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
  })

  it('détecte une string vide', () => {
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('   ')).toBe(true)
  })

  it('détecte un tableau vide', () => {
    expect(isEmpty([])).toBe(true)
  })

  it('détecte un objet vide', () => {
    expect(isEmpty({})).toBe(true)
  })

  it('retourne false pour des valeurs non vides', () => {
    expect(isEmpty('hello')).toBe(false)
    expect(isEmpty([1])).toBe(false)
    expect(isEmpty({ a: 1 })).toBe(false)
    expect(isEmpty(0)).toBe(false)
  })
})

// ── sanitizeHtml ──────────────────────────────────────────────
describe('sanitizeHtml', () => {
  it('échappe les caractères HTML dangereux', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    )
  })

  it('échappe & et quotes', () => {
    expect(sanitizeHtml('A & B "C"')).toBe('A &amp; B &quot;C&quot;')
  })

  it('retourne une string vide pour null/undefined', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })

  it('ne modifie pas du texte sûr', () => {
    expect(sanitizeHtml('Bonjour le monde')).toBe('Bonjour le monde')
  })
})

// ── sanitizeCsvValue ──────────────────────────────────────────
describe('sanitizeCsvValue', () => {
  it('préfixe les valeurs commençant par = pour prévenir l\'injection CSV', () => {
    expect(sanitizeCsvValue('=CMD("rm -rf /")')).toBe("'=CMD(\"rm -rf /\")")
  })

  it('préfixe les valeurs commençant par +', () => {
    expect(sanitizeCsvValue('+CMD("rm")')).toBe("'+CMD(\"rm\")")
  })

  it('ne modifie pas les valeurs sûres', () => {
    expect(sanitizeCsvValue('Normal text')).toBe('Normal text')
  })

  it('retourne une string vide pour null', () => {
    expect(sanitizeCsvValue(null)).toBe('')
  })
})

// ── validateInput ─────────────────────────────────────────────
describe('validateInput', () => {
  it('valide un champ requis', () => {
    const result = validateInput('', { required: true })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('requis')
  })

  it('valide un champ avec longueur minimale', () => {
    const result = validateInput('ab', { minLength: 3 })
    expect(result.valid).toBe(false)
  })

  it('accepte une entrée valide', () => {
    const result = validateInput('Atelier Pro', { required: true, minLength: 2 })
    expect(result.valid).toBe(true)
  })

  it('sanitize les entrées', () => {
    const result = validateInput('<b>test</b>')
    expect(result.value).not.toContain('<b>')
  })
})

// ── cn (tailwind merge) ──────────────────────────────────────
describe('cn', () => {
  it('combine des classes', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('résout les conflits tailwind', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })

  it('gère les conditions', () => {
    expect(cn('base', false && 'hidden', true && 'block')).toBe('base block')
  })
})
