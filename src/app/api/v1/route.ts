/**
 * API publique REST v1 — Documentation et endpoint racine
 * 
 * GET /api/v1
 * 
 * Documentation OpenAPI simplifiée
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'ThermoGestion API',
    version: '1.0.0',
    description: 'API publique REST pour intégrations tierces avec ThermoGestion',
    base_url: '/api/v1',
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <api_key>',
      description: 'API key générée depuis le dashboard ThermoGestion > Paramètres > API',
    },
    rate_limiting: {
      default: '1000 requests/hour',
      header: 'X-RateLimit-Remaining',
    },
    endpoints: {
      clients: {
        'GET /api/v1/clients': 'Lister les clients',
        'GET /api/v1/clients/:id': 'Détail client',
        'POST /api/v1/clients': 'Créer un client',
        'PUT /api/v1/clients/:id': 'Modifier un client',
      },
      projets: {
        'GET /api/v1/projets': 'Lister les projets',
        'GET /api/v1/projets/:id': 'Détail projet',
        'POST /api/v1/projets': 'Créer un projet',
        'PATCH /api/v1/projets/:id/status': 'Changer le statut',
      },
      devis: {
        'GET /api/v1/devis': 'Lister les devis',
        'GET /api/v1/devis/:id': 'Détail devis',
        'GET /api/v1/devis/:id/pdf': 'Télécharger le PDF',
      },
      factures: {
        'GET /api/v1/factures': 'Lister les factures',
        'GET /api/v1/factures/:id': 'Détail facture',
        'GET /api/v1/factures/:id/pdf': 'Télécharger le PDF',
        'GET /api/v1/factures/:id/facturx': 'Télécharger le XML Factur-X',
      },
      poudres: {
        'GET /api/v1/poudres': 'Lister les poudres',
        'GET /api/v1/poudres/:id/stock': 'Détail stock poudre',
      },
      stock: {
        'GET /api/v1/stock': 'État du stock global',
        'POST /api/v1/stock/pesee': 'Enregistrer une pesée',
      },
      webhooks: {
        'GET /api/v1/webhooks': 'Lister les webhooks configurés',
        'POST /api/v1/webhooks': 'Créer un webhook',
        'DELETE /api/v1/webhooks/:id': 'Supprimer un webhook',
      },
    },
    webhooks_events: [
      'devis.created', 'devis.accepted', 'devis.refused',
      'projet.created', 'projet.status_changed', 'projet.completed',
      'facture.created', 'facture.paid',
      'stock.low', 'stock.reorder',
      'paiement.received',
    ],
    errors: {
      '400': 'Bad Request — Paramètres invalides',
      '401': 'Unauthorized — API key manquante ou invalide',
      '403': 'Forbidden — Accès refusé (mauvais atelier)',
      '404': 'Not Found — Ressource introuvable',
      '429': 'Too Many Requests — Rate limit dépassé',
      '500': 'Internal Server Error',
    },
    support: 'api@thermogestion.fr',
  })
}
