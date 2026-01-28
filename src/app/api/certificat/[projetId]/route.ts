import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Génération du certificat de conformité en HTML (convertible en PDF)
export async function GET(
  request: NextRequest,
  { params }: { params: { projetId: string } }
) {
  try {
    const supabase = await createServerClient()

    // Charger le projet avec toutes les infos
    const { data: projet, error } = await supabase
      .from('projets')
      .select(`
        *,
        clients (full_name, email, address, phone),
        poudres (reference, ral, marque, finition, numero_lot, qualicoat_approved, qualimarine_approved),
        ateliers (name, address, phone, email, siret),
        devis (numero)
      `)
      .eq('id', params.projetId)
      .single()

    if (error || !projet) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    }

    // Charger le dernier contrôle qualité si disponible
    const { data: controle } = await supabase
      .from('controles_qualite')
      .select('*')
      .eq('projet_id', params.projetId)
      .eq('etape', 'final')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Numéro certificat
    const numeroCertificat = `CERT-${new Date().getFullYear()}-${projet.numero.replace('PROJ-', '')}`
    const dateEmission = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })

    // Générer le HTML du certificat
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Certificat de Conformité - ${numeroCertificat}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Helvetica Neue', Arial, sans-serif; 
      font-size: 11pt;
      color: #333;
      padding: 40px;
      max-width: 210mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #f97316;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24pt;
      font-weight: bold;
      color: #f97316;
    }
    .logo span { color: #333; }
    .cert-info {
      text-align: right;
    }
    .cert-number {
      font-size: 14pt;
      font-weight: bold;
      color: #f97316;
    }
    .title {
      text-align: center;
      font-size: 20pt;
      font-weight: bold;
      margin: 30px 0;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      color: #f97316;
      margin-bottom: 15px;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .field {
      margin-bottom: 10px;
    }
    .field-label {
      font-size: 9pt;
      color: #666;
      text-transform: uppercase;
    }
    .field-value {
      font-size: 11pt;
      font-weight: 500;
    }
    .conformity-box {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 5px 0;
    }
    .check {
      width: 20px;
      height: 20px;
      border: 2px solid #10b981;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #10b981;
      font-weight: bold;
    }
    .check.fail {
      border-color: #ef4444;
      color: #ef4444;
    }
    .certifications {
      display: flex;
      gap: 15px;
      margin-top: 10px;
    }
    .certification-badge {
      padding: 5px 12px;
      background: #dbeafe;
      color: #1d4ed8;
      border-radius: 4px;
      font-size: 10pt;
      font-weight: bold;
    }
    .signature-section {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .signature-box {
      border-top: 1px solid #ccc;
      padding-top: 10px;
      text-align: center;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    @media print {
      body { padding: 20px; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo"><span>🔥</span> ThermoGestion</div>
      <div style="margin-top: 10px; font-size: 10pt; color: #666;">
        ${(projet.ateliers as any)?.name || ''}<br>
        ${(projet.ateliers as any)?.address || ''}<br>
        ${(projet.ateliers as any)?.phone || ''}<br>
        ${(projet.ateliers as any)?.siret ? `SIRET: ${(projet.ateliers as any).siret}` : ''}
      </div>
    </div>
    <div class="cert-info">
      <div class="cert-number">${numeroCertificat}</div>
      <div style="font-size: 10pt; color: #666; margin-top: 5px;">
        Date d'émission: ${dateEmission}
      </div>
    </div>
  </div>

  <div class="title">Certificat de Conformité</div>

  <div class="section">
    <div class="section-title">Informations Projet</div>
    <div class="grid">
      <div class="field">
        <div class="field-label">Numéro de projet</div>
        <div class="field-value">${projet.numero}</div>
      </div>
      <div class="field">
        <div class="field-label">Désignation</div>
        <div class="field-value">${projet.name}</div>
      </div>
      <div class="field">
        <div class="field-label">Client</div>
        <div class="field-value">${(projet.clients as any)?.full_name || '-'}</div>
      </div>
      <div class="field">
        <div class="field-label">Date de réalisation</div>
        <div class="field-value">${projet.date_livre ? new Date(projet.date_livre).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Revêtement Appliqué</div>
    <div class="grid">
      <div class="field">
        <div class="field-label">Référence poudre</div>
        <div class="field-value">${(projet.poudres as any)?.reference || '-'}</div>
      </div>
      <div class="field">
        <div class="field-label">Fabricant</div>
        <div class="field-value">${(projet.poudres as any)?.marque || '-'}</div>
      </div>
      <div class="field">
        <div class="field-label">Teinte RAL</div>
        <div class="field-value">${(projet.poudres as any)?.ral ? `RAL ${(projet.poudres as any).ral}` : '-'}</div>
      </div>
      <div class="field">
        <div class="field-label">Finition</div>
        <div class="field-value">${(projet.poudres as any)?.finition || '-'}</div>
      </div>
      <div class="field">
        <div class="field-label">Numéro de lot</div>
        <div class="field-value">${(projet.poudres as any)?.numero_lot || '-'}</div>
      </div>
      <div class="field">
        <div class="field-label">Nombre de couches</div>
        <div class="field-value">${projet.couches || 1}</div>
      </div>
    </div>
    ${(projet.poudres as any)?.qualicoat_approved || (projet.poudres as any)?.qualimarine_approved ? `
    <div class="certifications">
      ${(projet.poudres as any)?.qualicoat_approved ? '<span class="certification-badge">QUALICOAT</span>' : ''}
      ${(projet.poudres as any)?.qualimarine_approved ? '<span class="certification-badge">QUALIMARINE</span>' : ''}
    </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">Paramètres de Cuisson</div>
    <div class="grid">
      <div class="field">
        <div class="field-label">Température</div>
        <div class="field-value">${projet.temp_cuisson || (projet.poudres as any)?.temp_cuisson || '-'}°C</div>
      </div>
      <div class="field">
        <div class="field-label">Durée</div>
        <div class="field-value">${projet.duree_cuisson || (projet.poudres as any)?.duree_cuisson || '-'} minutes</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Contrôle Qualité</div>
    <div class="grid">
      <div>
        <div class="conformity-box">
          <div class="check">${controle?.epaisseur_conforme !== false ? '✓' : '✗'}</div>
          <span>Épaisseur conforme ${controle?.epaisseur_mesuree ? `(${controle.epaisseur_mesuree} µm)` : ''}</span>
        </div>
        <div class="conformity-box">
          <div class="check">${controle?.adherence_conforme !== false ? '✓' : '✗'}</div>
          <span>Test d'adhérence conforme</span>
        </div>
        <div class="conformity-box">
          <div class="check">${controle?.aspect_conforme !== false ? '✓' : '✗'}</div>
          <span>Aspect visuel conforme</span>
        </div>
      </div>
      <div>
        <div class="conformity-box">
          <div class="check">${controle?.couleur_conforme !== false ? '✓' : '✗'}</div>
          <span>Couleur conforme</span>
        </div>
        <div class="conformity-box">
          <div class="check">${controle?.brillance_conforme !== false ? '✓' : '✗'}</div>
          <span>Brillance conforme</span>
        </div>
      </div>
    </div>
    ${controle?.observations ? `
    <div class="field" style="margin-top: 15px;">
      <div class="field-label">Observations</div>
      <div class="field-value">${controle.observations}</div>
    </div>
    ` : ''}
  </div>

  <div style="margin-top: 30px; padding: 15px; background: #ecfdf5; border-radius: 8px; text-align: center;">
    <div style="font-size: 14pt; font-weight: bold; color: #059669;">
      ✓ CONFORME
    </div>
    <div style="font-size: 10pt; color: #065f46; margin-top: 5px;">
      Ce produit a été traité conformément aux normes en vigueur.
    </div>
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <div style="height: 60px;"></div>
      <div>Contrôleur qualité</div>
    </div>
    <div class="signature-box">
      <div style="height: 60px;"></div>
      <div>Responsable atelier</div>
    </div>
  </div>

  <div class="footer">
    <p>Ce certificat atteste que le traitement de surface a été réalisé conformément aux spécifications techniques.</p>
    <p style="margin-top: 5px;">Document généré automatiquement par ThermoGestion - ${new Date().toISOString()}</p>
  </div>
</body>
</html>
    `

    // Retourner le HTML (peut être converti en PDF côté client ou via un service)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Erreur génération certificat:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
