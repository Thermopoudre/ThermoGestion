'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Printer, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface ProjetQRCodeFullProps {
  projet: {
    id: string
    numero: string
    name: string
    qr_token?: string | null
  }
  size?: 'sm' | 'md' | 'lg'
  showActions?: boolean
}

export default function ProjetQRCodeFull({ projet, size = 'md', showActions = true }: ProjetQRCodeFullProps) {
  const supabase = createClientComponentClient()
  const [copied, setCopied] = useState(false)
  const [qrToken, setQrToken] = useState(projet.qr_token)
  const [regenerating, setRegenerating] = useState(false)

  const qrSize = size === 'sm' ? 128 : size === 'md' ? 200 : 300
  const scanUrl = qrToken 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${qrToken}`
    : null

  const regenerateToken = async () => {
    setRegenerating(true)
    try {
      const newToken = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
      
      const { error } = await supabase
        .from('projets')
        .update({ 
          qr_token: newToken,
          qr_generated_at: new Date().toISOString()
        })
        .eq('id', projet.id)

      if (!error) {
        setQrToken(newToken)
      }
    } catch (e) {
      console.error('Error regenerating QR token:', e)
    }
    setRegenerating(false)
  }

  const copyToClipboard = async () => {
    if (scanUrl) {
      await navigator.clipboard.writeText(scanUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadQR = () => {
    const svg = document.getElementById(`qr-${projet.id}`)
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    canvas.width = qrSize * 2
    canvas.height = qrSize * 2
    
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        const a = document.createElement('a')
        a.download = `QR-${projet.numero}.png`
        a.href = canvas.toDataURL('image/png')
        a.click()
      }
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const printQR = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const svg = document.getElementById(`qr-${projet.id}`)
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${projet.numero}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .container {
              text-align: center;
              padding: 20px;
            }
            .qr-code {
              margin: 20px auto;
            }
            h1 { font-size: 24px; margin-bottom: 8px; }
            p { color: #666; margin: 4px 0; }
            .numero { font-size: 18px; font-weight: 600; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${projet.name}</h1>
            <p class="numero">${projet.numero}</p>
            <div class="qr-code">${svgData}</div>
            <p>Scanner pour voir le statut</p>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  if (!qrToken) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <p className="text-gray-500 mb-4">Pas de QR code généré</p>
        <button
          onClick={regenerateToken}
          disabled={regenerating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {regenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Générer QR Code
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {/* QR Code */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
        <QRCodeSVG
          id={`qr-${projet.id}`}
          value={scanUrl || ''}
          size={qrSize}
          level="H"
          includeMargin
          imageSettings={{
            src: '/logo-icon.png',
            height: qrSize * 0.15,
            width: qrSize * 0.15,
            excavate: true
          }}
        />
      </div>

      {/* Infos */}
      <div className="text-center mt-4">
        <p className="font-semibold text-gray-900 dark:text-white">{projet.numero}</p>
        <p className="text-sm text-gray-500 truncate max-w-[200px]">{projet.name}</p>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Copier le lien"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
          
          <button
            onClick={downloadQR}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Télécharger PNG"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={printQR}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Imprimer"
          >
            <Printer className="w-4 h-4" />
          </button>
          
          <a
            href={scanUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            title="Ouvrir le lien"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Régénérer */}
      {showActions && (
        <button
          onClick={regenerateToken}
          disabled={regenerating}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
          Régénérer le QR code
        </button>
      )}
    </div>
  )
}
