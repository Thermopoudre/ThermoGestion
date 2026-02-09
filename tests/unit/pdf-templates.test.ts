import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CGV_DEVIS,
  DEFAULT_CGV_FACTURE,
  getDefaultCGV,
  getRetractationHTML,
} from '@/lib/pdf-templates/index'

describe('CGV par défaut', () => {
  it('retourne les CGV devis pour type "devis"', () => {
    const cgv = getDefaultCGV('devis')
    expect(cgv).toBe(DEFAULT_CGV_DEVIS)
    expect(cgv).toContain('30 jours')
    expect(cgv).toContain('Acompte')
  })

  it('retourne les CGV facture pour type "facture"', () => {
    const cgv = getDefaultCGV('facture')
    expect(cgv).toBe(DEFAULT_CGV_FACTURE)
    expect(cgv).toContain('L441-10')
    expect(cgv).toContain('40 €')
    expect(cgv).toContain('D441-5')
  })

  it('les CGV facture contiennent les mentions légales obligatoires', () => {
    expect(DEFAULT_CGV_FACTURE).toContain('pénalités')
    expect(DEFAULT_CGV_FACTURE).toContain('taux d\'intérêt légal')
    expect(DEFAULT_CGV_FACTURE).toContain('indemnité forfaitaire')
    expect(DEFAULT_CGV_FACTURE).toContain('escompte')
  })
})

describe('Droit de rétractation', () => {
  it('affiche le bloc pour un client particulier', () => {
    const html = getRetractationHTML('particulier')
    expect(html).toContain('rétractation')
    expect(html).toContain('L221-18')
    expect(html).toContain('14 jours')
  })

  it('affiche le bloc par défaut (undefined)', () => {
    const html = getRetractationHTML(undefined)
    expect(html).toContain('rétractation')
  })

  it('n\'affiche PAS le bloc pour un professionnel', () => {
    const html = getRetractationHTML('professionnel')
    expect(html).toBe('')
  })
})
