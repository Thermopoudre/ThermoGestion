'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Devis = Database['public']['Tables']['devis']['Row']

interface SignatureDevisProps {
  devis: Devis
  userId: string
}

export function SignatureDevis({ devis, userId }: SignatureDevisProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signMethod, setSignMethod] = useState<'draw' | 'upload'>('draw')

  // Initialiser le canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return

    const signatureData = canvas.toDataURL('image/png')
    setSignature(signatureData)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignature(null)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Redimensionner l'image pour s'adapter au canvas
        const maxWidth = canvas.width
        const maxHeight = canvas.height
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
        setSignature(canvas.toDataURL('image/png'))
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!signature) {
      setError('Veuillez signer le devis')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Récupérer l'IP (approximatif côté client)
      const ipResponse = await fetch('https://api.ipify.org?format=json')
      const ipData = await ipResponse.json()
      const ipAddress = ipData.ip || 'unknown'

      // Upload signature vers Supabase Storage
      const signatureBlob = await fetch(signature).then(res => res.blob())
      const signatureFileName = `signature-${devis.id}-${Date.now()}.png`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(signatureFileName, signatureBlob, {
          contentType: 'image/png',
          upsert: false,
        })

      if (uploadError) {
        // Si le bucket n'existe pas, on stocke juste la data URL dans la BDD
        console.warn('Erreur upload signature:', uploadError)
      }

      const signatureUrl = uploadData?.path 
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/signatures/${signatureFileName}`
        : signature // Fallback sur data URL

      // Appeler l'API pour signer le devis ET créer le projet automatiquement
      const response = await fetch(`/api/devis/${devis.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_url: signatureUrl,
          signature_method: signMethod,
          ip_address: ipAddress,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la signature')
      }

      // Rediriger vers le projet si créé automatiquement
      if (result.projetCreated && result.projetId) {
        // Afficher un message de succès avant la redirection
        alert(`✅ Devis signé avec succès !\n\n📁 Projet ${result.projetNumero} créé automatiquement.`)
        router.push(`/app/projets/${result.projetId}`)
      } else {
        router.push(`/app/devis/${devis.id}`)
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la signature')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Signature électronique obligatoire
          </h2>
          <p className="text-sm text-gray-600">
            En signant ce devis, vous acceptez les conditions et le montant de {Number(devis.total_ttc).toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            })} TTC.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {/* Choix méthode signature */}
        <div className="mb-6">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setSignMethod('draw')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                signMethod === 'draw'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✏️ Dessiner
            </button>
            <button
              type="button"
              onClick={() => setSignMethod('upload')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                signMethod === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📤 Upload image
            </button>
          </div>
        </div>

        {/* Zone signature */}
        {signMethod === 'draw' ? (
          <div className="mb-6">
            <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full border border-gray-200 rounded cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="flex gap-4 mt-4">
              <button
                type="button"
                onClick={clearSignature}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Effacer
              </button>
              {signature && (
                <p className="text-sm text-green-600 flex items-center">
                  ✓ Signature prête
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Uploader une image de signature
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {signature && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">✓ Image chargée avec succès</p>
              </div>
            )}
          </div>
        )}

        {/* Aperçu signature */}
        {signature && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Aperçu de la signature :</p>
            <img src={signature} alt="Signature" className="max-w-xs border border-gray-300 rounded" />
          </div>
        )}

        {/* Informations légales */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Signature électronique :</strong> Cette signature a valeur légale. 
            Elle sera horodatée et enregistrée avec votre adresse IP pour traçabilité.
            En signant, vous acceptez les conditions du devis.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleSubmit}
            disabled={loading || !signature}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signature en cours...' : '✓ Signer le devis'}
          </button>
          <a
            href={`/app/devis/${devis.id}`}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </a>
        </div>
      </div>
    </div>
  )
}
