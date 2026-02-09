import { test, expect } from '@playwright/test'

/**
 * Tests E2E - Parcours critiques
 * 
 * Teste les flux les plus importants de l'application:
 * 1. Pages publiques accessibles
 * 2. Formulaire de devis public
 * 3. Page blog et ressources
 * 4. Page SLA
 * 5. Page roadmap
 * 6. Page DPA
 */

test.describe('Pages publiques', () => {
  test('page d\'accueil charge correctement', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/ThermoGestion/)
    // Vérifier qu'il y a du contenu
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('page tarifs accessible', async ({ page }) => {
    await page.goto('/tarifs')
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('page SLA accessible avec contenu', async ({ page }) => {
    await page.goto('/sla')
    await expect(page.locator('h1')).toContainText(/SLA|Engagements/)
    await expect(page.locator('body')).toContainText('99')
  })

  test('page DPA accessible avec contenu RGPD', async ({ page }) => {
    await page.goto('/dpa')
    await expect(page.locator('h1')).toContainText(/DPA|Données/)
    await expect(page.locator('body')).toContainText('RGPD')
  })

  test('page roadmap accessible', async ({ page }) => {
    await page.goto('/roadmap')
    await expect(page.locator('h1')).toContainText(/Roadmap/)
    await expect(page.locator('body')).toContainText(/Disponible|Planifié/)
  })

  test('page blog accessible', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.locator('h1')).toContainText(/Blog|Ressources/)
  })

  test('page status accessible', async ({ page }) => {
    await page.goto('/status')
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })
})

test.describe('Devis public', () => {
  test('formulaire de devis public fonctionne', async ({ page }) => {
    await page.goto('/devis-public')
    
    // Étape 1: Sélection type de pièce
    await expect(page.locator('h1')).toContainText(/Devis/)
    
    // Cliquer sur un type de pièce
    await page.locator('button:has-text("Portail")').click()
    
    // Cliquer sur Continuer
    await page.locator('button:has-text("Continuer")').click()
    
    // Étape 2: Options
    await expect(page.locator('body')).toContainText(/Finition/)
    
    // Sélectionner brillant
    await page.locator('button:has-text("Brillant")').click()
    
    // Cliquer sur Voir estimation
    await page.locator('button:has-text("estimation")').click()
    
    // Étape 3: Vérifier estimation visible
    await expect(page.locator('body')).toContainText(/€/)
    await expect(page.locator('body')).toContainText(/Nom/)
  })
})

test.describe('API Health', () => {
  test('endpoint health check fonctionne', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.status).toBe('ok')
  })

  test('endpoint API v1 documentation accessible', async ({ request }) => {
    const response = await request.get('/api/v1')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.name).toBe('ThermoGestion API')
    expect(body.version).toBe('1.0.0')
    expect(body.endpoints).toBeDefined()
  })
})
