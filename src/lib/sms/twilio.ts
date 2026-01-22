import { createClient } from '@supabase/supabase-js'

interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
}

interface SendSmsParams {
  to: string
  message: string
  atelierId: string
  clientId?: string
  projetId?: string
  type?: 'status_update' | 'rappel' | 'promo' | 'custom'
}

interface SmsTemplate {
  key: string
  template: string
}

// Templates SMS par défaut
export const defaultSmsTemplates: Record<string, string> = {
  projet_en_cours: "Bonjour {client_name}, votre projet {projet_numero} est maintenant en cours de traitement. - {atelier_name}",
  projet_pret: "Bonjour {client_name}, votre projet {projet_numero} est prêt ! Vous pouvez venir le récupérer. - {atelier_name}",
  projet_livre: "Bonjour {client_name}, votre projet {projet_numero} a été livré. Merci de votre confiance ! - {atelier_name}",
  devis_envoye: "Bonjour {client_name}, votre devis {devis_numero} est disponible. Consultez-le ici : {devis_url} - {atelier_name}",
  facture_payee: "Bonjour {client_name}, nous confirmons la réception de votre paiement pour la facture {facture_numero}. Merci ! - {atelier_name}",
  rappel_paiement: "Bonjour {client_name}, un rappel pour la facture {facture_numero} d'un montant de {montant}€. - {atelier_name}",
}

// Fonction pour remplacer les variables dans un template
export function parseTemplate(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value || '')
  }
  return result
}

// Formater le numéro de téléphone au format E.164
export function formatPhoneNumber(phone: string, defaultCountryCode = '+33'): string {
  // Supprimer tous les caractères non numériques sauf le +
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // Si commence par 0, remplacer par le code pays
  if (cleaned.startsWith('0')) {
    cleaned = defaultCountryCode + cleaned.substring(1)
  }
  
  // Si ne commence pas par +, ajouter le code pays
  if (!cleaned.startsWith('+')) {
    cleaned = defaultCountryCode + cleaned
  }
  
  return cleaned
}

// Envoyer un SMS via Twilio
export async function sendSms(params: SendSmsParams, config: TwilioConfig): Promise<{ success: boolean; sid?: string; error?: string }> {
  const { to, message, atelierId, clientId, projetId, type } = params
  const { accountSid, authToken, phoneNumber } = config
  
  const formattedTo = formatPhoneNumber(to)
  
  // Créer le client Supabase admin pour logger
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Appel API Twilio
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: phoneNumber,
          Body: message,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      // Logger l'erreur
      await supabaseAdmin.from('sms_logs').insert({
        atelier_id: atelierId,
        client_id: clientId || null,
        projet_id: projetId || null,
        phone_number: formattedTo,
        message,
        type: type || 'custom',
        status: 'failed',
        error_message: data.message || 'Unknown error',
      })
      
      return { success: false, error: data.message || 'Failed to send SMS' }
    }

    // Logger le succès
    await supabaseAdmin.from('sms_logs').insert({
      atelier_id: atelierId,
      client_id: clientId || null,
      projet_id: projetId || null,
      phone_number: formattedTo,
      message,
      type: type || 'custom',
      status: 'sent',
      twilio_sid: data.sid,
      sent_at: new Date().toISOString(),
    })

    return { success: true, sid: data.sid }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Logger l'erreur
    await supabaseAdmin.from('sms_logs').insert({
      atelier_id: atelierId,
      client_id: clientId || null,
      projet_id: projetId || null,
      phone_number: formattedTo,
      message,
      type: type || 'custom',
      status: 'failed',
      error_message: errorMessage,
    })
    
    return { success: false, error: errorMessage }
  }
}

// Envoyer un SMS de notification de statut projet
export async function sendProjetStatusSms(
  atelierId: string,
  projetId: string,
  clientPhone: string,
  clientName: string,
  projetNumero: string,
  status: string,
  atelierName: string,
  config: TwilioConfig,
  customTemplates?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const templates = { ...defaultSmsTemplates, ...customTemplates }
  
  // Déterminer le template à utiliser
  let templateKey = ''
  switch (status) {
    case 'en_cours':
    case 'en_cuisson':
      templateKey = 'projet_en_cours'
      break
    case 'pret':
    case 'qc':
      templateKey = 'projet_pret'
      break
    case 'livre':
      templateKey = 'projet_livre'
      break
    default:
      return { success: false, error: 'No template for this status' }
  }

  const template = templates[templateKey]
  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  const message = parseTemplate(template, {
    client_name: clientName,
    projet_numero: projetNumero,
    atelier_name: atelierName,
  })

  return sendSms({
    to: clientPhone,
    message,
    atelierId,
    projetId,
    type: 'status_update',
  }, config)
}
