'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PublicSignatureFormProps {
  devis: any
  atelier: any
  client: any
  token: string
}

export function PublicSignatureForm({ devis, atelier, client, token }: PublicSignatureFormProps) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    // Set drawing style
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const pos = getPosition(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
    setHasSignature(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const pos = getPosition(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSubmit = async () => {
    if (!hasSignature || !accepted) return

    setLoading(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas non disponible')

      const signatureData = canvas.toDataURL('image/png')

      const response = await fetch(`/api/public/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureData,
          acceptedTerms: accepted,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la signature')
      }

      setSuccess(true)
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/p/${token}`)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const items = devis.items || []

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Devis signé avec succès !
          </h1>
          <p className="text-gray-600 mb-6">
            Merci pour votre confiance. Votre projet va être pris en charge rapidement.
          </p>
          <div className="text-sm text-gray-500">
            Redirection en cours...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">🔥</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{atelier?.name}</h1>
              <p className="text-xs text-gray-500">Signature de devis</p>
            </div>
          </div>
          <Link 
            href={`/p/${token}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Retour au devis
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Devis Summary */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="p-6 border-b bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-bold text-gray-900">Devis {devis.numero}</h2>
                <p className="text-sm text-gray-500">
                  Du {new Date(devis.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Client</p>
                <p className="font-medium text-gray-900">{client?.full_name}</p>
              </div>
            </div>
          </div>

          {/* Items Summary */}
          <div className="p-6 border-b">
            <h3 className="font-medium text-gray-900 mb-4">Récapitulatif</h3>
            <div className="space-y-3">
              {items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{item.designation}</p>
                    <p className="text-gray-500">Qté: {item.quantite}</p>
                  </div>
                  <p className="font-medium">{(item.total_ht || 0).toFixed(2)} €</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="p-6 bg-gray-50">
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total HT</span>
                <span className="font-medium">{Number(devis.total_ht).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">TVA ({devis.tva_rate}%)</span>
                <span className="font-medium">
                  {(Number(devis.total_ttc) - Number(devis.total_ht)).toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total TTC</span>
                <span className="text-orange-600">{Number(devis.total_ttc).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>✍️</span> Signature électronique
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Signez dans le cadre ci-dessous pour accepter ce devis
            </p>
          </div>

          <div className="p-6">
            {/* Error */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Signature Canvas */}
            <div className="relative mb-6">
              <canvas
                ref={canvasRef}
                className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair bg-white touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-gray-400 text-sm">Signez ici avec votre souris ou votre doigt</p>
                </div>
              )}
            </div>

            {/* Clear button */}
            <button
              type="button"
              onClick={clearSignature}
              className="text-sm text-gray-500 hover:text-gray-700 mb-6"
            >
              🗑️ Effacer la signature
            </button>

            {/* Terms acceptance */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-600">
                J'accepte ce devis et m'engage à régler le montant total de{' '}
                <strong>{Number(devis.total_ttc).toFixed(2)} €</strong> selon les conditions de paiement 
                convenues. Je reconnais avoir pris connaissance des conditions générales de vente.
              </span>
            </label>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!hasSignature || !accepted || loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-4 px-8 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Signature en cours...
                </>
              ) : (
                <>
                  ✓ Signer et accepter le devis
                </>
              )}
            </button>

            {/* Legal info */}
            <p className="mt-4 text-xs text-gray-400 text-center">
              Cette signature électronique a valeur légale conformément au règlement eIDAS (UE) n° 910/2014.
              <br />
              Date et heure de signature enregistrées automatiquement.
            </p>
          </div>
        </div>

        {/* Create Account CTA */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-2">
            Après signature, créez un compte pour suivre tous vos projets
          </p>
          <Link
            href={`/client/auth/inscription?email=${encodeURIComponent(client?.email || '')}`}
            className="text-orange-600 hover:text-orange-700 font-medium text-sm"
          >
            En savoir plus →
          </Link>
        </div>
      </main>
    </div>
  )
}
