// Système de templates PDF professionnels pour devis/factures
// Chaque template a un design unique et professionnel

export interface TemplateData {
  // Devis/Facture info
  type: 'devis' | 'facture'
  numero: string
  date: string
  validite?: string
  
  // Montants
  totalHt: number
  totalTtc: number
  tvaRate: number
  totalTva: number
  remise?: { type: 'pourcentage' | 'montant'; valeur: number }
  totalRevient?: number
  margePct?: number
  
  // Items
  items: Array<{
    designation: string
    description?: string
    quantite: number
    surface_m2?: number
    couches?: number | Array<{ type: string }>
    prixUnitaire?: number
    total_ht: number
  }>
  
  // Client
  client: {
    nom: string
    email?: string
    telephone?: string
    adresse?: string
    siret?: string
    type?: string
  }
  
  // Atelier
  atelier: {
    nom: string
    adresse?: string
    telephone?: string
    email?: string
    siret?: string
    tvaIntra?: string
    rcs?: string
    logo?: string
    iban?: string
    bic?: string
  }
  
  // Signature
  signed?: {
    date: string
    signatureData?: string
  }
  
  // Options
  notes?: string
  cgv?: string
}

export type TemplateName = 'classic' | 'modern' | 'industrial' | 'premium'

export interface TemplateInfo {
  id: TemplateName
  name: string
  description: string
  preview: string
  colors: {
    primary: string
    secondary: string
    accent: string
  }
}

export const TEMPLATES: Record<TemplateName, TemplateInfo> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Design professionnel et épuré, parfait pour tous secteurs',
    preview: '/templates/classic-preview.png',
    colors: {
      primary: '#1e3a5f',
      secondary: '#6b7280',
      accent: '#3b82f6'
    }
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Design contemporain avec touches de couleur vives',
    preview: '/templates/modern-preview.png',
    colors: {
      primary: '#0f172a',
      secondary: '#64748b',
      accent: '#06b6d4'
    }
  },
  industrial: {
    id: 'industrial',
    name: 'Industriel',
    description: 'Conçu pour les ateliers de thermolaquage et métallurgie',
    preview: '/templates/industrial-preview.png',
    colors: {
      primary: '#dc2626',
      secondary: '#374151',
      accent: '#f97316'
    }
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Design haut de gamme avec finitions élégantes',
    preview: '/templates/premium-preview.png',
    colors: {
      primary: '#1f2937',
      secondary: '#9ca3af',
      accent: '#d4af37'
    }
  }
}

// Formater un montant en euros
const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount)
}

// Formater une date
const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

// Générer le nombre de couches pour affichage
const getCouchesDisplay = (couches: number | Array<{ type: string }> | undefined): string => {
  if (!couches) return '1'
  if (Array.isArray(couches)) return couches.length.toString()
  return couches.toString()
}
