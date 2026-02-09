const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Accept cookies to remove banner for cleaner screenshots
  await page.goto('https://thermogestion.vercel.app/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({necessary:true,analytics:false,marketing:false}));
  });

  const pages = [
    { name: 'homepage', url: '/', scroll: [0, 800, 1600, 2400, 3200, 4000] },
    { name: 'tarifs', url: '/tarifs', scroll: [0, 600, 1200] },
    { name: 'fonctionnalites', url: '/fonctionnalites', scroll: [0, 800, 1600] },
    { name: 'login', url: '/auth/login', scroll: [0] },
    { name: 'inscription', url: '/auth/inscription', scroll: [0] },
    { name: 'contact', url: '/contact', scroll: [0] },
    { name: 'temoignages', url: '/temoignages', scroll: [0, 800] },
    { name: 'aide', url: '/aide', scroll: [0, 800] },
    { name: 'cgu', url: '/cgu', scroll: [0] },
    { name: 'sla', url: '/sla', scroll: [0] },
    { name: 'blog', url: '/blog', scroll: [0] },
    { name: 'roadmap', url: '/roadmap', scroll: [0] },
  ];

  for (const p of pages) {
    console.log(`Capturing ${p.name}...`);
    await page.goto(`https://thermogestion.vercel.app${p.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    for (let i = 0; i < p.scroll.length; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), p.scroll[i]);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `screenshots/audit-${p.name}-${i}.png` });
    }
  }

  // Now login and check app pages
  console.log('Logging in...');
  await page.goto('https://thermogestion.vercel.app/auth/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'test.thermogestion@gmail.com');
  await page.fill('input[type="password"]', 'ThermoTest2024!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  const appPages = [
    { name: 'dashboard', url: '/app/dashboard', scroll: [0, 600] },
    { name: 'clients', url: '/app/clients', scroll: [0] },
    { name: 'projets', url: '/app/projets', scroll: [0] },
    { name: 'devis', url: '/app/devis', scroll: [0] },
    { name: 'factures', url: '/app/factures', scroll: [0] },
    { name: 'poudres', url: '/app/poudres', scroll: [0] },
    { name: 'parametres-atelier', url: '/app/parametres/atelier', scroll: [0] },
    { name: 'abonnement', url: '/app/parametres/abonnement', scroll: [0, 500] },
  ];

  for (const p of appPages) {
    console.log(`Capturing app/${p.name}...`);
    await page.goto(`https://thermogestion.vercel.app${p.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    for (let i = 0; i < p.scroll.length; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), p.scroll[i]);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `screenshots/audit-app-${p.name}-${i}.png` });
    }
  }

  // Mobile viewport
  console.log('Mobile audit...');
  const mobilePage = await ctx.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto('https://thermogestion.vercel.app/', { waitUntil: 'networkidle' });
  await mobilePage.evaluate(() => {
    localStorage.setItem('cookie_consent', JSON.stringify({necessary:true,analytics:false,marketing:false}));
  });
  await mobilePage.goto('https://thermogestion.vercel.app/', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({ path: 'screenshots/audit-mobile-home.png' });
  await mobilePage.goto('https://thermogestion.vercel.app/tarifs', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({ path: 'screenshots/audit-mobile-tarifs.png' });
  await mobilePage.goto('https://thermogestion.vercel.app/auth/login', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({ path: 'screenshots/audit-mobile-login.png' });

  console.log('Done! All screenshots taken.');
  await browser.close();
})().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
