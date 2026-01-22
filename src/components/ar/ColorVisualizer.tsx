'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Palette, RotateCcw, Download, X, Check, Sparkles } from 'lucide-react'

// Couleurs RAL les plus courantes
const RAL_COLORS: Record<string, { name: string; hex: string }> = {
  '1015': { name: 'Ivoire clair', hex: '#E6D2B5' },
  '3000': { name: 'Rouge feu', hex: '#AB2524' },
  '3020': { name: 'Rouge signalisation', hex: '#C1121C' },
  '5010': { name: 'Bleu gentiane', hex: '#13447C' },
  '5015': { name: 'Bleu ciel', hex: '#2874B2' },
  '6005': { name: 'Vert mousse', hex: '#114232' },
  '6009': { name: 'Vert sapin', hex: '#27352A' },
  '7016': { name: 'Gris anthracite', hex: '#373F43' },
  '7035': { name: 'Gris clair', hex: '#C5C7C4' },
  '7040': { name: 'Gris fenêtre', hex: '#9EA3A6' },
  '8017': { name: 'Brun chocolat', hex: '#442F29' },
  '9001': { name: 'Blanc crème', hex: '#FDF4E3' },
  '9005': { name: 'Noir foncé', hex: '#0A0A0D' },
  '9010': { name: 'Blanc pur', hex: '#F7F7F2' },
  '9016': { name: 'Blanc signalisation', hex: '#F4F8F4' }
}

interface ColorVisualizerProps {
  onSelect?: (ral: string, hex: string) => void
}

export default function ColorVisualizer({ onSelect }: ColorVisualizerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [selectedRal, setSelectedRal] = useState<string | null>('7016')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [overlayOpacity, setOverlayOpacity] = useState(50)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Activer la caméra
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setIsCameraActive(true)
      }
    } catch (error) {
      console.error('Erreur caméra:', error)
      alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
    }
  }

  // Arrêter la caméra
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCameraActive(false)
  }

  // Capturer une image
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    
    const imageData = canvas.toDataURL('image/jpeg')
    setCapturedImage(imageData)
    stopCamera()
  }

  // Reset
  const reset = () => {
    setCapturedImage(null)
    stopCamera()
  }

  // Télécharger l'image avec overlay
  const downloadImage = () => {
    if (!capturedImage || !selectedRal || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      
      // Dessiner l'image
      ctx.drawImage(img, 0, 0)
      
      // Appliquer l'overlay coloré
      ctx.fillStyle = RAL_COLORS[selectedRal].hex
      ctx.globalAlpha = overlayOpacity / 100
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1
      
      // Ajouter le texte RAL
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 24px Arial'
      ctx.fillText(`RAL ${selectedRal} - ${RAL_COLORS[selectedRal].name}`, 20, canvas.height - 20)
      
      // Télécharger
      const link = document.createElement('a')
      link.download = `visualisation-RAL-${selectedRal}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.9)
      link.click()
    }
    img.src = capturedImage
  }

  // Cleanup à la destruction
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const selectedColor = selectedRal ? RAL_COLORS[selectedRal] : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-300" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Visualisation de couleur</h3>
            <p className="text-sm text-gray-500">Prenez une photo et visualisez la couleur RAL</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Zone de visualisation */}
        <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden mb-4">
          {!isCameraActive && !capturedImage ? (
            // Écran d'accueil
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
              <Camera className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Prenez une photo de votre pièce</p>
              <p className="text-sm">Pour visualiser la couleur RAL souhaitée</p>
              <button
                onClick={startCamera}
                className="mt-4 flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Camera className="w-5 h-5" />
                Activer la caméra
              </button>
            </div>
          ) : isCameraActive ? (
            // Vue caméra
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Overlay de couleur en live */}
              {selectedColor && (
                <div 
                  className="absolute inset-0 pointer-events-none mix-blend-multiply"
                  style={{ 
                    backgroundColor: selectedColor.hex,
                    opacity: overlayOpacity / 100
                  }}
                />
              )}
              {/* Bouton capture */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
                <button
                  onClick={stopCamera}
                  className="p-3 bg-gray-600/80 text-white rounded-full hover:bg-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
                <button
                  onClick={captureImage}
                  className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100"
                >
                  <div className="w-10 h-10 border-4 border-purple-600 rounded-full" />
                </button>
              </div>
            </>
          ) : capturedImage ? (
            // Image capturée avec overlay
            <>
              <img
                src={capturedImage}
                alt="Capture"
                className="w-full h-full object-cover"
              />
              {selectedColor && (
                <div 
                  className="absolute inset-0 pointer-events-none mix-blend-multiply"
                  style={{ 
                    backgroundColor: selectedColor.hex,
                    opacity: overlayOpacity / 100
                  }}
                />
              )}
              {/* Infos couleur */}
              {selectedColor && (
                <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg">
                  <p className="font-bold">RAL {selectedRal}</p>
                  <p className="text-sm">{selectedColor.name}</p>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Canvas caché pour le traitement */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Sélection de couleur */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Couleur RAL
          </label>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(RAL_COLORS).map(([ral, color]) => (
              <button
                key={ral}
                onClick={() => {
                  setSelectedRal(ral)
                  if (onSelect) onSelect(ral, color.hex)
                }}
                className={`relative aspect-square rounded-lg border-2 transition-all ${
                  selectedRal === ral 
                    ? 'border-purple-600 ring-2 ring-purple-300 scale-105' 
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color.hex }}
                title={`RAL ${ral} - ${color.name}`}
              >
                {selectedRal === ral && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className={`w-6 h-6 ${
                      ['9001', '9010', '9016', '7035', '1015'].includes(ral) 
                        ? 'text-gray-800' 
                        : 'text-white'
                    }`} />
                  </div>
                )}
              </button>
            ))}
          </div>
          {selectedColor && (
            <p className="mt-2 text-sm text-gray-500">
              Sélectionné : <span className="font-medium">RAL {selectedRal} - {selectedColor.name}</span>
            </p>
          )}
        </div>

        {/* Contrôle d'opacité */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Intensité de l'overlay : {overlayOpacity}%
          </label>
          <input
            type="range"
            min="10"
            max="90"
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {capturedImage && (
            <>
              <button
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Recommencer
              </button>
              <button
                onClick={downloadImage}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </button>
            </>
          )}
        </div>

        {/* Note */}
        <p className="mt-4 text-xs text-gray-400 text-center">
          Note : Cette visualisation est approximative. Les couleurs réelles peuvent varier selon l'éclairage et le support.
        </p>
      </div>
    </div>
  )
}
