import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateBody } from '@/lib/validations'

const ExportSchema = z.object({
  periode_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periode_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['sage', 'ebp', 'cegid', 'fec', 'csv']).default('sage'),
})

const COMPTES = {
  CLIENT: '411000',
  VENTES: '706000',
  TVA_COLLECTEE: '445710',
  BANQUE: '512000',
}

// Support both GET (legacy) and POST
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  return handleExport(request, {
    periode_debut: searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    periode_fin: searchParams.get('to') || new Date().toISOString().split('T')[0],
    format: searchParams.get('format') || 'sage',
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  return handleExport(request, body)
}

async function handleExport(request: Request, params: unknown) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || !['owner', 'admin', 'compta'].includes(userData.role)) {
      return NextResponse.json({ error: 'Accès réservé à la comptabilité' }, { status: 403 })
    }

    const validation = validateBody(ExportSchema, params)
    if (!validation.success) {
      return NextResponse.json({ error: 'Paramètres invalides', details: validation.errors }, { status: 400 })
    }

    const { periode_debut, periode_fin, format } = validation.data

    const { data: factures, error } = await supabase
      .from('factures')
      .select('*, clients(full_name, email, siret)')
      .eq('atelier_id', userData.atelier_id)
      .gte('created_at', `${periode_debut}T00:00:00`)
      .lte('created_at', `${periode_fin}T23:59:59`)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!factures || factures.length === 0) {
      return NextResponse.json({ error: 'Aucune facture sur la période' }, { status: 404 })
    }

    let content: string
    let filename: string
    let contentType: string

    switch (format) {
      case 'sage':
        content = generateSageExport(factures)
        filename = `export-sage-${periode_debut}-${periode_fin}.txt`
        contentType = 'text/plain; charset=utf-8'
        break
      case 'ebp':
        content = generateEBPExport(factures)
        filename = `export-ebp-${periode_debut}-${periode_fin}.txt`
        contentType = 'text/plain; charset=utf-8'
        break
      case 'fec':
        content = generateFECExport(factures)
        filename = `FEC-${periode_debut.replace(/-/g, '')}-${periode_fin.replace(/-/g, '')}.txt`
        contentType = 'text/plain; charset=utf-8'
        break
      case 'cegid':
        content = generateCegidExport(factures)
        filename = `export-cegid-${periode_debut}-${periode_fin}.txt`
        contentType = 'text/plain; charset=utf-8'
        break
      case 'csv':
      default:
        content = generateCSVExport(factures)
        filename = `export-comptable-${periode_debut}-${periode_fin}.csv`
        contentType = 'text/csv; charset=utf-8'
        break
    }

    // Log the export
    await supabase.from('export_comptable_logs').insert({
      atelier_id: userData.atelier_id,
      type: format,
      periode_debut,
      periode_fin,
      nb_ecritures: factures.length,
      cree_par: user.id,
    }).catch(() => {}) // Non-blocking

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Erreur export comptable:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function generateSageExport(factures: any[]): string {
  const lines: string[] = []
  for (const f of factures) {
    const date = fmtDate(f.created_at)
    const clientName = getClientName(f).slice(0, 35)
    const tva = Number(f.total_ttc) - Number(f.total_ht)

    lines.push(`VE|${date}|${COMPTES.CLIENT}|${f.client_id?.slice(0, 8) || ''}|${f.numero} ${clientName}|${n(f.total_ttc)}|0.00|${f.numero}`)
    lines.push(`VE|${date}|${COMPTES.VENTES}||${f.numero} Prestation thermolaquage|0.00|${n(f.total_ht)}|${f.numero}`)
    if (tva > 0) {
      lines.push(`VE|${date}|${COMPTES.TVA_COLLECTEE}||${f.numero} TVA collectée|0.00|${n(tva)}|${f.numero}`)
    }
    if (f.payment_status === 'paid' && f.paid_at) {
      const pd = fmtDate(f.paid_at)
      lines.push(`BQ|${pd}|${COMPTES.BANQUE}||${f.numero} Encaissement|${n(f.total_ttc)}|0.00|${f.numero}`)
      lines.push(`BQ|${pd}|${COMPTES.CLIENT}|${f.client_id?.slice(0, 8) || ''}|${f.numero} Encaissement|0.00|${n(f.total_ttc)}|${f.numero}`)
    }
  }
  return lines.join('\r\n')
}

