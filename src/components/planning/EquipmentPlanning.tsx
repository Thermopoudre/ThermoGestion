'use client'

import { useState, useMemo } from 'react'
import { Flame, Wind, Plus, Calendar, Clock, AlertCircle, Wrench, ChevronLeft, ChevronRight } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface Equipement {
  id: string
  type: 'four' | 'cabine' | 'tunnel'
  nom: string
  longueur_cm?: number
  largeur_cm?: number
  hauteur_cm?: number
  capacite_kg?: number
  temp_max?: number
  disponible: boolean
  prochaine_maintenance?: string
}

interface Reservation {
  id: string
  equipement_id: string
  projet_id?: string
  date_debut: string
  date_fin: string
  temperature?: number
  notes?: string
  projet?: {
    numero: string
    name: string
    client?: {
      full_name: string
    }
  }
}

interface EquipmentPlanningProps {
  equipements: Equipement[]
  reservations: Reservation[]
  atelierId: string
  onUpdate: () => void
}

export default function EquipmentPlanning({ equipements, reservations, atelierId, onUpdate }: EquipmentPlanningProps) {
  const supabase = createBrowserClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [selectedEquipement, setSelectedEquipement] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [equipementForm, setEquipementForm] = useState({
    type: 'four' as Equipement['type'],
    nom: '',
    longueur_cm: 300,
    largeur_cm: 150,
    hauteur_cm: 200,
    capacite_kg: 500,
    temp_max: 220
  })

  const [reservationForm, setReservationForm] = useState({
    equipement_id: '',
    date_debut: '',
    date_fin: '',
    temperature: 180,
    notes: ''
  })

  // Générer les créneaux horaires de la journée
  const timeSlots = useMemo(() => {
    const slots = []
    for (let h = 6; h <= 20; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`)
    }
    return slots
  }, [])

  // Filtrer les réservations pour la date sélectionnée
  const dayReservations = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0]
    return reservations.filter(r => {
      const resDate = r.date_debut.split('T')[0]
      return resDate === dateStr
    })
  }, [reservations, selectedDate])

  // Grouper par équipement
  const reservationsByEquipement = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    equipements.forEach(eq => map.set(eq.id, []))
    dayReservations.forEach(r => {
      const list = map.get(r.equipement_id) || []
      list.push(r)
      map.set(r.equipement_id, list)
    })
    return map
  }, [equipements, dayReservations])

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate)
  }

  const handleAddEquipement = async () => {
    setLoading(true)
    try {
      await supabase
        .from('equipements')
        .insert({
          ...equipementForm,
          atelier_id: atelierId,
          disponible: true
        })
      
      setShowAddForm(false)
      setEquipementForm({
        type: 'four',
        nom: '',
        longueur_cm: 300,
        largeur_cm: 150,
        hauteur_cm: 200,
        capacite_kg: 500,
        temp_max: 220
      })
      onUpdate()
    } catch (error) {
      console.error('Error adding equipment:', error)
    }
    setLoading(false)
  }

  const handleAddReservation = async () => {
    if (!reservationForm.equipement_id || !reservationForm.date_debut || !reservationForm.date_fin) return
    
    setLoading(true)
    try {
      await supabase
        .from('reservations_equipement')
        .insert(reservationForm)
      
      setShowReservationForm(false)
      setReservationForm({
        equipement_id: '',
        date_debut: '',
        date_fin: '',
        temperature: 180,
        notes: ''
      })
      onUpdate()
    } catch (error) {
      console.error('Error adding reservation:', error)
    }
    setLoading(false)
  }

  const getEquipementIcon = (type: string) => {
    switch (type) {
      case 'four': return <Flame className="w-5 h-5 text-red-500" />
      case 'cabine': return <Wind className="w-5 h-5 text-blue-500" />
      default: return <Wrench className="w-5 h-5 text-gray-500" />
    }
  }

  const isMaintenanceSoon = (date?: string) => {
    if (!date) return false
    const maintenanceDate = new Date(date)
    const daysUntil = Math.floor((maintenanceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysUntil <= 7 && daysUntil >= 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Planning Équipements</h2>
          <p className="text-sm text-gray-500">Fours et cabines de poudrage</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Équipement
          </button>
          <button
            onClick={() => {
              setShowReservationForm(true)
              setReservationForm(prev => ({
                ...prev,
                date_debut: `${selectedDate.toISOString().split('T')[0]}T08:00`,
                date_fin: `${selectedDate.toISOString().split('T')[0]}T10:00`
              }))
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Réserver
          </button>
        </div>
      </div>

      {/* Liste des équipements */}
      <div className="grid grid-cols-4 gap-4">
        {equipements.map((eq) => (
          <div
            key={eq.id}
            className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-2 transition-all cursor-pointer ${
              selectedEquipement === eq.id
                ? 'border-blue-500 shadow-lg'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setSelectedEquipement(eq.id === selectedEquipement ? null : eq.id)}
          >
            <div className="flex items-center gap-3 mb-3">
              {getEquipementIcon(eq.type)}
              <div>
                <p className="font-semibold">{eq.nom}</p>
                <p className="text-xs text-gray-500 capitalize">{eq.type}</p>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 space-y-1">
              <p>{eq.longueur_cm} × {eq.largeur_cm} × {eq.hauteur_cm} cm</p>
              <p>{eq.capacite_kg} kg max</p>
              {eq.type === 'four' && <p>Temp max: {eq.temp_max}°C</p>}
            </div>

            {isMaintenanceSoon(eq.prochaine_maintenance) && (
              <div className="mt-2 flex items-center gap-1 text-amber-600 text-xs">
                <AlertCircle className="w-3 h-3" />
                Maintenance prévue
              </div>
            )}

            <div className={`mt-2 px-2 py-1 rounded-full text-xs text-center ${
              eq.disponible 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {eq.disponible ? 'Disponible' : 'Indisponible'}
            </div>
          </div>
        ))}

        {equipements.length === 0 && (
          <div className="col-span-4 text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <Flame className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Aucun équipement configuré</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-2 text-blue-600 hover:underline"
            >
              Ajouter un four ou une cabine
            </button>
          </div>
        )}
      </div>

      {/* Calendrier journalier */}
      {equipements.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          {/* Navigation date */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="font-semibold text-gray-900 dark:text-white">
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="text-xs text-blue-600 hover:underline"
              >
                Aujourd'hui
              </button>
            </div>
            <button
              onClick={() => navigateDate(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Grille horaire */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="w-24 px-4 py-2 text-left text-xs font-medium text-gray-500">Heure</th>
                  {equipements.map(eq => (
                    <th key={eq.id} className="px-4 py-2 text-left text-xs font-medium text-gray-500 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        {getEquipementIcon(eq.type)}
                        {eq.nom}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => {
                  const slotHour = parseInt(slot.split(':')[0])
                  
                  return (
                    <tr key={slot} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-500">{slot}</td>
                      {equipements.map(eq => {
                        const eqReservations = reservationsByEquipement.get(eq.id) || []
                        const activeReservation = eqReservations.find(r => {
                          const startHour = parseInt(r.date_debut.split('T')[1].split(':')[0])
                          const endHour = parseInt(r.date_fin.split('T')[1].split(':')[0])
                          return slotHour >= startHour && slotHour < endHour
                        })

                        return (
                          <td key={eq.id} className="px-4 py-3">
                            {activeReservation ? (
                              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2 text-sm">
                                <p className="font-medium">{activeReservation.projet?.numero || 'Réservé'}</p>
                                {activeReservation.temperature && (
                                  <p className="text-xs">{activeReservation.temperature}°C</p>
                                )}
                              </div>
                            ) : (
                              <div className="h-8 bg-gray-50 dark:bg-gray-700/30 rounded" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ajout équipement */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">Ajouter un équipement</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={equipementForm.type}
                  onChange={(e) => setEquipementForm({ ...equipementForm, type: e.target.value as Equipement['type'] })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="four">Four</option>
                  <option value="cabine">Cabine de poudrage</option>
                  <option value="tunnel">Tunnel</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Nom</label>
                <input
                  type="text"
                  value={equipementForm.nom}
                  onChange={(e) => setEquipementForm({ ...equipementForm, nom: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Four principal"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Long. (cm)</label>
                  <input
                    type="number"
                    value={equipementForm.longueur_cm}
                    onChange={(e) => setEquipementForm({ ...equipementForm, longueur_cm: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Larg. (cm)</label>
                  <input
                    type="number"
                    value={equipementForm.largeur_cm}
                    onChange={(e) => setEquipementForm({ ...equipementForm, largeur_cm: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Haut. (cm)</label>
                  <input
                    type="number"
                    value={equipementForm.hauteur_cm}
                    onChange={(e) => setEquipementForm({ ...equipementForm, hauteur_cm: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Capacité (kg)</label>
                  <input
                    type="number"
                    value={equipementForm.capacite_kg}
                    onChange={(e) => setEquipementForm({ ...equipementForm, capacite_kg: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                {equipementForm.type === 'four' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Temp max (°C)</label>
                    <input
                      type="number"
                      value={equipementForm.temp_max}
                      onChange={(e) => setEquipementForm({ ...equipementForm, temp_max: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleAddEquipement}
                disabled={loading || !equipementForm.nom}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal réservation */}
      {showReservationForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">Nouvelle réservation</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Équipement</label>
                <select
                  value={reservationForm.equipement_id}
                  onChange={(e) => setReservationForm({ ...reservationForm, equipement_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Sélectionner...</option>
                  {equipements.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.nom} ({eq.type})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Début</label>
                  <input
                    type="datetime-local"
                    value={reservationForm.date_debut}
                    onChange={(e) => setReservationForm({ ...reservationForm, date_debut: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fin</label>
                  <input
                    type="datetime-local"
                    value={reservationForm.date_fin}
                    onChange={(e) => setReservationForm({ ...reservationForm, date_fin: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Température (°C)</label>
                <input
                  type="number"
                  value={reservationForm.temperature}
                  onChange={(e) => setReservationForm({ ...reservationForm, temperature: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={reservationForm.notes}
                  onChange={(e) => setReservationForm({ ...reservationForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowReservationForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleAddReservation}
                disabled={loading || !reservationForm.equipement_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Réserver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
