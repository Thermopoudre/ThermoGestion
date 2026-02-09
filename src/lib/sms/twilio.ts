/**
 * Service SMS via Twilio
 * Documentation: https://www.twilio.com/docs/sms
 * 
 * Variables d'environnement requises:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (format: +33xxxxxxxxx)
 */

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01'

interface SMSConfig {
  accountSid: string
  authToken: string
  fromNumber: string
}

function getConfig(): SMSConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return null
  }

  return { accountSid, authToken, fromNumber }
}

/**
 * Envoyer un SMS via Twilio
 */
export async function sendSMS(
  to: string, 
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const config = getConfig()
  
  if (!config) {
    console.warn('[SMS] Twilio non configuré - SMS non envoyé')
    return { success: false, error: 'Twilio non configuré' }
  }

  // Formater le numéro français
  let formattedTo = to.replace(/\s/g, '').replace(/^0/, '+33')
  if (!formattedTo.startsWith('+')) {
    formattedTo = `+33${formattedTo}`
  }

  try {
    const url = `${TWILIO_API_URL}/Accounts/${config.accountSid}/Messages.json`
    
    const params = new URLSearchParams()
    params.append('To', formattedTo)
    params.append('From', config.fromNumber)
    params.append('Body', body)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (response.ok) {
      const data = await response.json()
      return { success: true, sid: data.sid }
    } else {
      const error = await response.json()
      console.error('[SMS] Erreur Twilio:', error)
      return { success: false, error: error.message || 'Erreur Twilio' }
    }
  } catch (error) {
    console.error('[SMS] Erreur envoi:', error)
    return { success: false, error: 'Erreur réseau' }
  }
}

/**
 * Templates de SMS prédéfinis pour le thermolaquage
 */
export const SMS_TEMPLATES = {
  projet_recu: (nom: string, ref: string) =>
    `[ThermoGestion] Bonjour ${nom}, votre projet ${ref} a bien été réceptionné. Vous serez informé de son avancement.`,
  
  projet_en_cours: (nom: string, ref: string) =>
    `[ThermoGestion] ${nom}, votre projet ${ref} est en cours de traitement dans notre atelier.`,
  
  projet_termine: (nom: string, ref: string) =>
    `[ThermoGestion] ${nom}, votre projet ${ref} est terminé ! Vous pouvez venir le récupérer. Merci de votre confiance.`,
  
  devis_envoye: (nom: string, ref: string) =>
    `[ThermoGestion] ${nom}, votre devis ${ref} est disponible. Consultez-le en ligne ou contactez-nous pour toute question.`,
  
  facture_envoyee: (nom: string, ref: string, montant: string) =>
    `[ThermoGestion] ${nom}, votre facture ${ref} de ${montant} EUR est disponible. Merci de procéder au règlement.`,
  
  rappel_paiement: (nom: string, ref: string, montant: string) =>
    `[ThermoGestion] ${nom}, rappel: votre facture ${ref} de ${montant} EUR est en attente de paiement. Merci de régulariser.`,
  
  relance_devis: (nom: string, ref: string) =>
    `[ThermoGestion] ${nom}, votre devis ${ref} expire bientôt. N'hésitez pas à nous contacter pour toute question.`,
}

/**
 * Vérifier si les SMS sont configurés
 */
export function isSMSEnabled(): boolean {
  return getConfig() !== null
}

/**
 * Envoyer une notification SMS à un client en fonction de l'événement
 */
export async function sendClientSMS(
  clientPhone: string | null,
  clientName: string,
  template: keyof typeof SMS_TEMPLATES,
  params: string[]
): Promise<boolean> {
  if (!clientPhone) return false
  if (!isSMSEnabled()) return false

  const templateFn = SMS_TEMPLATES[template] as (...args: string[]) => string
  if (!templateFn) return false

  const message = templateFn(clientName, ...params)
  const result = await sendSMS(clientPhone, message)
  
  return result.success
}
