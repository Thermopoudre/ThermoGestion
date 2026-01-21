'use client'

import { useState, useRef, useEffect } from 'react'
import { QRCode } from 'react-qrcode-logo'

interface ProjetQRCodeProps {
  projetId: string
  projetNumero: string
  projetName: string
}

export function ProjetQRCode({ projetId, projetNumero, projetName }: ProjetQRCodeProps) {
  const [showModal, setShowModal] = useState(false)
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const projetUrl = `${baseUrl}/app/projets/${projetId}`

  const handleDownload = () => {
    const canvas = document.querySelector('#projet-qr-code canvas') as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `qr-${projetNumero}.png`
      link.href = url
      link.click()
    }
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const canvas = document.querySelector('#projet-qr-code canvas') as HTMLCanvasElement
      const qrImage = canvas?.toDataURL('image/png')
      
      printWindow.document.write(`
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
            .container {
              text-align: center;
              border: 2px solid #e5e7eb;
              padding: 30px;
              border-radius: 12px;
            }
            h1 { 
              font-size: 24px; 
              margin-bottom: 5px;
              color: #1f2937;
            }
            h2 {
              font-size: 16px;
              color: #6b7280;
              margin-bottom: 20px;
              font-weight: normal;
            }
            img { 
              margin: 20px 0; 
            }
            p {
              font-size: 12px;
              color: #9ca3af;
              margin-top: 15px;
            }
            @media print {
              body { padding: 0; }
              .container { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${projetNumero}</h1>
            <h2>${projetName}</h2>
            <img src="${qrImage}" width="200" height="200" />
            <p>Scannez pour voir le projet</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        QR Code
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div 
              className="fixed inset-0 bg-black/50" 
              onClick={() => setShowModal(false)}
            />
            
            <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>

              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{projetNumero}</h3>
                <p className="text-sm text-gray-500 mb-6">{projetName}</p>

                <div id="projet-qr-code" className="flex justify-center mb-6 p-4 bg-white rounded-xl border border-gray-200">
                  <QRCode
                    value={projetUrl}
                    size={200}
                    ecLevel="H"
                    qrStyle="squares"
                    logoImage="/logo-icon.svg"
                    logoWidth={40}
                    logoHeight={40}
                    removeQrCodeBehindLogo={true}
                    quietZone={10}
                  />
                </div>

                <p className="text-xs text-gray-400 mb-6">
                  Scannez ce QR code pour accéder au projet
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={handleDownload}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    📥 Télécharger
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    🖨️ Imprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
