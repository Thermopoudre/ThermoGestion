'use client'

import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'

interface ProjetQRCodeProps {
  projetId: string
  projetNumero: string
  size?: number
  showPrint?: boolean
}

export function ProjetQRCode({ projetId, projetNumero, size = 200, showPrint = true }: ProjetQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  const scanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${projetId}`

  useEffect(() => {
    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(scanUrl, {
          width: size,
          margin: 2,
          color: {
            dark: '#1f2937',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        })
        setQrDataUrl(dataUrl)
      } catch (error) {
        console.error('Erreur génération QR:', error)
      } finally {
        setLoading(false)
      }
    }

    generateQR()
  }, [projetId, size, scanUrl])

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${projetNumero}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .qr-container {
            text-align: center;
            border: 3px solid #1f2937;
            border-radius: 12px;
            padding: 30px;
            background: white;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #f97316;
            margin-bottom: 15px;
          }
          .qr-image {
            margin: 20px 0;
          }
          .projet-numero {
            font-size: 28px;
            font-weight: bold;
            color: #1f2937;
            margin-top: 15px;
          }
          .instructions {
            font-size: 14px;
            color: #6b7280;
            margin-top: 15px;
            max-width: 250px;
          }
          @media print {
            body { padding: 0; }
            .qr-container { border: 2px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <div class="logo">🔥 ThermoGestion</div>
          <img src="${qrDataUrl}" alt="QR Code" class="qr-image" width="250" height="250" />
          <div class="projet-numero">${projetNumero}</div>
          <div class="instructions">
            Scannez ce QR code pour mettre à jour le statut du projet
          </div>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="animate-pulse bg-gray-200 rounded-lg" style={{ width: size, height: size }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div 
        ref={printRef}
        className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-100"
      >
        {qrDataUrl && (
          <img 
            src={qrDataUrl} 
            alt={`QR Code projet ${projetNumero}`}
            width={size}
            height={size}
            className="rounded-lg"
          />
        )}
        <p className="text-center mt-3 font-bold text-gray-900">{projetNumero}</p>
      </div>
      
      {showPrint && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            🖨️ Imprimer
          </button>
          <a
            href={qrDataUrl}
            download={`qr-${projetNumero}.png`}
            className="flex items-center gap-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm font-medium transition-colors"
          >
            📥 Télécharger
          </a>
        </div>
      )}
    </div>
  )
}
