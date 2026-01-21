'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { ROLES, UserRole, hasPermission } from '@/lib/roles'

interface TeamMember {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
  last_login_at: string | null
}

interface Invitation {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
}

interface TeamManagementProps {
  currentUserId: string
  currentUserRole: UserRole
  atelierId: string
  teamMembers: TeamMember[]
  invitations: Invitation[]
  maxMembers: number
  currentCount: number
  planName: string
}

export function TeamManagement({
  currentUserId,
  currentUserRole,
  atelierId,
  teamMembers: initialMembers,
  invitations: initialInvitations,
  maxMembers,
  currentCount,
  planName,
}: TeamManagementProps) {
  const supabase = createBrowserClient()
  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('operateur')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canManage = hasPermission(currentUserRole, 'equipe.manage')
  const canInvite = canManage && currentCount < maxMembers

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole) return

    setLoading(true)
    setError(null)

    try {
      // Vérifier que l'email n'est pas déjà dans l'équipe
      if (members.some(m => m.email === inviteEmail)) {
        throw new Error('Cet email est déjà membre de l\'équipe')
      }

      if (invitations.some(i => i.email === inviteEmail)) {
        throw new Error('Une invitation est déjà en attente pour cet email')
      }

      // Créer l'invitation
      const { data, error: insertError } = await supabase
        .from('team_invitations')
        .insert({
          atelier_id: atelierId,
          email: inviteEmail,
          role: inviteRole,
          invited_by: currentUserId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Ajouter à la liste locale
      setInvitations([data, ...invitations])
      setSuccess(`Invitation envoyée à ${inviteEmail}`)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('operateur')

      // TODO: Envoyer l'email d'invitation

    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi de l\'invitation')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Annuler cette invitation ?')) return

    try {
      await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId)

      setInvitations(invitations.filter(i => i.id !== invitationId))
      setSuccess('Invitation annulée')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleChangeRole = async (memberId: string, newRole: UserRole) => {
    if (memberId === currentUserId) {
      setError('Vous ne pouvez pas modifier votre propre rôle')
      return
    }

    const member = members.find(m => m.id === memberId)
    if (member?.role === 'owner' && currentUserRole !== 'owner') {
      setError('Seul le propriétaire peut modifier le rôle d\'un autre propriétaire')
      return
    }

    try {
      await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', memberId)

      setMembers(members.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ))
      setSuccess('Rôle mis à jour')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === currentUserId) {
      setError('Vous ne pouvez pas vous retirer de l\'équipe')
      return
    }

    const member = members.find(m => m.id === memberId)
    if (member?.role === 'owner') {
      setError('Impossible de retirer le propriétaire')
      return
    }

    if (!confirm(`Retirer ${member?.full_name || member?.email} de l'équipe ?`)) return

    try {
      // Retirer l'atelier_id de l'utilisateur
      await supabase
        .from('users')
        .update({ atelier_id: null, role: null })
        .eq('id', memberId)

      setMembers(members.filter(m => m.id !== memberId))
      setSuccess('Membre retiré de l\'équipe')
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Roles disponibles pour invitation (pas owner)
  const invitableRoles = Object.values(ROLES).filter(r => r.key !== 'owner')

  return (
    <div className="space-y-6">
      {/* Alertes */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
          <button onClick={() => setError(null)} className="float-right">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right">×</button>
        </div>
      )}

      {/* Header avec bouton inviter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Membres de l'équipe
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentCount} / {maxMembers} places utilisées 
              <span className="text-xs ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                Plan {planName}
              </span>
            </p>
          </div>
          
          {canManage && (
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={!canInvite}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 px-4 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Inviter un membre
            </button>
          )}
        </div>

        {!canInvite && currentCount >= maxMembers && (
          <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              💡 Limite atteinte. <a href="/app/parametres" className="underline font-medium">Passez à un plan supérieur</a> pour ajouter plus de membres.
            </p>
          </div>
        )}
      </div>

      {/* Liste des membres */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Membre</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rôle</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Dernière connexion</th>
              {canManage && (
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => {
              const roleConfig = ROLES[member.role as UserRole]
              const isCurrentUser = member.id === currentUserId
              const isOwner = member.role === 'owner'

              return (
                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                        {(member.full_name || member.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {member.full_name || 'Sans nom'}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-gray-500">(vous)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {canManage && !isCurrentUser && !isOwner ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value as UserRole)}
                        className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                      >
                        {Object.values(ROLES).map(role => (
                          <option key={role.key} value={role.key}>
                            {role.icon} {role.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${roleConfig?.color || 'bg-gray-100'}`}>
                        {roleConfig?.icon} {roleConfig?.label || member.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {member.last_login_at 
                        ? new Date(member.last_login_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                        : 'Jamais'
                      }
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      {!isCurrentUser && !isOwner && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Retirer
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invitations en attente */}
      {invitations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">
            📧 Invitations en attente ({invitations.length})
          </h3>
          <div className="space-y-3">
            {invitations.map((invitation) => {
              const roleConfig = ROLES[invitation.role as UserRole]
              const isExpired = new Date(invitation.expires_at) < new Date()

              return (
                <div 
                  key={invitation.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isExpired 
                      ? 'bg-gray-50 border-gray-200 opacity-60' 
                      : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✉️</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{invitation.email}</p>
                      <p className="text-sm text-gray-500">
                        {roleConfig?.icon} {roleConfig?.label}
                        {isExpired && ' • Expirée'}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="text-gray-500 hover:text-red-600 text-sm"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Légende des rôles */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">
          📋 Rôles et permissions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(ROLES).map((role) => (
            <div key={role.key} className={`p-4 rounded-lg ${role.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{role.icon}</span>
                <span className="font-bold">{role.label}</span>
              </div>
              <p className="text-sm opacity-80">{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal d'invitation */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Inviter un membre
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rôle
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {invitableRoles.map((role) => (
                    <button
                      key={role.key}
                      onClick={() => setInviteRole(role.key)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        inviteRole === role.key
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{role.icon}</span>
                      <p className="font-medium text-sm">{role.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleInvite}
                disabled={loading || !inviteEmail}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-red-700 disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
