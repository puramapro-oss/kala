/**
 * capture-screenshots.ts — Script réutilisable pour captures d'écran V1-CORE KALA
 *
 * Usage:
 *   npx tsx scripts/capture-screenshots.ts
 *
 * Dépendances:
 *   npm install -D tsx @playwright/test
 *
 * Prérequis:
 *   - Le serveur dev doit tourner sur http://localhost:3000
 *   - Les profs de démo seedés en DB (app_id='kala', est_demo=true)
 *   - User test demo-client@test.kala créé (profil d1000000-0000-4000-8000-000000000001)
 *   - Réservation en_cours f1000000-0000-4000-8000-000000000001
 *
 * Sortie:
 *   screenshots/*.png (12 fichiers = 2 écrans × 3 viewports × 2 [viewport + pleine page])
 */

import { chromium, Page, BrowserContext } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = join(process.cwd(), 'screenshots');

// 3 viewports VEGA (mobile/tablette/desktop)
const VIEWPORTS = [
  { name: '375', width: 375, height: 812 }, // mobile
  { name: '768', width: 768, height: 1024 }, // tablette
  { name: '1440', width: 1440, height: 900 }, // desktop
];

// 4 écrans V1-CORE (SPEC.md §1.1)
// NOTE: reservation+journal échouent si auth indisponible → capturés publics seulement
const SCREENS = [
  { name: 'home', path: '/', description: 'Accueil (carte profs sans compte)', auth: false },
  { name: 'prof', path: '/prof/c0000000-0000-4000-8000-000000000001', description: 'Profil prof vérifié', auth: false },
];

async function captureScreen(page: Page, screen: typeof SCREENS[0], viewport: typeof VIEWPORTS[0]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const url = `${BASE_URL}${screen.path}`;

  console.log(`  📸 ${screen.name} @ ${viewport.name}px…`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

    // Vérification programmatique CSS appliqué (next/font + Tailwind)
    const cssCheck = await page.waitForFunction(() => {
      const body = document.body;
      const h1 = document.querySelector('h1');

      if (!body || !h1) return false;

      const bgColor = window.getComputedStyle(body).backgroundColor;
      const h1Font = window.getComputedStyle(h1).fontFamily;

      // bgColor doit être #0A0A0F (rgb(10, 10, 15)) ou proche, PAS transparent ni blanc
      const isValidBg = bgColor.includes('rgb(10, 10, 15)') || bgColor.includes('rgb(10,10,15)');

      // h1 doit avoir Fraunces (police custom next/font), PAS police système
      const isValidFont = h1Font.toLowerCase().includes('fraunces');

      return isValidBg && isValidFont;
    }, { timeout: 10000 }).catch(() => null);

    if (!cssCheck) {
      // Extraire valeurs réelles pour debug
      const actualBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
      const actualFont = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1 ? window.getComputedStyle(h1).fontFamily : 'NO_H1_FOUND';
      });
      throw new Error(`CSS non appliqué après 10s — bg: ${actualBg}, h1Font: ${actualFont}`);
    }

    // Log preuve programmatique
    const bgColor = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    const h1Font = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? window.getComputedStyle(h1).fontFamily : 'NO_H1';
    });
    console.log(`    🎨 CSS validé — bg: ${bgColor}, h1Font: ${h1Font}`);

    const filename = `${screen.name}-${viewport.name}-dark.png`;
    const filepath = join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });

    const fullFilename = `${screen.name}-${viewport.name}-dark-full.png`;
    const fullFilepath = join(SCREENSHOTS_DIR, fullFilename);
    await page.screenshot({ path: fullFilepath, fullPage: true });

    console.log(`    ✅ ${filename} + ${fullFilename}`);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`    ❌ ÉCHEC ${screen.name}@${viewport.name}: ${error.message}`);
    throw error; // fail bruyamment
  }
}

/**
 * Authentifie session Playwright via VRAIE connexion (formulaire /signup puis /login).
 * Pose cookies Supabase SSR valides au lieu de forger localStorage.
 */
async function authenticateSession(page: Page): Promise<void> {
  const TEST_EMAIL = 'demo-pw-test@test.kala';
  const TEST_PASSWORD = 'TestDemo2026!';

  console.log('  🔐 Création compte test + authentification...');

  // D'abord signup (ignore si déjà existe)
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000); // laisser temps création

  // Puis login (que le user existe ou non)
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);

  // Soumettre et attendre redirection
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ]);

  const finalUrl = page.url();
  console.log(`    → Redirigé vers ${finalUrl}`);

  if (finalUrl.includes('/login')) {
    throw new Error('❌ Connexion échouée — toujours sur /login');
  }

  console.log('    ✅ Session établie\n');
}

async function main() {
  console.log('🎬 Capture screenshots KALA V1-CORE\n');
  console.log('⚠️  Auth Supabase indisponible → capturés publics seulement (home+prof)\n');

  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    colorScheme: 'dark', // KALA est dark-only (globals.css L31-35)
  });

  const page = await context.newPage();

  for (const screen of SCREENS) {
    console.log(`📄 ${screen.description}`);
    for (const viewport of VIEWPORTS) {
      await captureScreen(page, screen, viewport);
    }
    console.log('');
  }

  await browser.close();

  const totalCaptures = SCREENS.length * VIEWPORTS.length;
  console.log(`\n✅ ${totalCaptures} captures terminées dans ${SCREENSHOTS_DIR}`);
}

main().catch((err) => {
  console.error('💥 Erreur fatale:', err);
  process.exit(1);
});
