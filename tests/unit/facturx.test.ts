import { describe, it, expect } from 'vitest'
import { generateFacturXML, buildFacturXData, computeHash } from '@/lib/facturx/generate'

describe('Factur-X Generation', () => {
  const mockData = {
    numero: 'FC-2026-001',
    dateEmission: '20260208',
    datePrestation: '20260207',
    dateEcheance: '20260308',
    devise: 'EUR',
    type: 'facture' as const,
    emetteur: {
      nom: 'Atelier Test',
      siret: '12345678901234',
      tvaIntra: 'FR12345678901',
      adresse: '10 rue du Four',
      codePostal: '69001',
      ville: 'Lyon',
      pays: 'FR',
      email: 'test@atelier.fr',
      iban: 'FR7612345678901234567890189',
      bic: 'BNPAFRPP',
    },
    client: {
      nom: 'Client Pro SAS',
      siret: '98765432109876',
      tvaIntra: 'FR98765432109',
      adresse: '5 avenue des Pièces',
      codePostal: '75001',
      ville: 'Paris',
      pays: 'FR',
    },
    lignes: [
      { designation: 'Thermolaquage portail RAL 7016', quantite: 1, prixUnitaireHT: 250, tauxTVA: 20, totalHT: 250 },
      { designation: 'Sablage préparation surface', quantite: 1, prixUnitaireHT: 80, tauxTVA: 20, totalHT: 80 },
    ],
    totalHT: 330,
    totalTVA: 66,
    totalTTC: 396,
  }

  it('génère un XML Factur-X valide', () => {
    const xml = generateFacturXML(mockData)
    
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('CrossIndustryInvoice')
    expect(xml).toContain('urn:factur-x.eu:1p0:minimum')
    expect(xml).toContain('FC-2026-001')
    expect(xml).toContain('380') // Type code facture
  })

  it('contient les informations émetteur', () => {
    const xml = generateFacturXML(mockData)
    
    expect(xml).toContain('Atelier Test')
    expect(xml).toContain('12345678901234')
    expect(xml).toContain('FR12345678901')
    expect(xml).toContain('Lyon')
    expect(xml).toContain('FR7612345678901234567890189')
  })

  it('contient les informations client', () => {
    const xml = generateFacturXML(mockData)
    
    expect(xml).toContain('Client Pro SAS')
    expect(xml).toContain('98765432109876')
    expect(xml).toContain('Paris')
  })

  it('contient les montants corrects', () => {
    const xml = generateFacturXML(mockData)
    
    expect(xml).toContain('330.00')
    expect(xml).toContain('66.00')
    expect(xml).toContain('396.00')
  })

  it('contient les lignes de facture', () => {
    const xml = generateFacturXML(mockData)
    
    expect(xml).toContain('Thermolaquage portail RAL 7016')
    expect(xml).toContain('Sablage préparation surface')
    expect(xml).toContain('250.00')
    expect(xml).toContain('80.00')
  })

  it('génère un avoir avec type code 381', () => {
    const avoirData = { ...mockData, type: 'avoir' as const }
    const xml = generateFacturXML(avoirData)
    expect(xml).toContain('381')
  })

  it('escape correctement les caractères XML', () => {
    const dataWithSpecialChars = {
      ...mockData,
      emetteur: { ...mockData.emetteur, nom: 'Atelier "L\'Art & la Couleur"' },
    }
    const xml = generateFacturXML(dataWithSpecialChars)
    expect(xml).toContain('&amp;')
    expect(xml).toContain('&apos;')
    expect(xml).toContain('&quot;')
  })

  it('computeHash génère un hash SHA-256 valide', async () => {
    const hash = await computeHash('test content')
    expect(hash).toHaveLength(64) // SHA-256 = 64 caractères hex
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })

  it('computeHash est déterministe', async () => {
    const hash1 = await computeHash('facture content')
    const hash2 = await computeHash('facture content')
    expect(hash1).toBe(hash2)
  })

  it('buildFacturXData construit correctement depuis des données brutes', () => {
    const facture = {
      numero: 'FC-001',
      created_at: '2026-02-08T10:00:00Z',
      total_ht: 100,
      total_ttc: 120,
      tva_rate: 20,
      type: 'facture',
      items: [
        { designation: 'Test', quantite: 1, prix_unitaire_ht: 100, tva_rate: 20, total_ht: 100 }
      ],
      projets: { numero: 'PRJ-001', date_livre: null, date_depot: null },
      due_date: '2026-03-08',
    }
    const atelier = {
      name: 'Mon Atelier',
      siret: '12345678901234',
      address: '10 rue Test, 75001 Paris',
      email: 'a@b.fr',
    }
    const client = {
      full_name: 'Jean Dupont',
      address: '5 avenue Exemple, 69001 Lyon',
    }

    const result = buildFacturXData(facture, atelier, client)
    expect(result.numero).toBe('FC-001')
    expect(result.emetteur.nom).toBe('Mon Atelier')
    expect(result.client.nom).toBe('Jean Dupont')
    expect(result.totalHT).toBe(100)
    expect(result.totalTTC).toBe(120)
    expect(result.lignes).toHaveLength(1)
  })
})
