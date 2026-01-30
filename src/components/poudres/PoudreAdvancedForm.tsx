'use client'

import { useState } from 'react'
import { Calendar, FileText, Shield, Upload, AlertTriangle, Award, Package } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface PoudreData {
  id?: string
  reference: string
  marque: string
  type: string
  ral?: string
  finition?: string
  prix_kg?: number
  stock_reel_kg?: number
  stock_min_kg?: number
  temp_cuisson?: number
  duree_cuisson?: number
  // Nouveaux champs avancés
  date_peremption?: string
  numero_lot?: string
  fournisseur?: string
  fiche_technique_url?: string
  fds_url?: string
  date_reception?: string
  certifications?: string[]
  qualicoat_approved?: boolean
  qualimarine_approved?: boolean
}

interface PoudreAdvancedFormProps {
  poudre?: PoudreData
  atelierId: string
  onSave: (poudre: PoudreData) => Promise<void>
  onCancel: () => void
}

export default function PoudreAdvancedForm({ poudre, atelierId, onSave, onCancel }: PoudreAdvancedFormProps) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [uploadingFT, setUploadingFT] = useState(false)
  const [uploadingFDS, setUploadingFDS] = useState(false)
  
  const [form, setForm] = useState<PoudreData>({
    reference: poudre?.reference || '',
    marque: poudre?.marque || '',
    type: poudre?.type || 'polyester',
    ral: poudre?.ral || '',
    finition: poudre?.finition || 'mat',
    prix_kg: poudre?.prix_kg || 0,
    stock_reel_kg: poudre?.stock_reel_kg || 0,
    stock_min_kg: poudre?.stock_min_kg || 5,
    temp_cuisson: poudre?.temp_cuisson || 180,
    duree_cuisson: poudre?.duree_cuisson || 20,
    date_peremption: poudre?.date_peremption || '',
    numero_lot: poudre?.numero_lot || '',
    fournisseur: poudre?.fournisseur || '',
    fiche_technique_url: poudre?.fiche_technique_url || '',
    fds_url: poudre?.fds_url || '',
    date_reception: poudre?.date_reception || new Date().toISOString().split('T')[0],
    certifications: poudre?.certifications || [],
    qualicoat_approved: poudre?.qualicoat_approved || false,
    qualimarine_approved: poudre?.qualimarine_approved || false,
    ...poudre
  })

  const certificationOptions = [
    'QUALICOAT',
    'QUALIMARINE',
    'GSB International',
    'AAMA 2604',
    'AAMA 2605',
    'BS EN 12206',
    'ISO 9001'
  ]

  const handleUpload = async (file: File, type: 'fiche_technique' | 'fds') => {
    const setUploading = type === 'fiche_technique' ? setUploadingFT : setUploadingFDS
    setUploading(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${atelierId}/${type}_${Date.now()}.${fileExt}`
      
      const { error: uploadError, data } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      if (type === 'fiche_technique') {
        setForm({ ...form, fiche_technique_url: publicUrl })
      } else {
        setForm({ ...form, fds_url: publicUrl })
      }
    } catch (error) {
      console.error('Upload error:', error)
    }

    setUploading(false)
  }

  const toggleCertification = (cert: string) => {
    const current = form.certifications || []
    if (current.includes(cert)) {
      setForm({ ...form, certifications: current.filter(c => c !== cert) })
    } else {
      setForm({ ...form, certifications: [...current, cert] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await onSave(form)
    } catch (error) {
      console.error('Save error:', error)
    }
    
    setLoading(false)
  }

  // Vérifier si la poudre est proche de la péremption
  const isNearExpiry = form.date_peremption && 
    new Date(form.date_peremption) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const isExpired = form.date_peremption && new Date(form.date_peremption) < new Date()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Alerte péremption */}
      {(isNearExpiry || isExpired) && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          isExpired 
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
        }`}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">
              {isExpired ? 'Poudre périmée !' : 'Péremption proche'}
            </p>
            <p className="text-sm">
              Date de péremption : {new Date(form.date_peremption!).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      )}

      {/* Informations de base */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Informations générales
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Référence *</label>
            <input
              type="text"
              required
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Ex: PE-7016-M"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Marque *</label>
            <input
              type="text"
              required
              value={form.marque}
              onChange={(e) => setForm({ ...form, marque: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Ex: IGP, Akzo Nobel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="polyester">Polyester</option>
              <option value="epoxy">Époxy</option>
              <option value="epoxy-polyester">Époxy-Polyester (Hybride)</option>
              <option value="polyurethane">Polyuréthane</option>
              <option value="acrylique">Acrylique</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">RAL</label>
            <input
              type="text"
              value={form.ral || ''}
              onChange={(e) => setForm({ ...form, ral: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Ex: 7016"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Finition</label>
            <select
              value={form.finition || 'mat'}
              onChange={(e) => setForm({ ...form, finition: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="mat">Mat</option>
              <option value="satine">Satiné</option>
              <option value="brillant">Brillant</option>
              <option value="texture">Texturé</option>
              <option value="metallise">Métallisé</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fournisseur</label>
            <input
              type="text"
              value={form.fournisseur || ''}
              onChange={(e) => setForm({ ...form, fournisseur: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Ex: Axalta, PPG"
            />
          </div>
        </div>
      </div>

      {/* Stock et prix */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-green-600" />
          Stock et tarification
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Stock actuel (kg)</label>
            <input
              type="number"
              step="0.1"
              value={form.stock_reel_kg || 0}
              onChange={(e) => setForm({ ...form, stock_reel_kg: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stock minimum (kg)</label>
            <input
              type="number"
              step="0.1"
              value={form.stock_min_kg || 5}
              onChange={(e) => setForm({ ...form, stock_min_kg: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prix/kg (€)</label>
            <input
              type="number"
              step="0.01"
              value={form.prix_kg || 0}
              onChange={(e) => setForm({ ...form, prix_kg: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Traçabilité */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-600" />
          Traçabilité
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">N° de lot</label>
            <input
              type="text"
              value={form.numero_lot || ''}
              onChange={(e) => setForm({ ...form, numero_lot: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Ex: LOT2024-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date de réception</label>
            <input
              type="date"
              value={form.date_reception || ''}
              onChange={(e) => setForm({ ...form, date_reception: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date de péremption</label>
            <input
              type="date"
              value={form.date_peremption || ''}
              onChange={(e) => setForm({ ...form, date_peremption: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${
                isExpired ? 'border-red-500 bg-red-50' : isNearExpiry ? 'border-amber-500 bg-amber-50' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Paramètres de cuisson */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-4">Paramètres de cuisson</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Température (°C)</label>
            <input
              type="number"
              value={form.temp_cuisson || 180}
              onChange={(e) => setForm({ ...form, temp_cuisson: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Durée (minutes)</label>
            <input
              type="number"
              value={form.duree_cuisson || 20}
              onChange={(e) => setForm({ ...form, duree_cuisson: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Certifications */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-600" />
          Certifications
        </h3>
        
        <div className="space-y-4">
          {/* Badges spéciaux */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.qualicoat_approved}
                onChange={(e) => setForm({ ...form, qualicoat_approved: e.target.checked })}
                className="rounded"
              />
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-blue-600" />
                QUALICOAT
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.qualimarine_approved}
                onChange={(e) => setForm({ ...form, qualimarine_approved: e.target.checked })}
                className="rounded"
              />
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-cyan-600" />
                QUALIMARINE
              </span>
            </label>
          </div>

          {/* Autres certifications */}
          <div className="flex flex-wrap gap-2">
            {certificationOptions.filter(c => !['QUALICOAT', 'QUALIMARINE'].includes(c)).map((cert) => (
              <button
                key={cert}
                type="button"
                onClick={() => toggleCertification(cert)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  form.certifications?.includes(cert)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {cert}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-600" />
          Documents
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Fiche technique */}
          <div>
            <label className="block text-sm font-medium mb-2">Fiche technique (PDF)</label>
            {form.fiche_technique_url ? (
              <div className="flex items-center gap-2">
                <a
                  href={form.fiche_technique_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Voir le document
                </a>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, fiche_technique_url: '' })}
                  className="text-red-500 text-sm"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {uploadingFT ? 'Upload...' : 'Ajouter fiche technique'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'fiche_technique')}
                  disabled={uploadingFT}
                />
              </label>
            )}
          </div>

          {/* FDS */}
          <div>
            <label className="block text-sm font-medium mb-2">Fiche de Données Sécurité (FDS)</label>
            {form.fds_url ? (
              <div className="flex items-center gap-2">
                <a
                  href={form.fds_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Voir le document
                </a>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, fds_url: '' })}
                  className="text-red-500 text-sm"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {uploadingFDS ? 'Upload...' : 'Ajouter FDS'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'fds')}
                  disabled={uploadingFDS}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : poudre?.id ? 'Mettre à jour' : 'Créer la poudre'}
        </button>
      </div>
    </form>
  )
}
