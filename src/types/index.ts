// Types globaux de l'application ThermoGestion

export type UserRole = 'owner' | 'admin' | 'operator' | 'compta'
export type PlanType = 'lite' | 'pro' | 'enterprise'
export type ProjectStatus = 'devis' | 'en_cours' | 'en_cuisson' | 'qc' | 'pret' | 'livre' | 'annule'
export type DevisStatus = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire' | 'converted'
export type FactureStatus = 'brouillon' | 'envoyee' | 'payee' | 'remboursee'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'
export type PoudreType = 'epoxy' | 'polyester' | 'epoxy-polyester' | 'polyurethane' | 'autre'
export type Finition = 'mat' | 'satin' | 'brillant' | 'texture' | 'metallic' | 'autre'
export type ClientType = 'particulier' | 'professionnel'
export type Priorite = 'basse' | 'normale' | 'haute' | 'urgente'

// ── Atelier ────────────────────────────────────────────────

export interface AtelierSettings {
  theme?: 'light' | 'dark' | 'system'
  language?: 'fr' | 'en' | 'de' | 'es'
  email_notifications?: boolean
  auto_facture_trigger?: 'pret' | 'livre' | 'manuel'
  stock_seuil_alerte_kg?: number
  devis_validite_jours?: number
  tva_defaut?: number
  marge_defaut_poudre?: number
  marge_defaut_mo?: number
  workflow_steps?: string[]
  four_dimensions?: { longueur: number; largeur: number; hauteur: number }
  quality_gates_enabled?: boolean
  facturx_enabled?: boolean
}

export interface Atelier {
  id: string
  name: string
  siret?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  plan: PlanType
  trial_ends_at?: string | null
  storage_quota_gb: number
  storage_used_gb: number
  settings: AtelierSettings
  created_at: string
  updated_at: string
}

// ── User ───────────────────────────────────────────────────

export interface User {
  id: string
  atelier_id: string
  role: UserRole
  email: string
  full_name?: string | null
  phone?: string | null
  two_factor_enabled: boolean
  last_login_at?: string | null
  created_at: string
  updated_at: string
}

// ── Client ─────────────────────────────────────────────────

export interface Client {
  id: string
  atelier_id: string
  email: string
  full_name: string
  phone?: string | null
  address?: string | null
  type: ClientType
  siret?: string | null
  tags?: string[] | null
  notes?: string | null
  facture_trigger?: 'pret' | 'livre' | 'manuel' | null
  created_at: string
  updated_at: string
}

// ── Poudre ─────────────────────────────────────────────────

export interface Poudre {
  id: string
  atelier_id: string
  marque: string
  reference: string
  nom?: string | null
  type: PoudreType
  ral?: string | null
  finition: Finition
  densite?: number | null
  epaisseur_conseillee?: number | null
  consommation_m2?: number | null
  temp_cuisson?: number | null
  duree_cuisson?: number | null
  prix_kg?: number | null
  stock_theorique_kg?: number | null
  stock_reel_kg?: number | null
  source?: 'manual' | 'thermopoudre' | 'concurrent' | null
  certifications?: string[] | null
  created_at: string
  updated_at: string
}

// ── Devis ──────────────────────────────────────────────────

export interface DevisLigne {
  id?: string
  designation: string
  description?: string | null
  quantite: number
  unite: string
  prix_unitaire_ht: number
  tva_rate: number
  remise_percent: number
  total_ht: number
  poudre_id?: string | null
  surface_m2?: number | null
  nb_couches?: number | null
}

export interface Devis {
  id: string
  atelier_id: string
  client_id: string
  numero: string
  status: DevisStatus
  total_ht: number
  total_ttc: number
  tva_rate: number
  items: DevisLigne[]
  template_id?: string | null
  pdf_url?: string | null
  signed_at?: string | null
  signed_by?: string | null
  signed_ip?: string | null
  signature_data?: Record<string, unknown> | null
  conditions?: string | null
  validite_jours?: number | null
  created_by?: string | null
  created_at: string
  updated_at: string
  // Relations
  clients?: Pick<Client, 'id' | 'full_name' | 'email'> | null
}

