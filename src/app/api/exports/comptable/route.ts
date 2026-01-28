import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Export comptable multi-formats (QuickBooks, Sage, FEC)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    
    const body = await request.json()
    const { date_debut, date_fin, type } = body

    // Vérifier authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Récupérer les factures
    const { data: factures } = await supabase
      .from('factures')
      .select(`
        *,
        clients (full_name, email, address, siret)
      `)
      .eq('atelier_id', userData.atelier_id)
      .gte('created_at', date_debut)
      .lte('created_at', date_fin)
      .eq('status', 'sent')
      .order('created_at', { ascending: true })

    // Récupérer l'atelier
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('name, siret, address')
      .eq('id', userData.atelier_id)
      .single()

    let content: string
    let filename: string
    let contentType: string

    switch (format) {
      case 'quickbooks':
        content = generateQuickBooks(factures || [], atelier)
        filename = `export_quickbooks_${date_debut}_${date_fin}.iif`
        contentType = 'text/plain'
        break

      case 'sage':
        content = generateSage(factures || [], atelier)
        filename = `export_sage_${date_debut}_${date_fin}.txt`
        contentType = 'text/plain'
        break

      case 'fec':
        content = generateFEC(factures || [], atelier)
        filename = `FEC_${atelier?.siret || 'XXXXXX'}_${date_fin.replace(/-/g, '')}.txt`
        contentType = 'text/plain'
        break

      default:
        content = generateCSV(factures || [])
        filename = `export_factures_${date_debut}_${date_fin}.csv`
        contentType = 'text/csv'
    }

    // Enregistrer l'export
    await supabase.from('exports_comptables').insert({
      atelier_id: userData.atelier_id,
      type_export: format,
      date_debut,
      date_fin,
      nb_ecritures: factures?.length || 0,
      created_by: user.id,
    })

    return new NextResponse(content, {
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Erreur export comptable:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Format CSV simple
function generateCSV(factures: any[]): string {
  const headers = [
    'Date',
    'Numéro',
    'Client',
    'SIRET Client',
    'Montant HT',
    'TVA',
    'Montant TTC',
    'Statut Paiement',
    'Date Paiement'
  ]

  const rows = factures.map(f => [
    new Date(f.created_at).toLocaleDateString('fr-FR'),
    f.numero,
    f.clients?.full_name || '',
    f.clients?.siret || '',
    f.total_ht?.toFixed(2),
    (f.total_ttc - f.total_ht)?.toFixed(2),
    f.total_ttc?.toFixed(2),
    f.payment_status === 'paid' ? 'Payée' : 'Impayée',
    f.paid_at ? new Date(f.paid_at).toLocaleDateString('fr-FR') : ''
  ])

  return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
}

// Format QuickBooks IIF
function generateQuickBooks(factures: any[], atelier: any): string {
  const lines: string[] = [
    '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO',
    '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO',
    '!ENDTRNS'
  ]

  factures.forEach(f => {
    const date = new Date(f.created_at).toLocaleDateString('en-US')
    const clientName = f.clients?.full_name?.replace(/["\t\n]/g, ' ') || 'Client'
    
    // Ligne principale (créance client)
    lines.push(`TRNS\tINVOICE\t${date}\tComptes clients\t${clientName}\t${f.total_ttc?.toFixed(2)}\t${f.numero}\tFacture ${f.numero}`)
    
    // Ligne chiffre d'affaires
    lines.push(`SPL\tINVOICE\t${date}\tVentes\t${clientName}\t-${f.total_ht?.toFixed(2)}\t${f.numero}\t`)
    
    // Ligne TVA
    const tva = (f.total_ttc - f.total_ht)?.toFixed(2)
    lines.push(`SPL\tINVOICE\t${date}\tTVA collectée\t${clientName}\t-${tva}\t${f.numero}\t`)
    
    lines.push('ENDTRNS')
  })

  return lines.join('\n')
}

// Format Sage (format simplifié)
function generateSage(factures: any[], atelier: any): string {
  const lines: string[] = []

  factures.forEach((f, index) => {
    const dateCompta = new Date(f.created_at).toLocaleDateString('fr-FR').split('/').reverse().join('')
    const pieceNum = f.numero.replace(/[^0-9]/g, '')
    
    // Écriture client
    lines.push([
      'VE', // Journal Ventes
      dateCompta,
      '411000', // Compte client
      'D', // Débit
      f.total_ttc?.toFixed(2).replace('.', ','),
      f.clients?.full_name?.substring(0, 35) || 'CLIENT',
      pieceNum,
      f.numero
    ].join('\t'))

    // Écriture CA
    lines.push([
      'VE',
      dateCompta,
      '706000', // Prestations de services
      'C', // Crédit
      f.total_ht?.toFixed(2).replace('.', ','),
      f.clients?.full_name?.substring(0, 35) || 'CLIENT',
      pieceNum,
      f.numero
    ].join('\t'))

    // Écriture TVA
    const tva = (f.total_ttc - f.total_ht)?.toFixed(2).replace('.', ',')
    lines.push([
      'VE',
      dateCompta,
      '445710', // TVA collectée
      'C',
      tva,
      f.clients?.full_name?.substring(0, 35) || 'CLIENT',
      pieceNum,
      f.numero
    ].join('\t'))
  })

  return lines.join('\n')
}

// Format FEC (Fichier des Écritures Comptables - format légal français)
function generateFEC(factures: any[], atelier: any): string {
  const lines: string[] = []
  
  // En-tête FEC
  lines.push([
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
    'Idevise'
  ].join('\t'))

  let ecritureNum = 1

  factures.forEach(f => {
    const dateCompta = new Date(f.created_at).toISOString().split('T')[0].replace(/-/g, '')
    const clientCode = f.client_id?.substring(0, 8).toUpperCase() || '00000000'
    const clientLib = f.clients?.full_name?.substring(0, 35) || 'CLIENT'

    // Client (débit)
    lines.push([
      'VE',
      'VENTES',
      ecritureNum.toString().padStart(6, '0'),
      dateCompta,
      '411' + clientCode,
      'Client ' + clientLib,
      clientCode,
      clientLib,
      f.numero,
      dateCompta,
      'Facture ' + f.numero,
      f.total_ttc?.toFixed(2).replace('.', ','),
      '0,00',
      '',
      '',
      dateCompta,
      '',
      ''
    ].join('\t'))

    ecritureNum++

    // CA (crédit)
    lines.push([
      'VE',
      'VENTES',
      ecritureNum.toString().padStart(6, '0'),
      dateCompta,
      '706000',
      'Prestations de services',
      '',
      '',
      f.numero,
      dateCompta,
      'Facture ' + f.numero,
      '0,00',
      f.total_ht?.toFixed(2).replace('.', ','),
      '',
      '',
      dateCompta,
      '',
      ''
    ].join('\t'))

    ecritureNum++

    // TVA (crédit)
    const tva = (f.total_ttc - f.total_ht)?.toFixed(2).replace('.', ',')
    lines.push([
      'VE',
      'VENTES',
      ecritureNum.toString().padStart(6, '0'),
      dateCompta,
      '445710',
      'TVA collectée',
      '',
      '',
      f.numero,
      dateCompta,
      'Facture ' + f.numero,
      '0,00',
      tva,
      '',
      '',
      dateCompta,
      '',
      ''
    ].join('\t'))

    ecritureNum++
  })

  return lines.join('\n')
}
