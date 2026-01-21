// Système de rôles et permissions

export type UserRole = 'owner' | 'admin' | 'commercial' | 'operateur' | 'comptable'

export interface RoleConfig {
  key: UserRole
  label: string
  description: string
  icon: string
  color: string
}

export const ROLES: Record<UserRole, RoleConfig> = {
  owner: {
    key: 'owner',
    label: 'Propriétaire',
    description: 'Accès complet à toutes les fonctionnalités',
    icon: '👑',
    color: 'bg-purple-100 text-purple-700',
  },
  admin: {
    key: 'admin',
    label: 'Administrateur',
    description: 'Gestion complète sauf paramètres de facturation',
    icon: '🔧',
    color: 'bg-blue-100 text-blue-700',
  },
  commercial: {
    key: 'commercial',
    label: 'Commercial',
    description: 'Devis, clients, projets (pas de factures)',
    icon: '💼',
    color: 'bg-green-100 text-green-700',
  },
  operateur: {
    key: 'operateur',
    label: 'Opérateur',
    description: 'Projets uniquement (atelier)',
    icon: '🔥',
    color: 'bg-orange-100 text-orange-700',
  },
  comptable: {
    key: 'comptable',
    label: 'Comptable',
    description: 'Factures et exports uniquement',
    icon: '📊',
    color: 'bg-amber-100 text-amber-700',
  },
}

// Permissions par fonctionnalité
export type Permission = 
  | 'dashboard.view'
  | 'clients.view' | 'clients.create' | 'clients.edit' | 'clients.delete'
  | 'devis.view' | 'devis.create' | 'devis.edit' | 'devis.delete' | 'devis.send'
  | 'projets.view' | 'projets.create' | 'projets.edit' | 'projets.delete' | 'projets.status'
  | 'factures.view' | 'factures.create' | 'factures.edit' | 'factures.delete' | 'factures.export'
  | 'poudres.view' | 'poudres.create' | 'poudres.edit' | 'poudres.stock'
  | 'stats.view'
  | 'planning.view' | 'planning.edit'
  | 'parametres.view' | 'parametres.edit'
  | 'equipe.view' | 'equipe.manage'

// Matrice de permissions par rôle
const PERMISSIONS_MATRIX: Record<UserRole, Permission[]> = {
  owner: [
    'dashboard.view',
    'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
    'devis.view', 'devis.create', 'devis.edit', 'devis.delete', 'devis.send',
    'projets.view', 'projets.create', 'projets.edit', 'projets.delete', 'projets.status',
    'factures.view', 'factures.create', 'factures.edit', 'factures.delete', 'factures.export',
    'poudres.view', 'poudres.create', 'poudres.edit', 'poudres.stock',
    'stats.view',
    'planning.view', 'planning.edit',
    'parametres.view', 'parametres.edit',
    'equipe.view', 'equipe.manage',
  ],
  admin: [
    'dashboard.view',
    'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
    'devis.view', 'devis.create', 'devis.edit', 'devis.delete', 'devis.send',
    'projets.view', 'projets.create', 'projets.edit', 'projets.delete', 'projets.status',
    'factures.view', 'factures.create', 'factures.edit', 'factures.delete', 'factures.export',
    'poudres.view', 'poudres.create', 'poudres.edit', 'poudres.stock',
    'stats.view',
    'planning.view', 'planning.edit',
    'parametres.view',
    'equipe.view', 'equipe.manage',
  ],
  commercial: [
    'dashboard.view',
    'clients.view', 'clients.create', 'clients.edit',
    'devis.view', 'devis.create', 'devis.edit', 'devis.send',
    'projets.view', 'projets.create',
    'poudres.view',
    'planning.view',
  ],
  operateur: [
    'dashboard.view',
    'clients.view',
    'projets.view', 'projets.status',
    'poudres.view', 'poudres.stock',
    'planning.view',
  ],
  comptable: [
    'dashboard.view',
    'clients.view',
    'devis.view',
    'factures.view', 'factures.create', 'factures.edit', 'factures.export',
    'stats.view',
  ],
}

// Vérifier si un rôle a une permission
export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSIONS_MATRIX[role]?.includes(permission) ?? false
}

// Vérifier si un rôle a au moins une des permissions
export function hasAnyPermission(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  if (!role) return false
  return permissions.some(p => hasPermission(role, p))
}

// Vérifier si un rôle a toutes les permissions
export function hasAllPermissions(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  if (!role) return false
  return permissions.every(p => hasPermission(role, p))
}

// Obtenir toutes les permissions d'un rôle
export function getRolePermissions(role: UserRole): Permission[] {
  return PERMISSIONS_MATRIX[role] || []
}

// Obtenir les liens de navigation autorisés
export function getAuthorizedNavLinks(role: UserRole | null | undefined) {
  const links = []

  if (hasPermission(role, 'dashboard.view')) {
    links.push({ href: '/app/dashboard', label: 'Dashboard', icon: '📊' })
  }
  if (hasPermission(role, 'projets.view')) {
    links.push({ href: '/app/projets', label: 'Projets', icon: '📁' })
  }
  if (hasPermission(role, 'devis.view')) {
    links.push({ href: '/app/devis', label: 'Devis', icon: '📝' })
  }
  if (hasPermission(role, 'factures.view')) {
    links.push({ href: '/app/factures', label: 'Factures', icon: '💰' })
  }
  if (hasPermission(role, 'clients.view')) {
    links.push({ href: '/app/clients', label: 'Clients', icon: '👥' })
  }
  if (hasPermission(role, 'poudres.view')) {
    links.push({ href: '/app/poudres', label: 'Poudres', icon: '🎨' })
  }
  if (hasPermission(role, 'planning.view')) {
    links.push({ href: '/app/planning', label: 'Planning', icon: '📅' })
  }
  if (hasPermission(role, 'stats.view')) {
    links.push({ href: '/app/stats', label: 'Stats', icon: '📈' })
  }
  if (hasPermission(role, 'parametres.view')) {
    links.push({ href: '/app/parametres', label: 'Paramètres', icon: '⚙️' })
  }

  return links
}
