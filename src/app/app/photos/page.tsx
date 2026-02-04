'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Camera, Upload, Image, Grid, List, Trash2, 
  Download, Search, Filter, ChevronLeft, ChevronRight,
  X, ZoomIn, Calendar, Package
} from 'lucide-react'
import Link from 'next/link'

interface Photo {
  id: string
  url: string
  type: 'avant' | 'apres' | 'process'
  projet_id: string
  created_at: string
  projet?: {
    numero: string
    description: string
    client?: { full_name: string }
  }
}

interface Projet {
  id: string
  numero: string
  description: string
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProjet, setSelectedProjet] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mock photos for demo
  const mockPhotos: Photo[] = [
    { id: '1', url: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400', type: 'avant', projet_id: '1', created_at: new Date().toISOString() },
    { id: '2', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', type: 'apres', projet_id: '1', created_at: new Date().toISOString() },
    { id: '3', url: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=400', type: 'process', projet_id: '2', created_at: new Date().toISOString() },
  ]

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createBrowserClient()
    
    const { data: projetsData } = await supabase
      .from('projets')
      .select('id, numero, description')
      .order('created_at', { ascending: false })
      .limit(50)

    setProjets(projetsData || [])
    
    // In real implementation, load from storage
    setPhotos(mockPhotos.map((p, i) => ({
      ...p,
      projet: projetsData?.[i % (projetsData?.length || 1)] ? {
        numero: projetsData[i % projetsData.length].numero,
        description: projetsData[i % projetsData.length].description,
      } : undefined
    })))
    
    setLoading(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !selectedProjet) return

    setUploading(true)
    const supabase = createBrowserClient()

    for (const file of Array.from(files)) {
      const fileName = `${selectedProjet}/${Date.now()}-${file.name}`
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('photos')
        .upload(fileName, file)

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName)

        // Add to state
        const newPhoto: Photo = {
          id: Date.now().toString(),
          url: publicUrl,
          type: 'avant',
          projet_id: selectedProjet,
          created_at: new Date().toISOString(),
        }
        setPhotos(prev => [newPhoto, ...prev])
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function downloadPhoto(photo: Photo) {
    const link = document.createElement('a')
    link.href = photo.url
    link.download = `photo-${photo.id}.jpg`
    link.click()
  }

  const filteredPhotos = photos.filter(photo => {
    if (selectedProjet && photo.projet_id !== selectedProjet) return false
    if (selectedType && photo.type !== selectedType) return false
    if (search && photo.projet) {
      const searchLower = search.toLowerCase()
      if (!photo.projet.numero.toLowerCase().includes(searchLower) &&
          !photo.projet.description?.toLowerCase().includes(searchLower)) {
        return false
      }
    }
    return true
  })

  const typeLabels = {
    avant: { label: 'Avant', color: 'bg-blue-500' },
    apres: { label: 'Après', color: 'bg-green-500' },
    process: { label: 'Processus', color: 'bg-orange-500' },
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Galerie Photos</h1>
          <p className="text-gray-500">Photos avant/après de vos projets</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedProjet || uploading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            Ajouter des photos
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Project Filter */}
          <select
            value={selectedProjet}
            onChange={(e) => setSelectedProjet(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Tous les projets</option>
            {projets.map(p => (
              <option key={p.id} value={p.id}>{p.numero}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Tous les types</option>
            <option value="avant">Avant</option>
            <option value="apres">Après</option>
            <option value="process">Processus</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
            >
              <Grid className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
            >
              <List className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Photos Grid/List */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-16">
          <Image className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucune photo</h2>
          <p className="text-gray-500 mb-4">
            Sélectionnez un projet et ajoutez des photos avant/après
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhotos.map(photo => (
            <div
              key={photo.id}
              className="group relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden cursor-pointer"
              onClick={() => setLightboxPhoto(photo)}
            >
              <img
                src={photo.url}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
              
              {/* Type Badge */}
              <span className={`absolute top-2 left-2 px-2 py-1 text-xs font-bold text-white rounded-lg ${typeLabels[photo.type].color}`}>
                {typeLabels[photo.type].label}
              </span>

              {/* Hover Actions */}
              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadPhoto(photo) }}
                  className="p-2 bg-white rounded-lg shadow hover:bg-gray-100"
                >
                  <Download className="w-4 h-4 text-gray-700" />
                </button>
              </div>

              {/* Project Info */}
              {photo.projet && (
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm font-bold">{photo.projet.numero}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPhotos.map(photo => (
            <div
              key={photo.id}
              className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setLightboxPhoto(photo)}
            >
              <img
                src={photo.url}
                alt=""
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs font-bold text-white rounded ${typeLabels[photo.type].color}`}>
                    {typeLabels[photo.type].label}
                  </span>
                  {photo.projet && (
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {photo.projet.numero}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(photo.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); downloadPhoto(photo) }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg"
            onClick={() => setLightboxPhoto(null)}
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={lightboxPhoto.url}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Info Panel */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-lg rounded-xl px-6 py-3">
            <div className="flex items-center gap-4 text-white">
              <span className={`px-3 py-1 text-sm font-bold rounded-lg ${typeLabels[lightboxPhoto.type].color}`}>
                {typeLabels[lightboxPhoto.type].label}
              </span>
              {lightboxPhoto.projet && (
                <span className="font-bold">{lightboxPhoto.projet.numero}</span>
              )}
              <span className="text-white/70">
                {new Date(lightboxPhoto.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
