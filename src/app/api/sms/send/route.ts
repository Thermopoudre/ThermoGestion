import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sendSms, formatPhoneNumber, parseTemplate, defaultSmsTemplates } from '@/lib/sms/twilio'

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'atelier de l'utilisateur
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Récupérer la config Twilio de l'atelier
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('id, name, sms_enabled, twilio_account_sid, twilio_auth_token, twilio_phone_number, sms_templates')
      .eq('id', userData.atelier_id)
      .single()

    if (!atelier?.sms_enabled) {
      return NextResponse.json({ error: 'SMS non activé pour cet atelier' }, { status: 400 })
    }

    if (!atelier.twilio_account_sid || !atelier.twilio_auth_token || !atelier.twilio_phone_number) {
      return NextResponse.json({ error: 'Configuration Twilio incomplète' }, { status: 400 })
    }

    const body = await request.json()
    const { 
      clientId, 
      projetId, 
      phoneNumber, 
      message, 
      templateKey, 
      variables,
      type = 'custom'
    } = body

    // Validation
    if (!phoneNumber && !clientId) {
      return NextResponse.json({ error: 'Numéro de téléphone ou client requis' }, { status: 400 })
    }

    // Si clientId fourni, récupérer le téléphone du client
    let finalPhoneNumber = phoneNumber
    let clientData = null

    if (clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('phone, full_name, sms_optin, sms_notifications')
        .eq('id', clientId)
        .eq('atelier_id', userData.atelier_id)
        .single()

      if (!client) {
        return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 })
      }

      if (!client.phone) {
        return NextResponse.json({ error: 'Client sans numéro de téléphone' }, { status: 400 })
      }

      if (!client.sms_optin) {
        return NextResponse.json({ error: 'Client n\'a pas accepté les SMS' }, { status: 400 })
      }

      // Vérifier les préférences de notification
      const notifications = client.sms_notifications || {}
      if (type !== 'custom' && !notifications[type]) {
        return NextResponse.json({ error: `Client a désactivé les notifications ${type}` }, { status: 400 })
      }

      finalPhoneNumber = client.phone
      clientData = client
    }

    // Construire le message
    let finalMessage = message

    if (templateKey) {
      const templates = { ...defaultSmsTemplates, ...(atelier.sms_templates || {}) }
      const template = templates[templateKey]
      
      if (!template) {
        return NextResponse.json({ error: 'Template non trouvé' }, { status: 400 })
      }

      finalMessage = parseTemplate(template, {
        ...variables,
        atelier_name: atelier.name,
        client_name: clientData?.full_name || variables?.client_name || ''
      })
    }

    if (!finalMessage) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 })
    }

    // Envoyer le SMS
    const result = await sendSms(
      {
        to: finalPhoneNumber,
        message: finalMessage,
        atelierId: userData.atelier_id,
        clientId: clientId || undefined,
        projetId: projetId || undefined,
        type: type as any
      },
      {
        accountSid: atelier.twilio_account_sid,
        authToken: atelier.twilio_auth_token,
        phoneNumber: atelier.twilio_phone_number
      }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      sid: result.sid,
      message: 'SMS envoyé avec succès'
    })

  } catch (error) {
    console.error('SMS API error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi du SMS' },
      { status: 500 }
    )
  }
}

// GET - Récupérer les templates SMS disponibles
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
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

    const { data: atelier } = await supabase
      .from('ateliers')
      .select('sms_enabled, sms_templates')
      .eq('id', userData.atelier_id)
      .single()

    const templates = { ...defaultSmsTemplates, ...(atelier?.sms_templates || {}) }

    return NextResponse.json({
      enabled: atelier?.sms_enabled || false,
      templates
    })

  } catch (error) {
    console.error('SMS templates error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des templates' },
      { status: 500 }
    )
  }
}
