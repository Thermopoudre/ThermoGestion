// Types globaux de l'application

export type UserRole = 'owner' | 'admin' | 'operator' | 'compta'
export type PlanType = 'lite' | 'pro'
export type ProjectStatus = 'devis' | 'en_cours' | 'en_cuisson' | 'qc' | 'pret' | 'livre' | 'annule'

export interface Atelier {
  id: string
  name: string
  siret?: string
  address?: string
  phone?: string
  email?: string
  plan: PlanType
  trial_ends_at?: Date
  storage_quota_gb: number
  storage_used_gb: number
  settings: Record<string, any>
  created_at: Date
  updated_at: Date
}

export interface User {
  id: string
  atelier_id: string
  role: UserRole
  email: string
  full_name?: string
  phone?: string
  two_factor_enabled: boolean
  last_login_at?: Date
  created_at: Date
  updated_at: Date
}

export interface Client {
  id: string
  atelier_id: string
  email: string
  full_name: string
  phone?: string
  address?: string
  type: 'particulier' | 'professionnel'
  siret?: string
  tags?: string[]
  notes?: string
  created_at: Date
  updated_at: Date
}
