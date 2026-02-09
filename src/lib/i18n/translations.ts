// Internationalization (i18n) translations for ThermoGestion

export type Locale = 'fr' | 'en' | 'es' | 'de'

export const defaultLocale: Locale = 'fr'

export const locales: { code: Locale; name: string; flag: string }[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
]

export const translations: Record<Locale, Record<string, string>> = {
  fr: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.clients': 'Clients',
    'nav.devis': 'Devis',
    'nav.projets': 'Projets',
    'nav.factures': 'Factures',
    'nav.poudres': 'Poudres',
    'nav.planning': 'Planning',
    'nav.stats': 'Statistiques',
    'nav.settings': 'Paramètres',
    'nav.help': 'Aide',
    'nav.logout': 'Déconnexion',
    
    // Common actions
    'action.save': 'Enregistrer',
    'action.cancel': 'Annuler',
    'action.delete': 'Supprimer',
    'action.edit': 'Modifier',
    'action.create': 'Créer',
    'action.search': 'Rechercher',
    'action.filter': 'Filtrer',
    'action.export': 'Exporter',
    'action.import': 'Importer',
    'action.download': 'Télécharger',
    'action.print': 'Imprimer',
    'action.send': 'Envoyer',
    'action.confirm': 'Confirmer',
    'action.back': 'Retour',
    'action.next': 'Suivant',
    'action.previous': 'Précédent',
    
    // Status
    'status.draft': 'Brouillon',
    'status.pending': 'En attente',
    'status.sent': 'Envoyé',
    'status.signed': 'Signé',
    'status.refused': 'Refusé',
    'status.expired': 'Expiré',
    'status.in_progress': 'En cours',
    'status.completed': 'Terminé',
    'status.paid': 'Payé',
    'status.unpaid': 'Impayé',
    'status.overdue': 'En retard',
    
    // Devis
    'devis.title': 'Devis',
    'devis.new': 'Nouveau devis',
    'devis.numero': 'Numéro',
    'devis.client': 'Client',
    'devis.date': 'Date',
    'devis.validity': 'Validité',
    'devis.total_ht': 'Total HT',
    'devis.total_ttc': 'Total TTC',
    'devis.sign': 'Signer',
    'devis.convert': 'Convertir en projet',
    'devis.duplicate': 'Dupliquer',
    
    // Projets
    'projet.title': 'Projets',
    'projet.new': 'Nouveau projet',
    'projet.reference': 'Référence',
    'projet.description': 'Description',
    'projet.deadline': 'Date limite',
    'projet.status': 'Statut',
    
    // Factures
    'facture.title': 'Factures',
    'facture.new': 'Nouvelle facture',
    'facture.paid_at': 'Payée le',
    'facture.due_date': 'Échéance',
    'facture.mark_paid': 'Marquer payée',
    
    // Clients
    'client.title': 'Clients',
    'client.new': 'Nouveau client',
    'client.name': 'Nom',
    'client.email': 'Email',
    'client.phone': 'Téléphone',
    'client.address': 'Adresse',
    'client.city': 'Ville',
    'client.postal_code': 'Code postal',
    
    // Poudres
    'poudre.title': 'Poudres',
    'poudre.new': 'Nouvelle poudre',
    'poudre.name': 'Nom',
    'poudre.code_ral': 'Code RAL',
    'poudre.stock': 'Stock',
    'poudre.price': 'Prix/kg',
    
    // Dashboard
    'dashboard.welcome': 'Bienvenue',
    'dashboard.ca_month': 'CA du mois',
    'dashboard.projects_in_progress': 'Projets en cours',
    'dashboard.pending_quotes': 'Devis en attente',
    'dashboard.unpaid_invoices': 'Factures impayées',
    
    // Settings
    'settings.title': 'Paramètres',
    'settings.atelier': 'Atelier',
    'settings.integrations': 'Intégrations',
    'settings.templates': 'Templates',
    'settings.subscription': 'Abonnement',
    'settings.team': 'Équipe',
    
    // Dates & Time
    'date.today': "Aujourd'hui",
    'date.yesterday': 'Hier',
    'date.tomorrow': 'Demain',
    'date.this_week': 'Cette semaine',
    'date.this_month': 'Ce mois',
    'date.this_year': 'Cette année',
    
    // Errors
    'error.generic': 'Une erreur est survenue',
    'error.not_found': 'Page introuvable',
    'error.unauthorized': 'Non autorisé',
    'error.network': 'Erreur de connexion',
    
    // Success
    'success.saved': 'Enregistré avec succès',
    'success.deleted': 'Supprimé avec succès',
    'success.sent': 'Envoyé avec succès',
    
    // Nouvelles fonctionnalités
    'nav.consommables': 'Consommables',
    'nav.maintenance': 'Maintenance',
    'nav.etiquettes': 'Étiquettes',
    'nav.objectifs': 'Objectifs',
    'nav.grille_tarifaire': 'Grille tarifaire',
    'nav.previsionnel': 'Prévisionnel',
    'nav.ecran_atelier': 'Écran atelier',
    'nav.stock_intelligent': 'Stock intelligent',
    'nav.relances': 'Relances',
    'nav.tarifs_clients': 'Tarifs clients',
    'nav.planification': 'Planif. cuisson',
    'nav.reapprovisionnement': 'Réappro.',
    
    // Planning cuisson
    'cuisson.title': 'Planification cuisson',
    'cuisson.new': 'Nouvelle fournée',
    'cuisson.temperature': 'Température',
    'cuisson.weight': 'Poids',
    'cuisson.start': 'Démarrer',
    'cuisson.complete': 'Terminée',
    'cuisson.slots_remaining': 'Créneaux restants',
    
    // Consommables
    'consommable.title': 'Consommables',
    'consommable.stock_low': 'Stock bas',
    'consommable.movement': 'Mouvement',
    'consommable.entry': 'Entrée',
    'consommable.exit': 'Sortie',
    
    // Maintenance
    'maintenance.title': 'Maintenance préventive',
    'maintenance.overdue': 'En retard',
    'maintenance.next': 'Prochaine',
    'maintenance.complete': 'Effectuée',
    
    // Quality
    'quality.thickness': 'Épaisseur',
    'quality.thickness_unit': 'µm',
    'quality.compliant': 'Conforme',
    'quality.non_compliant': 'Non conforme',
    'quality.qualicoat_range': '60-120 µm (norme QUALICOAT)',
    
    // Relances
    'relance.title': 'Relances commerciales',
    'relance.generate': 'Générer les relances',
    'relance.to_send': 'À envoyer',
    'relance.sent': 'Envoyée',
    'relance.replied': 'Répondue',
    
    // Feature flags
    'feature.enabled': 'Activé',
    'feature.disabled': 'Désactivé',
    'feature.lite_only': 'Plan Lite',
    'feature.pro_only': 'Plan Pro',
  },
  
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.clients': 'Clients',
    'nav.devis': 'Quotes',
    'nav.projets': 'Projects',
    'nav.factures': 'Invoices',
    'nav.poudres': 'Powders',
    'nav.planning': 'Planning',
    'nav.stats': 'Statistics',
    'nav.settings': 'Settings',
    'nav.help': 'Help',
    'nav.logout': 'Logout',
    
    // Common actions
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.create': 'Create',
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.download': 'Download',
    'action.print': 'Print',
    'action.send': 'Send',
    'action.confirm': 'Confirm',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.previous': 'Previous',
    
    // Status
    'status.draft': 'Draft',
    'status.pending': 'Pending',
    'status.sent': 'Sent',
    'status.signed': 'Signed',
    'status.refused': 'Refused',
    'status.expired': 'Expired',
    'status.in_progress': 'In Progress',
    'status.completed': 'Completed',
    'status.paid': 'Paid',
    'status.unpaid': 'Unpaid',
    'status.overdue': 'Overdue',
    
    // Devis
    'devis.title': 'Quotes',
    'devis.new': 'New quote',
    'devis.numero': 'Number',
    'devis.client': 'Client',
    'devis.date': 'Date',
    'devis.validity': 'Validity',
    'devis.total_ht': 'Total excl. VAT',
    'devis.total_ttc': 'Total incl. VAT',
    'devis.sign': 'Sign',
    'devis.convert': 'Convert to project',
    'devis.duplicate': 'Duplicate',
    
    // Projets
    'projet.title': 'Projects',
    'projet.new': 'New project',
    'projet.reference': 'Reference',
    'projet.description': 'Description',
    'projet.deadline': 'Deadline',
    'projet.status': 'Status',
    
    // Factures
    'facture.title': 'Invoices',
    'facture.new': 'New invoice',
    'facture.paid_at': 'Paid on',
    'facture.due_date': 'Due date',
    'facture.mark_paid': 'Mark as paid',
    
    // Clients
    'client.title': 'Clients',
    'client.new': 'New client',
    'client.name': 'Name',
    'client.email': 'Email',
    'client.phone': 'Phone',
    'client.address': 'Address',
    'client.city': 'City',
    'client.postal_code': 'Postal code',
    
    // Poudres
    'poudre.title': 'Powders',
    'poudre.new': 'New powder',
    'poudre.name': 'Name',
    'poudre.code_ral': 'RAL code',
    'poudre.stock': 'Stock',
    'poudre.price': 'Price/kg',
    
    // Dashboard
    'dashboard.welcome': 'Welcome',
    'dashboard.ca_month': 'Monthly revenue',
    'dashboard.projects_in_progress': 'Projects in progress',
    'dashboard.pending_quotes': 'Pending quotes',
    'dashboard.unpaid_invoices': 'Unpaid invoices',
    
    // Settings
    'settings.title': 'Settings',
    'settings.atelier': 'Workshop',
    'settings.integrations': 'Integrations',
    'settings.templates': 'Templates',
    'settings.subscription': 'Subscription',
    'settings.team': 'Team',
    
    // Dates & Time
    'date.today': 'Today',
    'date.yesterday': 'Yesterday',
    'date.tomorrow': 'Tomorrow',
    'date.this_week': 'This week',
    'date.this_month': 'This month',
    'date.this_year': 'This year',
    
    // Errors
    'error.generic': 'An error occurred',
    'error.not_found': 'Page not found',
    'error.unauthorized': 'Unauthorized',
    'error.network': 'Connection error',
    
    // Success
    'success.saved': 'Saved successfully',
    'success.deleted': 'Deleted successfully',
    'success.sent': 'Sent successfully',
    
    // New features
    'nav.consommables': 'Consumables',
    'nav.maintenance': 'Maintenance',
    'nav.etiquettes': 'Labels',
    'nav.objectifs': 'Objectives',
    'nav.grille_tarifaire': 'Pricing grid',
    'nav.previsionnel': 'Forecast',
    'nav.ecran_atelier': 'Workshop screen',
    'nav.stock_intelligent': 'Smart stock',
    'nav.relances': 'Follow-ups',
    'nav.tarifs_clients': 'Client pricing',
    'nav.planification': 'Curing schedule',
    'nav.reapprovisionnement': 'Restock',
    
    'cuisson.title': 'Curing schedule',
    'cuisson.new': 'New batch',
    'cuisson.temperature': 'Temperature',
    'cuisson.weight': 'Weight',
    'cuisson.start': 'Start',
    'cuisson.complete': 'Complete',
    'cuisson.slots_remaining': 'Slots remaining',
    
    'consommable.title': 'Consumables',
    'consommable.stock_low': 'Low stock',
    'consommable.movement': 'Movement',
    'consommable.entry': 'Entry',
    'consommable.exit': 'Exit',
    
    'maintenance.title': 'Preventive maintenance',
    'maintenance.overdue': 'Overdue',
    'maintenance.next': 'Next',
    'maintenance.complete': 'Completed',
    
    'quality.thickness': 'Thickness',
    'quality.thickness_unit': 'µm',
    'quality.compliant': 'Compliant',
    'quality.non_compliant': 'Non-compliant',
    'quality.qualicoat_range': '60-120 µm (QUALICOAT standard)',
    
    'relance.title': 'Follow-ups',
    'relance.generate': 'Generate follow-ups',
    'relance.to_send': 'To send',
    'relance.sent': 'Sent',
    'relance.replied': 'Replied',
    
    'feature.enabled': 'Enabled',
    'feature.disabled': 'Disabled',
    'feature.lite_only': 'Lite plan',
    'feature.pro_only': 'Pro plan',
  },
  
  es: {
    // Navigation
    'nav.dashboard': 'Panel',
    'nav.clients': 'Clientes',
    'nav.devis': 'Presupuestos',
    'nav.projets': 'Proyectos',
    'nav.factures': 'Facturas',
    'nav.poudres': 'Polvos',
    'nav.planning': 'Planificación',
    'nav.stats': 'Estadísticas',
    'nav.settings': 'Configuración',
    'nav.help': 'Ayuda',
    'nav.logout': 'Cerrar sesión',
    
    // Common actions
    'action.save': 'Guardar',
    'action.cancel': 'Cancelar',
    'action.delete': 'Eliminar',
    'action.edit': 'Editar',
    'action.create': 'Crear',
    'action.search': 'Buscar',
    'action.filter': 'Filtrar',
    'action.export': 'Exportar',
    'action.import': 'Importar',
    'action.download': 'Descargar',
    'action.print': 'Imprimir',
    'action.send': 'Enviar',
    'action.confirm': 'Confirmar',
    'action.back': 'Volver',
    'action.next': 'Siguiente',
    'action.previous': 'Anterior',
    
    // Status
    'status.draft': 'Borrador',
    'status.pending': 'Pendiente',
    'status.sent': 'Enviado',
    'status.signed': 'Firmado',
    'status.refused': 'Rechazado',
    'status.expired': 'Expirado',
    'status.in_progress': 'En progreso',
    'status.completed': 'Completado',
    'status.paid': 'Pagado',
    'status.unpaid': 'No pagado',
    'status.overdue': 'Vencido',
    
    // Devis
    'devis.title': 'Presupuestos',
    'devis.new': 'Nuevo presupuesto',
    'devis.numero': 'Número',
    'devis.client': 'Cliente',
    'devis.date': 'Fecha',
    'devis.validity': 'Validez',
    'devis.total_ht': 'Total sin IVA',
    'devis.total_ttc': 'Total con IVA',
    'devis.sign': 'Firmar',
    'devis.convert': 'Convertir a proyecto',
    'devis.duplicate': 'Duplicar',
    
    // Projets
    'projet.title': 'Proyectos',
    'projet.new': 'Nuevo proyecto',
    'projet.reference': 'Referencia',
    'projet.description': 'Descripción',
    'projet.deadline': 'Fecha límite',
    'projet.status': 'Estado',
    
    // Factures
    'facture.title': 'Facturas',
    'facture.new': 'Nueva factura',
    'facture.paid_at': 'Pagada el',
    'facture.due_date': 'Vencimiento',
    'facture.mark_paid': 'Marcar como pagada',
    
    // Clients
    'client.title': 'Clientes',
    'client.new': 'Nuevo cliente',
    'client.name': 'Nombre',
    'client.email': 'Correo',
    'client.phone': 'Teléfono',
    'client.address': 'Dirección',
    'client.city': 'Ciudad',
    'client.postal_code': 'Código postal',
    
    // Poudres
    'poudre.title': 'Polvos',
    'poudre.new': 'Nuevo polvo',
    'poudre.name': 'Nombre',
    'poudre.code_ral': 'Código RAL',
    'poudre.stock': 'Stock',
    'poudre.price': 'Precio/kg',
    
    // Dashboard
    'dashboard.welcome': 'Bienvenido',
    'dashboard.ca_month': 'Ingresos del mes',
    'dashboard.projects_in_progress': 'Proyectos en curso',
    'dashboard.pending_quotes': 'Presupuestos pendientes',
    'dashboard.unpaid_invoices': 'Facturas no pagadas',
    
    // Settings
    'settings.title': 'Configuración',
    'settings.atelier': 'Taller',
    'settings.integrations': 'Integraciones',
    'settings.templates': 'Plantillas',
    'settings.subscription': 'Suscripción',
    'settings.team': 'Equipo',
    
    // Dates & Time
    'date.today': 'Hoy',
    'date.yesterday': 'Ayer',
    'date.tomorrow': 'Mañana',
    'date.this_week': 'Esta semana',
    'date.this_month': 'Este mes',
    'date.this_year': 'Este año',
    
    // Errors
    'error.generic': 'Ha ocurrido un error',
    'error.not_found': 'Página no encontrada',
    'error.unauthorized': 'No autorizado',
    'error.network': 'Error de conexión',
    
    // Success
    'success.saved': 'Guardado correctamente',
    'success.deleted': 'Eliminado correctamente',
    'success.sent': 'Enviado correctamente',
    
    // Nuevas funcionalidades
    'nav.consommables': 'Consumibles',
    'nav.maintenance': 'Mantenimiento',
    'nav.etiquettes': 'Etiquetas',
    'nav.objectifs': 'Objetivos',
    'nav.grille_tarifaire': 'Tarifas',
    'nav.previsionnel': 'Previsión',
    'nav.ecran_atelier': 'Pantalla taller',
    'nav.stock_intelligent': 'Stock inteligente',
    'nav.relances': 'Seguimientos',
    'nav.tarifs_clients': 'Tarifas clientes',
    'nav.planification': 'Planif. cocción',
    'nav.reapprovisionnement': 'Reabastecimiento',
    
    'cuisson.title': 'Planificación de cocción',
    'cuisson.new': 'Nuevo lote',
    'cuisson.temperature': 'Temperatura',
    'cuisson.weight': 'Peso',
    'cuisson.start': 'Iniciar',
    'cuisson.complete': 'Completado',
    'cuisson.slots_remaining': 'Espacios restantes',
    
    'consommable.title': 'Consumibles',
    'consommable.stock_low': 'Stock bajo',
    'consommable.movement': 'Movimiento',
    'consommable.entry': 'Entrada',
    'consommable.exit': 'Salida',
    
    'maintenance.title': 'Mantenimiento preventivo',
    'maintenance.overdue': 'Atrasado',
    'maintenance.next': 'Próximo',
    'maintenance.complete': 'Completado',
    
    'quality.thickness': 'Espesor',
    'quality.thickness_unit': 'µm',
    'quality.compliant': 'Conforme',
    'quality.non_compliant': 'No conforme',
    'quality.qualicoat_range': '60-120 µm (norma QUALICOAT)',
    
    'relance.title': 'Seguimientos',
    'relance.generate': 'Generar seguimientos',
    'relance.to_send': 'Por enviar',
    'relance.sent': 'Enviado',
    'relance.replied': 'Respondido',
    
    'feature.enabled': 'Activado',
    'feature.disabled': 'Desactivado',
    'feature.lite_only': 'Plan Lite',
    'feature.pro_only': 'Plan Pro',
  },
  
  de: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.clients': 'Kunden',
    'nav.devis': 'Angebote',
    'nav.projets': 'Projekte',
    'nav.factures': 'Rechnungen',
    'nav.poudres': 'Pulver',
    'nav.planning': 'Planung',
    'nav.stats': 'Statistiken',
    'nav.settings': 'Einstellungen',
    'nav.help': 'Hilfe',
    'nav.logout': 'Abmelden',
    
    // Common actions
    'action.save': 'Speichern',
    'action.cancel': 'Abbrechen',
    'action.delete': 'Löschen',
    'action.edit': 'Bearbeiten',
    'action.create': 'Erstellen',
    'action.search': 'Suchen',
    'action.filter': 'Filtern',
    'action.export': 'Exportieren',
    'action.import': 'Importieren',
    'action.download': 'Herunterladen',
    'action.print': 'Drucken',
    'action.send': 'Senden',
    'action.confirm': 'Bestätigen',
    'action.back': 'Zurück',
    'action.next': 'Weiter',
    'action.previous': 'Zurück',
    
    // Status
    'status.draft': 'Entwurf',
    'status.pending': 'Ausstehend',
    'status.sent': 'Gesendet',
    'status.signed': 'Unterschrieben',
    'status.refused': 'Abgelehnt',
    'status.expired': 'Abgelaufen',
    'status.in_progress': 'In Bearbeitung',
    'status.completed': 'Abgeschlossen',
    'status.paid': 'Bezahlt',
    'status.unpaid': 'Unbezahlt',
    'status.overdue': 'Überfällig',
    
    // Devis
    'devis.title': 'Angebote',
    'devis.new': 'Neues Angebot',
    'devis.numero': 'Nummer',
    'devis.client': 'Kunde',
    'devis.date': 'Datum',
    'devis.validity': 'Gültigkeit',
    'devis.total_ht': 'Netto',
    'devis.total_ttc': 'Brutto',
    'devis.sign': 'Unterschreiben',
    'devis.convert': 'In Projekt umwandeln',
    'devis.duplicate': 'Duplizieren',
    
    // Projets
    'projet.title': 'Projekte',
    'projet.new': 'Neues Projekt',
    'projet.reference': 'Referenz',
    'projet.description': 'Beschreibung',
    'projet.deadline': 'Frist',
    'projet.status': 'Status',
    
    // Factures
    'facture.title': 'Rechnungen',
    'facture.new': 'Neue Rechnung',
    'facture.paid_at': 'Bezahlt am',
    'facture.due_date': 'Fälligkeitsdatum',
    'facture.mark_paid': 'Als bezahlt markieren',
    
    // Clients
    'client.title': 'Kunden',
    'client.new': 'Neuer Kunde',
    'client.name': 'Name',
    'client.email': 'E-Mail',
    'client.phone': 'Telefon',
    'client.address': 'Adresse',
    'client.city': 'Stadt',
    'client.postal_code': 'Postleitzahl',
    
    // Poudres
    'poudre.title': 'Pulver',
    'poudre.new': 'Neues Pulver',
    'poudre.name': 'Name',
    'poudre.code_ral': 'RAL-Code',
    'poudre.stock': 'Bestand',
    'poudre.price': 'Preis/kg',
    
    // Dashboard
    'dashboard.welcome': 'Willkommen',
    'dashboard.ca_month': 'Monatsumsatz',
    'dashboard.projects_in_progress': 'Laufende Projekte',
    'dashboard.pending_quotes': 'Offene Angebote',
    'dashboard.unpaid_invoices': 'Unbezahlte Rechnungen',
    
    // Settings
    'settings.title': 'Einstellungen',
    'settings.atelier': 'Werkstatt',
    'settings.integrations': 'Integrationen',
    'settings.templates': 'Vorlagen',
    'settings.subscription': 'Abonnement',
    'settings.team': 'Team',
    
    // Dates & Time
    'date.today': 'Heute',
    'date.yesterday': 'Gestern',
    'date.tomorrow': 'Morgen',
    'date.this_week': 'Diese Woche',
    'date.this_month': 'Dieser Monat',
    'date.this_year': 'Dieses Jahr',
    
    // Errors
    'error.generic': 'Ein Fehler ist aufgetreten',
    'error.not_found': 'Seite nicht gefunden',
    'error.unauthorized': 'Nicht autorisiert',
    'error.network': 'Verbindungsfehler',
    
    // Success
    'success.saved': 'Erfolgreich gespeichert',
    'success.deleted': 'Erfolgreich gelöscht',
    'success.sent': 'Erfolgreich gesendet',
    
    // Neue Funktionen
    'nav.consommables': 'Verbrauchsmaterial',
    'nav.maintenance': 'Wartung',
    'nav.etiquettes': 'Etiketten',
    'nav.objectifs': 'Ziele',
    'nav.grille_tarifaire': 'Preisraster',
    'nav.previsionnel': 'Prognose',
    'nav.ecran_atelier': 'Werkstatt-Display',
    'nav.stock_intelligent': 'Smart Stock',
    'nav.relances': 'Nachfassaktionen',
    'nav.tarifs_clients': 'Kundenpreise',
    'nav.planification': 'Einbrennplanung',
    'nav.reapprovisionnement': 'Nachbestellung',
    
    'cuisson.title': 'Einbrennplanung',
    'cuisson.new': 'Neue Charge',
    'cuisson.temperature': 'Temperatur',
    'cuisson.weight': 'Gewicht',
    'cuisson.start': 'Starten',
    'cuisson.complete': 'Abgeschlossen',
    'cuisson.slots_remaining': 'Verfügbare Plätze',
    
    'consommable.title': 'Verbrauchsmaterial',
    'consommable.stock_low': 'Niedriger Bestand',
    'consommable.movement': 'Bewegung',
    'consommable.entry': 'Eingang',
    'consommable.exit': 'Ausgang',
    
    'maintenance.title': 'Vorbeugende Wartung',
    'maintenance.overdue': 'Überfällig',
    'maintenance.next': 'Nächste',
    'maintenance.complete': 'Abgeschlossen',
    
    'quality.thickness': 'Schichtdicke',
    'quality.thickness_unit': 'µm',
    'quality.compliant': 'Konform',
    'quality.non_compliant': 'Nicht konform',
    'quality.qualicoat_range': '60-120 µm (QUALICOAT-Norm)',
    
    'relance.title': 'Nachfassaktionen',
    'relance.generate': 'Nachfassaktionen generieren',
    'relance.to_send': 'Zu senden',
    'relance.sent': 'Gesendet',
    'relance.replied': 'Beantwortet',
    
    'feature.enabled': 'Aktiviert',
    'feature.disabled': 'Deaktiviert',
    'feature.lite_only': 'Lite-Plan',
    'feature.pro_only': 'Pro-Plan',
  },
}

