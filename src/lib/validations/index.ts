import { z } from 'zod'

// ── Schemas de validation API (Sprint 1) ──────────────────

// Statuts valides
export const ProjectStatusSchema = z.enum([
  'devis', 'en_cours', 'en_cuisson', 'qc', 'pret', 'livre', 'annule'
])

export const DevisStatusSchema = z.enum([
  'brouillon', 'envoye', 'accepte', 'refuse', 'expire', 'converted'
])

export const FactureStatusSchema = z.enum([
  'brouillon', 'envoyee', 'payee', 'remboursee'
])

export const PaymentStatusSchema = z.enum([
  'unpaid', 'partial', 'paid', 'refunded'
])

export const UserRoleSchema = z.enum(['owner', 'admin', 'operator', 'compta'])

// Transitions de statut valides pour les projets
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  devis: ['en_cours', 'annule'],
  en_cours: ['en_cuisson', 'annule'],
  en_cuisson: ['qc', 'en_cours', 'annule'],
  qc: ['pret', 'en_cuisson', 'en_cours'],
  pret: ['livre'],
  livre: [],
  annule: ['devis'],
}

// ── Contact Form ────────────────────────────────────────────

export const ContactFormSchema = z.object({
  name: z.string().min(2, 'Nom trop court').max(100, 'Nom trop long').trim(),
  email: z.string().email('Format email invalide').max(254),
  phone: z.string().max(20).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  subject: z.string().max(200).optional().nullable(),
  message: z.string().min(10, 'Message trop court').max(5000, 'Message trop long').trim(),
})

// ── Project Status Change ──────────────────────────────────

export const StatusChangeSchema = z.object({
  status: ProjectStatusSchema,
})

// ── Client ─────────────────────────────────────────────────

export const ClientCreateSchema = z.object({
  full_name: z.string().min(2).max(200).trim(),
  email: z.string().email().max(254),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  type: z.enum(['particulier', 'professionnel']).default('professionnel'),
  siret: z.string().regex(/^[0-9]{14}$/, 'SIRET invalide (14 chiffres)').optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(2000).optional().nullable(),
})

// ── Devis ──────────────────────────────────────────────────

export const DevisLigneSchema = z.object({
  designation: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  quantite: z.number().positive().max(99999),
  unite: z.string().max(50).default('piece'),
  prix_unitaire_ht: z.number().min(0).max(999999),
  tva_rate: z.number().min(0).max(100).default(20),
  remise_percent: z.number().min(0).max(100).default(0),
  poudre_id: z.string().uuid().optional().nullable(),
  surface_m2: z.number().positive().optional().nullable(),
  nb_couches: z.number().int().min(1).max(10).optional().nullable(),
})

export const DevisCreateSchema = z.object({
  client_id: z.string().uuid(),
  template_id: z.string().uuid().optional().nullable(),
  items: z.array(DevisLigneSchema).min(1, 'Au moins une ligne requise'),
  tva_rate: z.number().min(0).max(100).default(20),
  conditions: z.string().max(5000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  validite_jours: z.number().int().min(1).max(365).default(30),
})

// ── Projet ─────────────────────────────────────────────────

export const ProjetCreateSchema = z.object({
  client_id: z.string().uuid(),
  devis_id: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(200).trim(),
  poudre_id: z.string().uuid().optional().nullable(),
  couches: z.number().int().min(1).max(10).default(1),
  temp_cuisson: z.number().int().min(100).max(300).optional().nullable(),
  duree_cuisson: z.number().int().min(1).max(120).optional().nullable(),
  date_depot: z.string().optional().nullable(),
  date_promise: z.string().optional().nullable(),
  priorite: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  notes: z.string().max(2000).optional().nullable(),
})

// ── Facture ────────────────────────────────────────────────

export const FactureCreateSchema = z.object({
  client_id: z.string().uuid(),
  projet_id: z.string().uuid().optional().nullable(),
  devis_id: z.string().uuid().optional().nullable(),
  type: z.enum(['acompte', 'solde', 'complete']).default('complete'),
  items: z.array(DevisLigneSchema).min(1),
  tva_rate: z.number().min(0).max(100).default(20),
  payment_method: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  due_date: z.string().optional().nullable(),
})

// ── Poudre ─────────────────────────────────────────────────

export const PoudreCreateSchema = z.object({
  marque: z.string().min(1).max(200),
  reference: z.string().min(1).max(100),
  type: z.enum(['epoxy', 'polyester', 'epoxy-polyester', 'polyurethane', 'autre']),
  ral: z.string().max(20).optional().nullable(),
  finition: z.enum(['mat', 'satin', 'brillant', 'texture', 'metallic', 'autre']),
  densite: z.number().positive().max(10).optional().nullable(),
  epaisseur_conseillee: z.number().positive().max(1000).optional().nullable(),
  consommation_m2: z.number().positive().max(100).optional().nullable(),
  temp_cuisson: z.number().int().min(100).max(300).optional().nullable(),
  duree_cuisson: z.number().int().min(1).max(120).optional().nullable(),
  prix_kg: z.number().min(0).max(9999).optional().nullable(),
})

// ── Pagination (server-side) ───────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(200).optional(),
  sort: z.string().max(50).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

// ── Fournisseur (Sprint 3) ─────────────────────────────────

export const FournisseurCreateSchema = z.object({
  nom: z.string().min(2).max(200).trim(),
  contact_nom: z.string().max(200).optional().nullable(),
  email: z.string().email().max(254).optional().nullable(),
  telephone: z.string().max(20).optional().nullable(),
  adresse: z.string().max(500).optional().nullable(),
  siret: z.string().regex(/^[0-9]{14}$/).optional().nullable(),
  conditions_paiement: z.string().max(200).optional().nullable(),
  delai_livraison_jours: z.number().int().min(0).max(365).optional().nullable(),
  note_qualite: z.number().min(0).max(5).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

// ── Webhook (Sprint 4) ─────────────────────────────────────

export const WebhookCreateSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum([
    'projet.created', 'projet.status_changed', 'projet.completed',
    'devis.created', 'devis.signed', 'devis.refused',
    'facture.created', 'facture.paid',
    'client.created',
    'stock.low_alert',
  ])).min(1),
  secret: z.string().min(16).max(128).optional(),
  active: z.boolean().default(true),
})

// ── Utility ────────────────────────────────────────────────

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): {
  success: true; data: T
} | {
  success: false; errors: string[]
} {
  const result = schema.safeParse(body)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  }
}

// HTML escape for email templates
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
