/**
 * Utilitaire partagé pour les labels et couleurs de statut
 * Utilisé par l'espace client et le back-office pour cohérence
 */

// ── Statuts projets ──────────────────────────────────────────
export const projetStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  devis: { label: 'Devis', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  reception: { label: 'Réceptionné', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  recu: { label: 'Reçu', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  en_preparation: { label: 'En préparation', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  en_cours: { label: 'En production', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  en_cuisson: { label: 'Cuisson', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  qc: { label: 'Contrôle qualité', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  termine: { label: 'Terminé', color: 'text-green-700', bgColor: 'bg-green-100' },
  pret: { label: 'Prêt à retirer', color: 'text-green-700', bgColor: 'bg-green-100' },
  livre: { label: 'Livré', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  annule: { label: 'Annulé', color: 'text-red-700', bgColor: 'bg-red-100' },
}

export function getProjetStatusLabel(status: string): string {
  return projetStatusConfig[status]?.label || status
}

export function getProjetStatusColor(status: string): string {
  const config = projetStatusConfig[status]
  return config ? `${config.bgColor} ${config.color}` : 'bg-gray-100 text-gray-700'
}

// ── Statuts devis ────────────────────────────────────────────
export const devisStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Brouillon', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  brouillon: { label: 'Brouillon', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  sent: { label: 'Envoyé', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  envoye: { label: 'Envoyé', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  signed: { label: 'Accepté', color: 'text-green-700', bgColor: 'bg-green-100' },
  accepte: { label: 'Accepté', color: 'text-green-700', bgColor: 'bg-green-100' },
  refused: { label: 'Refusé', color: 'text-red-700', bgColor: 'bg-red-100' },
  refuse: { label: 'Refusé', color: 'text-red-700', bgColor: 'bg-red-100' },
  expired: { label: 'Expiré', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  expire: { label: 'Expiré', color: 'text-orange-700', bgColor: 'bg-orange-100' },
}

export function getDevisStatusLabel(status: string): string {
  return devisStatusConfig[status]?.label || status
}

export function getDevisStatusColor(status: string): string {
  const config = devisStatusConfig[status]
  return config ? `${config.bgColor} ${config.color}` : 'bg-gray-100 text-gray-700'
}

// ── Statuts factures ─────────────────────────────────────────
export const facturePaymentConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  paid: { label: 'Payée', color: 'text-green-700', bgColor: 'bg-green-100' },
  unpaid: { label: 'À payer', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  partial: { label: 'Partiel', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  overdue: { label: 'En retard', color: 'text-red-700', bgColor: 'bg-red-100' },
}

export function getFacturePaymentLabel(status: string): string {
  return facturePaymentConfig[status]?.label || status
}

export function getFacturePaymentColor(status: string): string {
  const config = facturePaymentConfig[status]
  return config ? `${config.bgColor} ${config.color}` : 'bg-gray-100 text-gray-700'
}
