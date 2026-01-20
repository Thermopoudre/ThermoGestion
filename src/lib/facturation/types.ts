// Types pour le système de facturation

import type { Database } from '@/types/database.types'

export type FactureType = 'acompte' | 'solde' | 'complete'
export type FactureStatus = 'brouillon' | 'envoyee' | 'payee' | 'remboursee'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'
export type PaymentMethod = 'stripe' | 'paypal' | 'gocardless' | 'cash' | 'check' | 'transfer' | 'other'

export interface FactureItem {
  id: string
  designation: string
  quantite: number
  prix_unitaire_ht: number
  tva_rate: number
  total_ht: number
  total_ttc: number
}

export interface Facture extends Database['public']['Tables']['factures']['Row'] {
  items?: FactureItem[]
  clients?: Database['public']['Tables']['clients']['Row']
  projets?: Database['public']['Tables']['projets']['Row']
}

export interface Paiement extends Database['public']['Tables']['paiements']['Row'] {
  factures?: Facture
  clients?: Database['public']['Tables']['clients']['Row']
}

export interface FactureFormData {
  client_id: string
  projet_id?: string
  type: FactureType
  items: FactureItem[]
  total_ht: number
  total_ttc: number
  tva_rate: number
  acompte_amount?: number
  due_date?: string
  notes?: string
}
