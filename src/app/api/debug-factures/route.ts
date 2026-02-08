import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  // Désactivé en production — endpoint de debug uniquement
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint désactivé en production' }, { status: 403 })
  }

  try {
    const supabase = await createServerClient()

    // Get auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      return NextResponse.json({ 
        step: 'auth',
        error: authError.message 
      })
    }

    if (!user) {
      return NextResponse.json({ 
        step: 'auth',
        error: 'No user found' 
      })
    }

    // Get user data with atelier join
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`*, ateliers (*)`)
      .eq('id', user.id)
      .single()

    if (userError) {
      return NextResponse.json({ 
        step: 'userData',
        userId: user.id,
        error: userError.message 
      })
    }

    // Extract atelier
    let atelier = Array.isArray(userData.ateliers) ? userData.ateliers[0] : userData.ateliers
    if ((!atelier || !atelier.id) && userData.atelier_id) {
      const { data: atelierDirect } = await supabase
        .from('ateliers')
        .select('*')
        .eq('id', userData.atelier_id)
        .single()
      atelier = atelierDirect
    }

    if (!atelier || !atelier.id) {
      return NextResponse.json({ 
        step: 'atelier',
        userData: { atelier_id: userData.atelier_id },
        ateliers: userData.ateliers,
        error: 'No atelier found' 
      })
    }

    // Query factures
    const { data: factures, error: facturesError } = await supabase
      .from('factures')
      .select('id, numero, total_ttc, payment_status')
      .eq('atelier_id', atelier.id)

    return NextResponse.json({
      success: true,
      userId: user.id,
      userEmail: user.email,
      atelierId: atelier.id,
      atelierName: atelier.name,
      facturesCount: factures?.length || 0,
      factures: factures,
      facturesError: facturesError?.message || null
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}