// ── Projet ─────────────────────────────────────────────────

export interface Projet {
  id: string
  atelier_id: string
  client_id: string
  devis_id?: string | null
  numero: string
  name: string
  status: ProjectStatus
  priorite?: Priorite | null
  workflow_config?: Record<string, unknown> | null
  current_step?: number | null
  pieces?: Record<string, unknown>[] | null
  poudre_id?: string | null
  couches?: number | null
  temp_cuisson?: number | null
  duree_cuisson?: number | null
  date_depot?: string | null
  date_promise?: string | null
  date_livre?: string | null
  photos_count?: number | null
  photos_size_mb?: number | null
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  // Relations
  clients?: Pick<Client, 'id' | 'full_name' | 'email'> | null
  poudres?: Pick<Poudre, 'id' | 'marque' | 'reference' | 'finition'> | null
}

// ── Facture ────────────────────────────────────────────────

export interface Facture {
  id: string
  atelier_id: string
  client_id: string
  projet_id?: string | null
  devis_id?: string | null
  numero: string
  type: 'acompte' | 'solde' | 'complete'
  status: FactureStatus
  payment_status: PaymentStatus
  total_ht: number
  total_ttc: number
  tva_rate: number
  items?: DevisLigne[] | null
  payment_method?: string | null
  payment_ref?: string | null
  paid_at?: string | null
  due_date?: string | null
  pdf_url?: string | null
  notes?: string | null
  fec_exported?: boolean | null
  facturx_xml?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  // Relations
  clients?: Pick<Client, 'id' | 'full_name' | 'email'> | null
}

// ── Fournisseur (Sprint 3) ─────────────────────────────────

export interface Fournisseur {
  id: string
  atelier_id: string
  nom: string
  contact_nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  siret?: string | null
  conditions_paiement?: string | null
  delai_livraison_jours?: number | null
  note_qualite?: number | null
  notes?: string | null
  active: boolean
  created_at: string
  updated_at: string
}

// ── Lot / Tracabilite (Sprint 3) ───────────────────────────

export interface LotPoudre {
  id: string
  atelier_id: string
  poudre_id: string
  fournisseur_id?: string | null
  numero_lot: string
  date_reception: string
  date_expiration?: string | null
  quantite_kg: number
  quantite_restante_kg: number
  certificat_url?: string | null
  notes?: string | null
  created_at: string
}

// ── Certificat de conformite (Sprint 3) ────────────────────

export interface CertificatConformite {
  id: string
  atelier_id: string
  projet_id: string
  numero: string
  type: 'standard' | 'qualicoat' | 'qualimarine' | 'gsb' | 'custom'
  data: {
    epaisseur_mesuree?: number
    adherence_ok?: boolean
    brillance_ok?: boolean
    durete_ok?: boolean
    temperature_cuisson?: number
    duree_cuisson?: number
    lot_poudre?: string
    operateur?: string
    remarques?: string
  }
  pdf_url?: string | null
  created_by: string
  created_at: string
}

// ── Webhook (Sprint 4) ─────────────────────────────────────

export interface WebhookConfig {
  id: string
  atelier_id: string
  url: string
  events: string[]
  secret?: string | null
  active: boolean
  last_triggered_at?: string | null
  last_status?: number | null
  failure_count: number
  created_at: string
}

// ── Pagination ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ── Dashboard Metrics ──────────────────────────────────────

export interface DashboardMetrics {
  ca_mois_courant: number
  ca_mois_precedent: number
  nb_factures_impayees: number
  montant_impaye: number
  nb_projets_en_cours: number
  nb_projets_en_retard: number
  nb_devis_en_attente: number
  total_devis: number
  devis_convertis: number
  devis_refuses: number
  taux_conversion: number
}

// ── API Types ──────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: string[]
}

export interface ApiSuccess<T = void> {
  success: true
  data?: T
  message?: string
}
