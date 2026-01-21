import { NextResponse } from 'next/server'
import { generatePDF } from '@/lib/pdf-templates/generator'
import type { TemplateName, TemplateData } from '@/lib/pdf-templates'

// Données de démonstration pour la prévisualisation
const DEMO_DATA: TemplateData = {
  type: 'devis',
  numero: 'DEV-2026-0042',
  date: new Date().toISOString(),
  validite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  totalHt: 1250.00,
  totalTtc: 1500.00,
  tvaRate: 20,
  totalTva: 250.00,
  items: [
    {
      designation: 'Thermolaquage portail aluminium',
      description: 'RAL 7016 gris anthracite - finition satinée',
      quantite: 2,
      surface_m2: 3.5,
      couches: 2,
      total_ht: 420.00,
    },
    {
      designation: 'Thermolaquage garde-corps',
      description: 'RAL 9005 noir profond - finition brillante',
      quantite: 4,
      surface_m2: 2.8,
      couches: 2,
      total_ht: 380.00,
    },
    {
      designation: 'Traitement anticorrosion',
      description: 'Primaire époxy bi-composant',
      quantite: 6,
      surface_m2: 6.3,
      couches: 1,
      total_ht: 450.00,
    },
  ],
  client: {
    nom: 'SARL Métallerie Dupont',
    email: 'contact@metallerie-dupont.fr',
    telephone: '01 23 45 67 89',
    adresse: '15 rue de l\'Industrie\n69000 Lyon',
    siret: '123 456 789 00012',
    type: 'professionnel',
  },
  atelier: {
    nom: 'ThermoLaquage Pro',
    adresse: '42 avenue des Artisans, 69100 Villeurbanne',
    telephone: '04 78 90 12 34',
    email: 'contact@thermolaquage-pro.fr',
    siret: '987 654 321 00023',
    tvaIntra: 'FR12987654321',
    rcs: 'Lyon B 987 654 321',
  },
  notes: 'Délai de réalisation estimé : 5 jours ouvrés.\nPièces à déposer à l\'atelier avant le 15 du mois.',
  cgv: 'Devis valable 30 jours. Acompte de 30% à la commande. Solde à la livraison.',
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const templateName = (searchParams.get('template') || 'classic') as TemplateName

    // Valider le nom du template
    const validTemplates: TemplateName[] = ['classic', 'modern', 'industrial', 'premium']
    if (!validTemplates.includes(templateName)) {
      return NextResponse.json({ error: 'Template invalide' }, { status: 400 })
    }

    // Générer le HTML avec les données de démo
    const html = generatePDF(templateName, DEMO_DATA)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('Erreur prévisualisation template:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la prévisualisation' },
      { status: 500 }
    )
  }
}