// Helper function to get translation
export function t(key: string, locale: Locale = defaultLocale): string {
  return translations[locale][key] || translations[defaultLocale][key] || key
}

// Currency configuration
export type Currency = 'EUR' | 'CHF' | 'CAD' | 'USD' | 'GBP'

export const currencies: { code: Currency; symbol: string; name: string; locale: string }[] = [
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'fr-FR' },
  { code: 'CHF', symbol: 'CHF', name: 'Franc suisse', locale: 'fr-CH' },
  { code: 'CAD', symbol: '$', name: 'Dollar canadien', locale: 'fr-CA' },
  { code: 'USD', symbol: '$', name: 'Dollar américain', locale: 'en-US' },
  { code: 'GBP', symbol: '£', name: 'Livre sterling', locale: 'en-GB' },
]

// Format currency
export function formatCurrency(amount: number, currency: Currency = 'EUR', locale: Locale = 'fr'): string {
  const currencyConfig = currencies.find(c => c.code === currency) || currencies[0]
  
  return new Intl.NumberFormat(currencyConfig.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Format number
export function formatNumber(num: number, locale: Locale = 'fr'): string {
  const localeMap: Record<Locale, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
  }
  
  return new Intl.NumberFormat(localeMap[locale]).format(num)
}

// Format date
export function formatDate(date: Date | string, locale: Locale = 'fr', format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  const localeMap: Record<Locale, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
  }
  
  if (format === 'relative') {
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return t('date.today', locale)
    if (days === 1) return t('date.yesterday', locale)
    if (days === -1) return t('date.tomorrow', locale)
  }
  
  return new Intl.DateTimeFormat(localeMap[locale], {
    dateStyle: format === 'long' ? 'long' : 'short',
  }).format(d)
}

// Format percentage
export function formatPercent(value: number, locale: Locale = 'fr'): string {
  const localeMap: Record<Locale, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
  }
  
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value / 100)
}