function generateEBPExport(factures: any[]): string {
  const lines = ['NumLigne;DateEcriture;CodeJournal;NumCompte;LibelleEcriture;MontantDebit;MontantCredit;NumPiece']
  let lineNum = 1
  for (const f of factures) {
    const date = fmtDateFR(f.created_at)
    const client = getClientName(f).slice(0, 40)
    const tva = Number(f.total_ttc) - Number(f.total_ht)
    lines.push(`${lineNum++};${date};VE;${COMPTES.CLIENT};${f.numero} - ${client};${n(f.total_ttc)};0.00;${f.numero}`)
    lines.push(`${lineNum++};${date};VE;${COMPTES.VENTES};${f.numero} - Prestation;0.00;${n(f.total_ht)};${f.numero}`)
    if (tva > 0) lines.push(`${lineNum++};${date};VE;${COMPTES.TVA_COLLECTEE};${f.numero} - TVA;0.00;${n(tva)};${f.numero}`)
  }
  return lines.join('\r\n')
}

function generateFECExport(factures: any[]): string {
  const header = 'JournalCode\tJournalLib\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tCompAuxNum\tCompAuxLib\tPieceRef\tPieceDate\tEcritureLib\tDebit\tCredit\tEcritureLet\tDateLet\tValidDate\tMontantdevise\tIdevise'
  const lines = [header]
  let ecNum = 1
  for (const f of factures) {
    const date = fmtDateISO(f.created_at)
    const client = getClientName(f).slice(0, 40)
    const tva = Number(f.total_ttc) - Number(f.total_ht)
    const num = String(ecNum).padStart(6, '0')
    lines.push(`VE\tVentes\t${num}\t${date}\t${COMPTES.CLIENT}\tClients\t${f.client_id?.slice(0, 8) || ''}\t${client}\t${f.numero}\t${date}\t${f.numero} ${client}\t${n(f.total_ttc)}\t0.00\t\t\t${date}\t\t`)
    lines.push(`VE\tVentes\t${num}\t${date}\t${COMPTES.VENTES}\tPrestations\t\t\t${f.numero}\t${date}\t${f.numero} Prestation\t0.00\t${n(f.total_ht)}\t\t\t${date}\t\t`)
    if (tva > 0) lines.push(`VE\tVentes\t${num}\t${date}\t${COMPTES.TVA_COLLECTEE}\tTVA\t\t\t${f.numero}\t${date}\t${f.numero} TVA\t0.00\t${n(tva)}\t\t\t${date}\t\t`)
    ecNum++
  }
  return lines.join('\r\n')
}

function generateCegidExport(factures: any[]): string {
  const lines = ['CodeJournal;DateEcriture;CompteGeneral;CompteAuxiliaire;Reference;Libelle;Debit;Credit']
  for (const f of factures) {
    const date = fmtDateFR(f.created_at)
    const client = getClientName(f).slice(0, 35)
    const tva = Number(f.total_ttc) - Number(f.total_ht)
    lines.push(`VE;${date};${COMPTES.CLIENT};${f.client_id?.slice(0, 8) || ''};${f.numero};${client};${n(f.total_ttc)};`)
    lines.push(`VE;${date};${COMPTES.VENTES};;${f.numero};Prestation;;${n(f.total_ht)}`)
    if (tva > 0) lines.push(`VE;${date};${COMPTES.TVA_COLLECTEE};;${f.numero};TVA;;${n(tva)}`)
  }
  return lines.join('\r\n')
}

function generateCSVExport(factures: any[]): string {
  const lines = ['Date;Numero;Client;HT;TVA;TTC;Statut;Paiement;Date Paiement']
  for (const f of factures) {
    const tva = Number(f.total_ttc) - Number(f.total_ht)
    lines.push(`${fmtDateFR(f.created_at)};${f.numero};${getClientName(f).replace(/;/g, ',')};${n(f.total_ht)};${n(tva)};${n(f.total_ttc)};${f.status};${f.payment_status};${f.paid_at ? fmtDateFR(f.paid_at) : ''}`)
  }
  return '\uFEFF' + lines.join('\r\n')
}

function getClientName(f: any): string { return f.clients?.full_name || 'Client' }
function n(v: number | string): string { return Number(v).toFixed(2) }
function fmtDate(d: string): string { return d.split('T')[0].replace(/-/g, '') }
function fmtDateFR(d: string): string { return new Date(d).toLocaleDateString('fr-FR') }
function fmtDateISO(d: string): string { return d.split('T')[0].replace(/-/g, '') }
