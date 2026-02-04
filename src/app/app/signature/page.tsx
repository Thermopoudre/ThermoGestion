'use client'

import { useState, useRef, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Pen, Check, X, RotateCcw, Download, 
  Calendar, Package, User, FileText
} from 'lucide-react'
import Link from 'next/link'

interface Document {
  id: string
  type: 'devis' | 'bl'
  numero: string
  client_name: string
  date: string
  signed: boolean
  signature?: string
}

export default function SignaturePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    if (selectedDoc && canvasRef.current) {
      initCanvas()
    }
  }, [selectedDoc])

  async function loadDocuments() {
    const supabase = createBrowserClient()
    
    const { data: devis } = await supabase
      .from('devis')
      .select('id, numero, created_at, client:clients(full_name)')
      .in('status', ['envoye', 'brouillon'])
      .limit(10)

    const { data: bls } = await supabase
      .from('projets')
      .select('id, numero, created_at, client:clients(full_name)')
      .eq('status', 'termine')
      .limit(10)

    const docs: Document[] = [
      ...(devis || []).map(d => ({
        id: d.id,
        type: 'devis' as const,
        numero: d.numero,
        client_name: (d.client as { full_name: string })?.full_name || 'Client',
        date: d.created_at,
        signed: false,
      })),
      ...(bls || []).map(b => ({
        id: b.id,
        type: 'bl' as const,
        numero: `BL-${b.numero}`,
        client_name: (b.client as { full_name: string })?.full_name || 'Client',
        date: b.created_at,
        signed: false,
      })),
    ]

    setDocuments(docs)
    setLoading(false)
  }

  function initCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Style
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    setHasSignature(true)

    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) 
      ? e.touches[0].clientX - rect.left 
      : e.clientX - rect.left
    const y = ('touches' in e) 
      ? e.touches[0].clientY - rect.top 
      : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) 
      ? e.touches[0].clientX - rect.left 
      : e.clientX - rect.left
    const y = ('touches' in e) 
      ? e.touches[0].clientY - rect.top 
      : e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopDrawing() {
    setIsDrawing(false)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  function saveSignature() {
    if (!selectedDoc || !hasSignature) return

    const canvas = canvasRef.current
    if (!canvas) return

    const signature = canvas.toDataURL('image/png')

    // Update document
    setDocuments(documents.map(d => 
      d.id === selectedDoc.id 
        ? { ...d, signed: true, signature } 
        : d
    ))

    // Clear selection
    setSelectedDoc(null)
    setHasSignature(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
          Signature Tablette
        </h1>
        <p className="text-gray-500">
          Faites signer vos clients directement sur tablette
        </p>
      </div>

      {selectedDoc ? (
        /* Signature Mode */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {/* Document Info */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-2 ${
                    selectedDoc.type === 'devis' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {selectedDoc.type === 'devis' ? 'Devis' : 'Bon de Livraison'}
                  </span>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                    {selectedDoc.numero}
                  </h2>
                  <p className="text-gray-500 flex items-center gap-2 mt-1">
                    <User className="w-4 h-4" />
                    {selectedDoc.client_name}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedDoc(null); setHasSignature(false) }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Signature Area */}
            <div className="p-6">
              <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                Signez ci-dessous avec votre doigt ou un stylet
              </p>
              
              <div className="relative bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
                <canvas
                  ref={canvasRef}
                  className="w-full h-64 touch-none cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                
                {/* Signature Line */}
                <div className="absolute bottom-8 left-8 right-8 border-b border-gray-400 dark:border-gray-500" />
                <span className="absolute bottom-2 left-8 text-xs text-gray-400">
                  Signature
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={clearCanvas}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <RotateCcw className="w-5 h-5" />
                  Effacer
                </button>

                <button
                  onClick={saveSignature}
                  disabled={!hasSignature}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-5 h-5" />
                  Valider la signature
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Documents List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Unsigned Documents */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              Documents a signer
            </h2>

            {documents.filter(d => !d.signed).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Pen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun document en attente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.filter(d => !d.signed).map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                  >
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-1 ${
                        doc.type === 'devis' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {doc.type === 'devis' ? 'Devis' : 'BL'}
                      </span>
                      <p className="font-bold text-gray-900 dark:text-white">{doc.numero}</p>
                      <p className="text-sm text-gray-500">{doc.client_name}</p>
                    </div>
                    <Pen className="w-5 h-5 text-orange-500" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Signed Documents */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Documents signes
            </h2>

            {documents.filter(d => d.signed).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Check className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun document signe</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.filter(d => d.signed).map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      {doc.signature && (
                        <img 
                          src={doc.signature} 
                          alt="Signature"
                          className="w-16 h-10 object-contain bg-white rounded"
                        />
                      )}
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{doc.numero}</p>
                        <p className="text-sm text-gray-500">{doc.client_name}</p>
                      </div>
                    </div>
                    <Check className="w-6 h-6 text-green-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
