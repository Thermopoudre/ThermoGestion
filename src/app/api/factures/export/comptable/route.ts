import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Export comptable pour Sage, EBP, Cegid
// Formats: sage, ebp, cegid, quadra

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)
    
    const format = searchParams.get('format') || 'sage'
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')
    const status = searchParams.get('status') // 'payee' ou 'all'

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Construire la requête
    let query = supabase
      .from('factures')
      .select(`
        *,
        clients (
          id,
          full_name,
          email,
          address,
          postal_code,
          city,
          siret,
          vat_number
        )
      `)
      .eq('atelier_id', userData.atelier_id)
      .order('date', { ascending: true })

    if (dateFrom) {
      query = query.gte('date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('date', dateTo)
    }
    if (status === 'payee') {
      query = query.eq('status', 'payee')
    } else {
      query = query.not('status', 'eq', 'brouillon')
    }

    const { data: factures, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!factures || factures.length === 0) {
      return NextResponse.json({ error: 'Aucune facture trouvée' }, { status: 404 })
    }

    // Générer l'export selon le format
    let content: string
    let filename: string
    let contentType: string

    switch (format) {
      case 'sage':
        content = generateSageExport(factures)
        filename = `export_sage_${dateFrom || 'all'}_${dateTo || 'all'}.txt`
        contentType = 'text/plain; charset=utf-8'
        break

      case 'ebp':
        content = generateEBPExport(factures)
        filename = `export_ebp_${dateFrom || 'all'}_${dateTo || 'all'}.csv`
        contentType = 'text/csv; charset=utf-8'
        break

      case 'cegid':
        content = generateCegidExport(factures)
        filename = `export_cegid_${dateFrom || 'all'}_${dateTo || 'all'}.txt`
        contentType = 'text/plain; charset=utf-8'
        break

      case 'quadra':
        content = generateQuadraExport(factures)
        filename = `export_quadra_${dateFrom || 'all'}_${dateTo || 'all'}.txt`
        contentType = 'text/plain; charset=utf-8'
        break

      default:
        return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Erreur export comptable:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Format Sage (fichier texte à positions fixes)
function generateSageExport(factures: any[]): string {
  const lines: string[] = []
  
  for (const facture of factures) {
    const client = facture.clients
    const date = new Date(facture.date)
    const dateStr = `${date.getDate().toString().padStart(2, '0')}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getFullYear()}`
    
    // Ligne client (débit)
    lines.push([
      'VTE', // Type mouvement
      dateStr, // Date
      'VT', // Journal
      facture.numero.padEnd(13), // Pièce
      '411000', // Compte client (à personnaliser)
      (client?.full_name || 'Client').substring(0, 35).padEnd(35), // Libellé
      'D', // Sens (Débit)
      formatAmount(facture.total_ttc, 13), // Montant
      '', // Échéance
      '', // Mode règlement
    ].join(';'))

    // Ligne produit (crédit HT)
    lines.push([
      'VTE',
      dateStr,
      'VT',
      facture.numero.padEnd(13),
      '706000', // Compte produit (à personnaliser)
      `Facture ${facture.numero}`.padEnd(35),
      'C', // Crédit
      formatAmount(facture.total_ht, 13),
      '',
      '',
    ].join(';'))

    // Ligne TVA (crédit)
    if (facture.total_tva > 0) {
      lines.push([
        'VTE',
        dateStr,
        'VT',
        facture.numero.padEnd(13),
        '445710', // Compte TVA collectée
        `TVA Facture ${facture.numero}`.padEnd(35),
        'C',
        formatAmount(facture.total_tva, 13),
        '',
        '',
      ].join(';'))
    }
  }

  return lines.join('\r\n')
}

// Format EBP (CSV)
function generateEBPExport(factures: any[]): string {
  const headers = [
    'Date',
    'Journal',
    'Compte',
    'Libellé',
    'Débit',
    'Crédit',
    'Pièce',
    'Échéance',
  ]
  
  const lines: string[][] = [headers]

  for (const facture of factures) {
    const client = facture.clients
    const date = formatDateFR(facture.date)
    
    // Client (débit)
    lines.push([
      date,
      'VT',
      '411000',
      `${client?.full_name || 'Client'} - ${facture.numero}`,
      formatDecimal(facture.total_ttc),
      '',
      facture.numero,
      facture.due_date ? formatDateFR(facture.due_date) : '',
    ])

    // Produit (crédit)
    lines.push([
      date,
      'VT',
      '706000',
      `Facture ${facture.numero}`,
      '',
      formatDecimal(facture.total_ht),
      facture.numero,
      '',
    ])

    // TVA (crédit)
    if (facture.total_tva > 0) {
      lines.push([
        date,
        'VT',
        '445710',
        `TVA ${facture.numero}`,
        '',
        formatDecimal(facture.total_tva),
        facture.numero,
        '',
      ])
    }
  }

  return lines.map(line => line.map(cell => `"${cell}"`).join(';')).join('\r\n')
}

// Format Cegid
function generateCegidExport(factures: any[]): string {
  const lines: string[] = []
  
  for (const facture of factures) {
    const client = facture.clients
    const date = new Date(facture.date)
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`
    
    // Client
    lines.push([
      'M', // Type
      'VT', // Journal
      dateStr,
      '411000',
      'D',
      formatAmount(facture.total_ttc, 15),
      facture.numero,
      client?.full_name || 'Client',
    ].join('\t'))

    // Produit
    lines.push([
      'M',
      'VT',
      dateStr,
      '706000',
      'C',
      formatAmount(facture.total_ht, 15),
      facture.numero,
      `Facture ${facture.numero}`,
    ].join('\t'))

    // TVA
    if (facture.total_tva > 0) {
      lines.push([
        'M',
        'VT',
        dateStr,
        '445710',
        'C',
        formatAmount(facture.total_tva, 15),
        facture.numero,
        `TVA ${facture.numero}`,
      ].join('\t'))
    }
  }

  return lines.join('\r\n')
}

// Format Quadra
function generateQuadraExport(factures: any[]): string {
  const lines: string[] = []
  let lineNum = 1
  
  for (const facture of factures) {
    const client = facture.clients
    const date = new Date(facture.date)
    const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
    
    // Client
    lines.push(`M;${lineNum};VT;${dateStr};411000;${client?.full_name || 'Client'};${facture.numero};D;${formatDecimal(facture.total_ttc)}`)
    lineNum++

    // Produit
    lines.push(`M;${lineNum};VT;${dateStr};706000;Facture ${facture.numero};;C;${formatDecimal(facture.total_ht)}`)
    lineNum++

    // TVA
    if (facture.total_tva > 0) {
      lines.push(`M;${lineNum};VT;${dateStr};445710;TVA ${facture.numero};;C;${formatDecimal(facture.total_tva)}`)
      lineNum++
    }
  }

  return lines.join('\r\n')
}

// Helpers
function formatAmount(amount: number, length: number): string {
  const cents = Math.round(amount * 100).toString()
  return cents.padStart(length, '0')
}

function formatDecimal(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}

function formatDateFR(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
}
