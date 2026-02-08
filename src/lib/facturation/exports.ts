// Utilitaires pour exports comptabilité (CSV, FEC)
// FEC conforme à l'arrêté du 29 juillet 2013 (art. L47 A du LPF)

import type { Database } from '@/types/database.types'

type Facture = Database['public']['Tables']['factures']['Row'] & {
  clients?: Database['public']['Tables']['clients']['Row']
}

type Paiement = Database['public']['Tables']['paiements']['Row']

/**
 * Exporter les factures en CSV
 */
export function exportFacturesCSV(factures: Facture[]): string {
  const headers = [
    'Numéro',
    'Date',
    'Client',
    'Type',
    'Total HT',
    'TVA',
    'Total TTC',
    'Statut',
    'Paiement',
    'Date paiement',
  ]

  const rows = factures.map((facture) => [
    facture.numero,
    new Date(facture.created_at).toLocaleDateString('fr-FR'),
    facture.clients?.full_name || '',
    facture.type,
    Number(facture.total_ht).toFixed(2),
    Number(facture.total_ttc) - Number(facture.total_ht),
    Number(facture.total_ttc).toFixed(2),
    facture.status,
    facture.payment_status,
    facture.paid_at ? new Date(facture.paid_at).toLocaleDateString('fr-FR') : '',
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  return csvContent
}

// ─── Utilitaires FEC ───

/** Formater une date au format AAAAMMJJ (obligatoire FEC) */
function formatDateFEC(dateStr: string): string {
  const d = new Date(dateStr)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/** Formater un montant avec virgule (obligatoire FEC français) */
function formatMontant(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/** Échapper les caractères spéciaux dans les valeurs TSV */
function escapeField(value: string): string {
  return (value || '').replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '')
}

/**
 * Générer le FEC comptable (Fichier des Écritures Comptables)
 * 
 * FORMAT CONFORME à l'arrêté du 29 juillet 2013 :
 * - Texte tabulé (TSV), séparateur tabulation (\t)
 * - Encodage UTF-8 avec BOM
 * - Dates au format AAAAMMJJ (sans tirets)
 * - Montants avec virgule comme séparateur décimal
 * - 18 colonnes obligatoires dans l'ordre défini par l'arrêté
 * 
 * Référence : Article L47 A du Livre des procédures fiscales
 */
export function generateFEC(factures: Facture[], paiements: Paiement[]): string {
  // En-têtes obligatoires (18 colonnes, ordre imposé par l'arrêté)
  const headers = [
    'JournalCode',
    'JournalLib',
    'EcritureNum',
    'EcritureDate',
    'CompteNum',
    'CompteLib',
    'CompAuxNum',
    'CompAuxLib',
    'PieceRef',
    'PieceDate',
    'EcritureLib',
    'Debit',
    'Credit',
    'EcritureLet',
    'DateLet',
    'ValidDate',
    'Montantdevise',
    'Idevise',
  ]

  const lignes: string[][] = []

  // --- Écritures de ventes (journal VT) ---
  factures.forEach((facture) => {
    const dateEcriture = formatDateFEC(facture.created_at)
    const clientName = escapeField(facture.clients?.full_name || 'Client')
    const clientSiret = escapeField(facture.clients?.siret || '')
    const tva = Number(facture.total_ttc) - Number(facture.total_ht)

    // Ligne 1 : Débit client (411)
    lignes.push([
      'VT',
      'Journal des ventes',
      escapeField(facture.numero),
      dateEcriture,
      '411000',
      clientName,
      clientSiret,
      clientName,
      escapeField(facture.numero),
      dateEcriture,
      `Facture ${escapeField(facture.numero)}`,
      formatMontant(Number(facture.total_ttc)),
      formatMontant(0),
      '',
      '',
      dateEcriture,
      '',
      '',
    ])

    // Ligne 2 : Crédit CA (701 produits finis / 706 services)
    const compteCA = facture.type === 'acompte' ? '706000' : '701000'
    const libelleCA = facture.type === 'acompte' ? 'Prestations de services' : 'Ventes de produits finis'
    lignes.push([
      'VT',
      'Journal des ventes',
      escapeField(facture.numero),
      dateEcriture,
      compteCA,
      libelleCA,
      '',
      '',
      escapeField(facture.numero),
      dateEcriture,
      `CA ${escapeField(facture.numero)}`,
      formatMontant(0),
      formatMontant(Number(facture.total_ht)),
      '',
      '',
      dateEcriture,
      '',
      '',
    ])

    // Ligne 3 : Crédit TVA collectée (44571x selon taux)
    if (tva > 0) {
      const tauxTva = Number(facture.tva_rate) || 20
      let compteTva = '445710' // 20% par défaut
      if (tauxTva === 10) compteTva = '445711'
      else if (tauxTva === 5.5) compteTva = '445712'
      else if (tauxTva === 2.1) compteTva = '445713'

      lignes.push([
        'VT',
        'Journal des ventes',
        escapeField(facture.numero),
        dateEcriture,
        compteTva,
        `TVA collectee ${tauxTva}%`,
        '',
        '',
        escapeField(facture.numero),
        dateEcriture,
        `TVA ${escapeField(facture.numero)} (${tauxTva}%)`,
        formatMontant(0),
        formatMontant(tva),
        '',
        '',
        dateEcriture,
        '',
        '',
      ])
    }
  })

  // --- Écritures de paiement (journal BQ) ---
  paiements.forEach((paiement) => {
    if (paiement.status !== 'completed') return

    const datePaiement = formatDateFEC(paiement.paid_at || paiement.created_at)
    const pieceRef = escapeField(paiement.payment_ref || `PAY-${paiement.id.slice(0, 8)}`)
    const facture = factures.find((f) => f.id === paiement.facture_id)
    const clientName = facture ? escapeField(facture.clients?.full_name || 'Client') : 'Client'
    const clientSiret = facture ? escapeField(facture.clients?.siret || '') : ''

    // Ligne 1 : Débit banque (512)
    lignes.push([
      'BQ',
      'Journal de banque',
      pieceRef,
      datePaiement,
      '512000',
      'Banque',
      '',
      '',
      pieceRef,
      datePaiement,
      `Reglement ${facture ? escapeField(facture.numero) : ''}`,
      formatMontant(Number(paiement.amount)),
      formatMontant(0),
      '',
      '',
      datePaiement,
      '',
      '',
    ])

    // Ligne 2 : Crédit client (411)
    lignes.push([
      'BQ',
      'Journal de banque',
      pieceRef,
      datePaiement,
      '411000',
      clientName,
      clientSiret,
      clientName,
      pieceRef,
      datePaiement,
      `Reglement ${facture ? escapeField(facture.numero) : ''}`,
      formatMontant(0),
      formatMontant(Number(paiement.amount)),
      '',
      '',
      datePaiement,
      '',
      '',
    ])
  })

  // Construire le fichier TSV conforme (BOM UTF-8 + en-tête + lignes)
  const BOM = '\uFEFF'
  const headerLine = headers.join('\t')
  const dataLines = lignes.map((l) => l.join('\t')).join('\n')

  return BOM + headerLine + '\n' + dataLines
}
