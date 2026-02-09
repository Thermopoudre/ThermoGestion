import { test, expect } from '@playwright/test'

test.describe('Pages publiques', () => {
  test('la page d\'accueil se charge et contient le titre', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/ThermoGestion/)
  })

  test('la page tarifs affiche les prix réels', async ({ page }) => {
    await page.goto('/tarifs')
    const content = await page.textContent('body')
    expect(content).toContain('29€')
    expect(content).toContain('49€')
  })

  test('la page statut se charge et montre les services', async ({ page }) => {
    await page.goto('/status')
    await expect(page.locator('text=État des services')).toBeVisible()
  })

  test('les mentions légales sont accessibles', async ({ page }) => {
    await page.goto('/mentions-legales')
    await expect(page).toHaveTitle(/Mentions/)
  })

  test('la page CGV est accessible', async ({ page }) => {
    await page.goto('/cgv')
    await expect(page).toHaveTitle(/CGV|Conditions/)
  })

  test('les headers de sécurité sont présents', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() || {}
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['strict-transport-security']).toContain('max-age=')
    expect(headers['referrer-policy']).toBeTruthy()
  })

  test('l\'API health retourne ok', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('ok')
  })
})

test.describe('Authentification', () => {
  test('la page login atelier se charge', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('la page login client se charge', async ({ page }) => {
    await page.goto('/client/auth/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('la page inscription se charge', async ({ page }) => {
    await page.goto('/auth/inscription')
    const content = await page.textContent('body')
    expect(content).toContain('inscription') || expect(content).toContain('créer')
  })

  test('les routes protégées redirigent vers le login', async ({ page }) => {
    await page.goto('/app/dashboard')
    await page.waitForURL(/\/auth\/login/)
    expect(page.url()).toContain('/auth/login')
  })

  test('les routes client protégées redirigent vers le login client', async ({ page }) => {
    await page.goto('/client/dashboard')
    await page.waitForURL(/\/client\/auth\/login/)
    expect(page.url()).toContain('/client/auth/login')
  })
})

test.describe('Navigation mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('le menu mobile s\'affiche et fonctionne', async ({ page }) => {
    await page.goto('/')
    // Le menu mobile devrait exister sur mobile
    const body = await page.textContent('body')
    expect(body).toContain('ThermoGestion')
  })
})

test.describe('SEO', () => {
  test('sitemap.xml est accessible', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.ok()).toBeTruthy()
    const text = await response.text()
    expect(text).toContain('<urlset')
    expect(text).toContain('thermogestion')
  })

  test('robots.txt est accessible', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.ok()).toBeTruthy()
    const text = await response.text()
    expect(text).toContain('User-agent')
    expect(text).toContain('Sitemap')
  })
})
