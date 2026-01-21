import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force dynamic pour accéder aux variables d'environnement
export const dynamic = 'force-dynamic'

// Route pour initialiser les buckets Storage
// Utilise la clé de service depuis les variables d'environnement
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Variables d\'environnement manquantes' }, { status: 500 })
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const results: any[] = []

  // Créer le bucket photos
  const { data: photosData, error: photosError } = await supabase.storage.createBucket('photos', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  })
  results.push({ bucket: 'photos', success: !photosError, error: photosError?.message })

  // Créer le bucket pdfs
  const { data: pdfsData, error: pdfsError } = await supabase.storage.createBucket('pdfs', {
    public: true,
    fileSizeLimit: 20971520, // 20MB
    allowedMimeTypes: ['application/pdf']
  })
  results.push({ bucket: 'pdfs', success: !pdfsError, error: pdfsError?.message })

  // Créer le bucket signatures
  const { data: signaturesData, error: signaturesError } = await supabase.storage.createBucket('signatures', {
    public: true,
    fileSizeLimit: 1048576, // 1MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
  })
  results.push({ bucket: 'signatures', success: !signaturesError, error: signaturesError?.message })

  // Vérifier les buckets créés
  const { data: buckets } = await supabase.storage.listBuckets()

  return NextResponse.json({
    message: 'Setup terminé',
    results,
    buckets: buckets?.map(b => b.name) || []
  })
}
