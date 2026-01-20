// Déclencheurs automatiques de notifications push
// Appelés lors d'événements importants

import { sendPushNotificationToAtelier } from './push'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row']
type Devis = Database['public']['Tables']['devis']['Row']
type Facture = Database['public']['Tables']['factures']['Row']
type Retouche = Database['public']['Tables']['retouches']['Row']

/**
 * Notifier lors de la création d'un nouveau projet
 */
export async function notifyNewProjet(
  atelierId: string,
  projet: Projet,
  userIds?: string[]
): Promise<void> {
  await sendPushNotificationToAtelier(
    atelierId,
    {
      title: 'Nouveau projet',
      body: `Projet ${projet.numero} - ${projet.name}`,
      data: {
        type: 'projet',
        id: projet.id,
        url: `/app/projets/${projet.id}`,
      },
      tag: `projet-${projet.id}`,
    },
    userIds
  )
}

/**
 * Notifier lors de la signature d'un devis
 */
export async function notifyDevisSigned(
  atelierId: string,
  devis: Devis,
  userIds?: string[]
): Promise<void> {
  await sendPushNotificationToAtelier(
    atelierId,
    {
      title: 'Devis signé',
      body: `Le devis #${devis.numero} a été signé`,
      data: {
        type: 'devis',
        id: devis.id,
        url: `/app/devis/${devis.id}`,
      },
      tag: `devis-${devis.id}`,
    },
    userIds
  )
}

/**
 * Notifier lors de la déclaration d'une retouche
 */
export async function notifyRetoucheDeclared(
  atelierId: string,
  retouche: Retouche,
  projetName: string,
  userIds?: string[]
): Promise<void> {
  await sendPushNotificationToAtelier(
    atelierId,
    {
      title: 'Retouche déclarée',
      body: `Retouche sur le projet ${projetName}`,
      data: {
        type: 'retouche',
        id: retouche.id,
        projet_id: retouche.projet_id,
        url: `/app/retouches/${retouche.id}`,
      },
      tag: `retouche-${retouche.id}`,
      requireInteraction: true, // Important, nécessite interaction
    },
    userIds
  )
}

/**
 * Notifier lors du paiement d'une facture
 */
export async function notifyFacturePaid(
  atelierId: string,
  facture: Facture,
  userIds?: string[]
): Promise<void> {
  await sendPushNotificationToAtelier(
    atelierId,
    {
      title: 'Facture payée',
      body: `La facture ${facture.numero} a été payée`,
      data: {
        type: 'facture',
        id: facture.id,
        url: `/app/factures/${facture.id}`,
      },
      tag: `facture-${facture.id}`,
    },
    userIds
  )
}

/**
 * Notifier lors d'un changement de statut projet important
 */
export async function notifyProjetStatusChange(
  atelierId: string,
  projet: Projet,
  oldStatus: string,
  newStatus: string,
  userIds?: string[]
): Promise<void> {
  const statusLabels: Record<string, string> = {
    pret: 'Prêt',
    livre: 'Livré',
    en_cuisson: 'En cuisson',
    qc: 'Contrôle qualité',
  }

  if (['pret', 'livre'].includes(newStatus)) {
    await sendPushNotificationToAtelier(
      atelierId,
      {
        title: `Projet ${statusLabels[newStatus] || newStatus}`,
        body: `Le projet ${projet.numero} est maintenant ${statusLabels[newStatus] || newStatus.toLowerCase()}`,
        data: {
          type: 'projet',
          id: projet.id,
          url: `/app/projets/${projet.id}`,
        },
        tag: `projet-${projet.id}-${newStatus}`,
      },
      userIds
    )
  }
}
