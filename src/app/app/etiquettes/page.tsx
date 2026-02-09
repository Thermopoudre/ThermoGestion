'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Printer, QrCode, Settings, Download, Tag } from 'lucide-react'
import QRCode from 'qrcode'

interface Projet {
  id: string
  numero: string
  name: string
  status: string
  clients?: { full_name: string } | null
  poudres?: { reference: string; ral: string; finition: string } | null
}

type LabelFormat = '100x50' | '70x30' | 'A6'

const FORMATS: Record<LabelFormat, { width: number; height: number; label: string }> = {
  '100x50': { width: 100, height: 50, label: '100 x 50 mm (standard four)' },
  '70x30': { width: 70, height: 30, label: '70 x 30 mm (petit)' },
  'A6': { width: 148, height: 105, label: 'A6 (148 x 105 mm)' },
}

export default function EtiquettesPage() {
  const supabase = createBrowserClient()
  const printRef = useRef<HTMLDivElement>(null)
  const [projets, setProjets] = useState<Projet[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [format, setFormat] = useState<LabelFormat>('100x50')
  const [loading, setLoading] = useState(false)
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')

  const loadProjets = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('projets')
      .select('id, numero, name, status, clients(full_name), poudres(reference, ral, finition)')
      .in('status', ['en_cours', 'en_cuisson', 'qc', 'pret'])
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) {
      setProjets(data as any)
      // Générer QR codes
      const codes: Record<string, string> = {}
      for (const p of data) {
        const url = `${window.location.origin}/scan/${p.id}`
        codes[p.id] = await QRCode.toDataURL(url, { width: 150, margin: 1 })
      }
      setQrCodes(codes)
    }
    setLoading(false)
  }

  useState(() => { loadProjets() })

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAll = () => {
    if (selected.length === projets.length) {
      setSelected([])
    } else {
      setSelected(projets.map(p => p.id))
    }
  }

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Étiquettes ThermoGestion</title>
      <style>
        @page { size: ${FORMATS[format].width}mm ${FORMATS[format].height}mm; margin: 2mm; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .label { 
          width: ${FORMATS[format].width - 4}mm; 
          height: ${FORMATS[format].height - 4}mm; 
          border: 1px solid #ccc; 
          padding: 2mm; 
          page-break-after: always;
          display: flex;
          gap: 3mm;
          box-sizing: border-box;
        }
        .label:last-child { page-break-after: auto; }
        .qr { flex-shrink: 0; }
        .qr img { width: ${Math.min(FORMATS[format].height - 8, 40)}mm; height: auto; }
        .info { flex: 1; font-size: ${format === '70x30' ? '7' : '9'}pt; line-height: 1.3; overflow: hidden; }
        .info .numero { font-weight: bold; font-size: ${format === '70x30' ? '9' : '12'}pt; margin-bottom: 1mm; }
        .info .client { color: #555; }
        .info .poudre { margin-top: 1mm; font-size: ${format === '70x30' ? '6' : '8'}pt; }
      </style></head><body>
    `)

    const selectedProjets = projets.filter(p => selected.includes(p.id))
    for (const p of selectedProjets) {
      win.document.write(`
        <div class="label">
          <div class="qr"><img src="${qrCodes[p.id] || ''}" /></div>
          <div class="info">
            <div class="numero">${p.numero}</div>
            <div class="client">${(p.clients as any)?.full_name || '-'}</div>
            <div>${p.name || ''}</div>
            <div class="poudre">${(p.poudres as any)?.reference || ''} ${(p.poudres as any)?.ral ? `RAL ${(p.poudres as any).ral}` : ''} ${(p.poudres as any)?.finition || ''}</div>
          </div>
        </div>
      `)
    }
    win.document.write('</body></html>')
    win.document.close()
    win.print()
  }

  const filteredProjets = projets.filter(p => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return p.numero.toLowerCase().includes(term) 
      || p.name?.toLowerCase().includes(term) 
      || (p.clients as any)?.full_name?.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-7 h-7 text-orange-500" />
            Étiquettes imprimables
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Générez des étiquettes avec QR code pour vos projets en cours (résistant four)
          </p>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          Format d&apos;étiquette
        </h3>
        <div className="flex gap-3 flex-wrap">
          {(Object.entries(FORMATS) as [LabelFormat, typeof FORMATS[LabelFormat]][]).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setFormat(key)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                format === key 
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
              }`}
            >
              {val.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sélection projets */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher un projet..."
              className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm w-64"
            />
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:underline"
            >
              {selected.length === projets.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            <span className="text-sm text-gray-500">{selected.length} sélectionné(s)</span>
          </div>
          <button
            onClick={handlePrint}
            disabled={selected.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimer ({selected.length})
          </button>
        </div>
        
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Chargement...</div>
          ) : filteredProjets.map(p => (
            <label key={p.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggleSelect(p.id)}
                className="rounded border-gray-300"
              />
              {qrCodes[p.id] && (
                <img src={qrCodes[p.id]} alt="QR" className="w-10 h-10 rounded" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{p.numero}</div>
                <div className="text-xs text-gray-500 truncate">{(p.clients as any)?.full_name} — {p.name}</div>
              </div>
              <div className="text-xs text-gray-400">
                {(p.poudres as any)?.reference} {(p.poudres as any)?.ral ? `RAL ${(p.poudres as any).ral}` : ''}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Aperçu (hidden, pour impression) */}
      <div ref={printRef} className="hidden" />
    </div>
  )
}
