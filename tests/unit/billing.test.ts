import { describe, it, expect } from 'vitest'
import { PLANS } from '@/lib/stripe/billing'

describe('Plans SaaS', () => {
  it('le plan trial a un prix de 0', () => {
    expect(PLANS.trial.priceMonthly).toBe(0)
    expect(PLANS.trial.name).toContain('Essai')
  })

  it('le plan lite coûte 29€/mois', () => {
    expect(PLANS.lite.priceMonthly).toBe(29)
    expect(PLANS.lite.features.length).toBeGreaterThan(3)
  })

  it('le plan pro coûte 49€/mois', () => {
    expect(PLANS.pro.priceMonthly).toBe(49)
    expect(PLANS.pro.features.length).toBeGreaterThan(5)
  })

  it('le plan pro contient plus de features que le lite', () => {
    expect(PLANS.pro.features.length).toBeGreaterThan(PLANS.lite.features.length)
  })

  it('chaque plan a un nom défini', () => {
    Object.values(PLANS).forEach(plan => {
      expect(plan.name).toBeTruthy()
      expect(plan.features.length).toBeGreaterThan(0)
    })
  })
})
