// Utilitaires pour exports comptabilité (CSV, FEC)

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

/**
 * Générer le FEC comptable (Fichier des Écritures Comptables)
 * Format XML conforme à la réglementation française
 */
export function generateFEC(factures: Facture[], paiements: Paiement[]): string {
  const now = new Date()
  const dateExport = now.toISOString().split('T')[0]
  const heureExport = now.toTimeString().split(' ')[0]

  // Structure FEC simplifiée (format XML)
  const ecritures = factures.flatMap((facture) => {
    const ecritures: any[] = []

    // Écriture facture (vente)
    ecritures.push({
      JournalCode: 'VT', // Ventes
      JournalLib: 'Ventes',
      EcritureNum: facture.numero,
      EcritureDate: new Date(facture.created_at).toISOString().split('T')[0],
      CompteNum: '411', // Clients
      CompteLib: facture.clients?.full_name || 'Client',
      CompAuxNum: facture.clients?.siret || '',
      CompAuxLib: facture.clients?.full_name || '',
      PieceRef: facture.numero,
      PieceDate: new Date(facture.created_at).toISOString().split('T')[0],
      EcritureLib: `Facture ${facture.numero}`,
      Debit: Number(facture.total_ttc).toFixed(2),
      Credit: '0.00',
      EcritureLet: '',
      DateLet: '',
      ValidDate: new Date(facture.created_at).toISOString().split('T')[0],
      Montantdevise: '',
      Idevise: '',
    })

    // Écriture TVA collectée
    const tva = Number(facture.total_ttc) - Number(facture.total_ht)
    if (tva > 0) {
      ecritures.push({
        JournalCode: 'VT',
        JournalLib: 'Ventes',
        EcritureNum: facture.numero,
        EcritureDate: new Date(facture.created_at).toISOString().split('T')[0],
        CompteNum: '44571', // TVA collectée
        CompteLib: 'TVA collectée',
        CompAuxNum: '',
        CompAuxLib: '',
        PieceRef: facture.numero,
        PieceDate: new Date(facture.created_at).toISOString().split('T')[0],
        EcritureLib: `TVA ${facture.numero}`,
        Debit: '0.00',
        Credit: tva.toFixed(2),
        EcritureLet: '',
        DateLet: '',
        ValidDate: new Date(facture.created_at).toISOString().split('T')[0],
        Montantdevise: '',
        Idevise: '',
      })
    }

    // Écriture produit/vente
    ecritures.push({
      JournalCode: 'VT',
      JournalLib: 'Ventes',
      EcritureNum: facture.numero,
      EcritureDate: new Date(facture.created_at).toISOString().split('T')[0],
      CompteNum: '701', // Ventes de produits finis
      CompteLib: 'Ventes',
      CompAuxNum: '',
      CompAuxLib: '',
      PieceRef: facture.numero,
      PieceDate: new Date(facture.created_at).toISOString().split('T')[0],
      EcritureLib: `Vente ${facture.numero}`,
      Debit: '0.00',
      Credit: Number(facture.total_ht).toFixed(2),
      EcritureLet: '',
      DateLet: '',
      ValidDate: new Date(facture.created_at).toISOString().split('T')[0],
      Montantdevise: '',
      Idevise: '',
    })

    return ecritures
  })

  // Ajouter les écritures de paiement
  paiements.forEach((paiement) => {
    if (paiement.status === 'completed') {
      ecritures.push({
        JournalCode: 'BQ', // Banque
        JournalLib: 'Banque',
        EcritureNum: `PAY-${paiement.id.slice(0, 8)}`,
        EcritureDate: paiement.paid_at
          ? new Date(paiement.paid_at).toISOString().split('T')[0]
          : new Date(paiement.created_at).toISOString().split('T')[0],
        CompteNum: '512', // Banque
        CompteLib: 'Banque',
        CompAuxNum: '',
        CompAuxLib: '',
        PieceRef: paiement.payment_ref || paiement.id,
        PieceDate: paiement.paid_at
          ? new Date(paiement.paid_at).toISOString().split('T')[0]
          : new Date(paiement.created_at).toISOString().split('T')[0],
        EcritureLib: `Paiement ${paiement.type}`,
        Debit: '0.00',
        Credit: Number(paiement.amount).toFixed(2),
        EcritureLet: '',
        DateLet: '',
        ValidDate: paiement.paid_at
          ? new Date(paiement.paid_at).toISOString().split('T')[0]
          : new Date(paiement.created_at).toISOString().split('T')[0],
        Montantdevise: '',
        Idevise: '',
      })

      // Écriture contrepartie (débit client)
      const facture = factures.find((f) => f.id === paiement.facture_id)
      if (facture) {
        ecritures.push({
          JournalCode: 'BQ',
          JournalLib: 'Banque',
          EcritureNum: `PAY-${paiement.id.slice(0, 8)}`,
          EcritureDate: paiement.paid_at
            ? new Date(paiement.paid_at).toISOString().split('T')[0]
            : new Date(paiement.created_at).toISOString().split('T')[0],
          CompteNum: '411',
          CompteLib: facture.clients?.full_name || 'Client',
          CompAuxNum: facture.clients?.siret || '',
          CompAuxLib: facture.clients?.full_name || '',
          PieceRef: paiement.payment_ref || paiement.id,
          PieceDate: paiement.paid_at
            ? new Date(paiement.paid_at).toISOString().split('T')[0]
            : new Date(paiement.created_at).toISOString().split('T')[0],
          EcritureLib: `Paiement ${paiement.type}`,
          Debit: Number(paiement.amount).toFixed(2),
          Credit: '0.00',
          EcritureLet: '',
          DateLet: '',
          ValidDate: paiement.paid_at
            ? new Date(paiement.paid_at).toISOString().split('T')[0]
            : new Date(paiement.created_at).toISOString().split('T')[0],
          Montantdevise: '',
          Idevise: '',
        })
      }
    }
  })

  // Générer le XML FEC
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<FichierDesEcrituresComptables>
  <EnTete>
    <Fichier>
      <CodeFichier>FEC</CodeFichier>
      <DateExport>${dateExport}</DateExport>
      <HeureExport>${heureExport}</HeureExport>
      <Logiciel>ThermoGestion</Logiciel>
      <Version>1.0</Version>
    </Fichier>
  </EnTete>
  <Ecritures>
    ${ecritures
      .map(
        (e) => `
    <Ecriture>
      <JournalCode>${e.JournalCode}</JournalCode>
      <JournalLib>${e.JournalLib}</JournalLib>
      <EcritureNum>${e.EcritureNum}</EcritureNum>
      <EcritureDate>${e.EcritureDate}</EcritureDate>
      <CompteNum>${e.CompteNum}</CompteNum>
      <CompteLib>${e.CompteLib}</CompteLib>
      <CompAuxNum>${e.CompAuxNum || ''}</CompAuxNum>
      <CompAuxLib>${e.CompAuxLib || ''}</CompAuxLib>
      <PieceRef>${e.PieceRef}</PieceRef>
      <PieceDate>${e.PieceDate}</PieceDate>
      <EcritureLib>${e.EcritureLib}</EcritureLib>
      <Debit>${e.Debit}</Debit>
      <Credit>${e.Credit}</Credit>
      <EcritureLet>${e.EcritureLet || ''}</EcritureLet>
      <DateLet>${e.DateLet || ''}</DateLet>
      <ValidDate>${e.ValidDate}</ValidDate>
      <Montantdevise>${e.Montantdevise || ''}</Montantdevise>
      <Idevise>${e.Idevise || ''}</Idevise>
    </Ecriture>`
      )
      .join('')}
  </Ecritures>
</FichierDesEcrituresComptables>`

  return xml
}
