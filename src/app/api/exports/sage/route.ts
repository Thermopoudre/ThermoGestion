/**
 * API Route: Export comptable format Sage / EBP / Ciel
 * 
 * GET /api/exports/sage?from=2026-01-01&to=2026-02-28&format=sage
 * 
 * Formats supportés: sage, ebp, ciel
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export async function GET(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString()
    const to = searchParams.get('to') || new Date().toISOString()
    const format = searchParams.get('format') || 'sage'

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

    // Récupérer les factures
    const { data: factures } = await supabase
      .from('factures')
      .select('*, clients(full_name, siret, tva_intra)')
      .eq('atelier_id', userData.atelier_id)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at')

    if (!factures || factures.length === 0) {
      return NextResponse.json({ error: 'Aucune facture sur la période' }, { status: 404 })
    }

    let csvContent = ''
    const filename = `export_${format}_${from.split('T')[0]}_${to.split('T')[0]}.csv`

    if (format === 'sage') {
      // Format Sage Compta
      csvContent = 'JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;CompAuxNum;CompAuxLib;PieceRef;PieceDate;EcritureLib;Debit;Credit;EcritureLet;DateLet;ValidDate;Montantdevise;Idevise\n'
      
      for (const f of factures) {
        const date = new Date(f.created_at).toLocaleDateString('fr-FR')
        const clientName = (f.clients as any)?.full_name || 'Client'
        
        // Ligne vente (crédit)
        csvContent += `VE;VENTES;${f.numero};${date};706000;Prestations de services;;${clientName};${f.numero};${date};${f.numero} - ${clientName};;${Number(f.total_ht).toFixed(2)};;;${date};;EUR\n`
        
        // Ligne TVA (crédit)
        if (Number(f.total_ttc) > Number(f.total_ht)) {
          const tva = (Number(f.total_ttc) - Number(f.total_ht)).toFixed(2)
          csvContent += `VE;VENTES;${f.numero};${date};445710;TVA collectée;;;${f.numero};${date};TVA ${f.numero};;${tva};;;${date};;EUR\n`
        }
        
        // Ligne client (débit)
        csvContent += `VE;VENTES;${f.numero};${date};411000;Clients;${(f.clients as any)?.siret || ''};${clientName};${f.numero};${date};${f.numero} - ${clientName};${Number(f.total_ttc).toFixed(2)};;;;${date};;EUR\n`
      }
    } else if (format === 'ebp') {
      // Format EBP
      csvContent = 'Ligne;Date;Journal;Compte;Libellé;Débit;Crédit;Numéro de pièce\n'
      let ligne = 1
      
      for (const f of factures) {
        const date = new Date(f.created_at).toLocaleDateString('fr-FR')
        const clientName = (f.clients as any)?.full_name || 'Client'
        
        csvContent += `${ligne++};${date};VE;411000;${clientName} - ${f.numero};${Number(f.total_ttc).toFixed(2)};;${f.numero}\n`
        csvContent += `${ligne++};${date};VE;706000;Prestation ${f.numero};;${Number(f.total_ht).toFixed(2)};${f.numero}\n`
        if (Number(f.total_ttc) > Number(f.total_ht)) {
          csvContent += `${ligne++};${date};VE;445710;TVA ${f.numero};;${(Number(f.total_ttc) - Number(f.total_ht)).toFixed(2)};${f.numero}\n`
        }
      }
    } else {
      // Format Ciel
      csvContent = 'Date;Code journal;Numéro de compte;Numéro de pièce;Libellé;Montant débit;Montant crédit\n'
      
      for (const f of factures) {
        const date = new Date(f.created_at).toLocaleDateString('fr-FR')
        const clientName = (f.clients as any)?.full_name || 'Client'
        
        csvContent += `${date};VE;411000;${f.numero};${clientName};${Number(f.total_ttc).toFixed(2)};\n`
        csvContent += `${date};VE;706000;${f.numero};Prestation;;${Number(f.total_ht).toFixed(2)}\n`
        if (Number(f.total_ttc) > Number(f.total_ht)) {
          csvContent += `${date};VE;445710;${f.numero};TVA;;${(Number(f.total_ttc) - Number(f.total_ht)).toFixed(2)}\n`
        }
      }
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
