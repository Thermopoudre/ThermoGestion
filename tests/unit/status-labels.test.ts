import { describe, it, expect } from 'vitest'
import {
  getProjetStatusLabel,
  getProjetStatusColor,
  getDevisStatusLabel,
  getDevisStatusColor,
  getFacturePaymentLabel,
  getFacturePaymentColor,
} from '@/lib/status-labels'

describe('Projet Status Labels', () => {
  it('retourne le bon label pour un statut connu', () => {
    expect(getProjetStatusLabel('en_cours')).toBe('En production')
    expect(getProjetStatusLabel('termine')).toBe('Terminé')
    expect(getProjetStatusLabel('en_cuisson')).toBe('Cuisson')
    expect(getProjetStatusLabel('qc')).toBe('Contrôle qualité')
    expect(getProjetStatusLabel('annule')).toBe('Annulé')
  })

  it('retourne le statut brut si inconnu', () => {
    expect(getProjetStatusLabel('unknown_status')).toBe('unknown_status')
  })

  it('retourne les bonnes couleurs', () => {
    const color = getProjetStatusColor('termine')
    expect(color).toContain('bg-green')
    expect(color).toContain('text-green')
  })

  it('retourne la couleur par défaut pour un statut inconnu', () => {
    const color = getProjetStatusColor('xyz')
    expect(color).toContain('bg-gray')
  })
})

describe('Devis Status Labels', () => {
  it('retourne le bon label (FR et EN)', () => {
    expect(getDevisStatusLabel('draft')).toBe('Brouillon')
    expect(getDevisStatusLabel('brouillon')).toBe('Brouillon')
    expect(getDevisStatusLabel('sent')).toBe('Envoyé')
    expect(getDevisStatusLabel('envoye')).toBe('Envoyé')
    expect(getDevisStatusLabel('signed')).toBe('Accepté')
    expect(getDevisStatusLabel('accepte')).toBe('Accepté')
  })

  it('retourne les bonnes couleurs', () => {
    expect(getDevisStatusColor('signed')).toContain('bg-green')
    expect(getDevisStatusColor('refused')).toContain('bg-red')
  })
})

describe('Facture Payment Labels', () => {
  it('retourne le bon label', () => {
    expect(getFacturePaymentLabel('paid')).toBe('Payée')
    expect(getFacturePaymentLabel('unpaid')).toBe('À payer')
    expect(getFacturePaymentLabel('overdue')).toBe('En retard')
  })

  it('retourne les bonnes couleurs', () => {
    expect(getFacturePaymentColor('paid')).toContain('bg-green')
    expect(getFacturePaymentColor('overdue')).toContain('bg-red')
  })
})
