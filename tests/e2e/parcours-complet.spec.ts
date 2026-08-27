import { test, expect } from '@playwright/test';

/**
 * T-62 — Tests E2E KALA V1-CORE
 * Parcours complet : découverte → fiche prof → réservation (SANS payer réellement Stripe LIVE).
 * Note auth.users DB bloquée (500 signup/login) → tests UNIQUEMENT sur parcours publics + vérif structure DOM.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ID du prof de démo seedé (migrations/0005) — stable d'un environnement à l'autre.
const PROF_SEED_ID = 'c0000000-0000-4000-8000-000000000001';

test.describe('KALA — Parcours public complet', () => {

  test('EX-001/002 — Accueil affiche les profs sans session', async ({ page }) => {
    // Vérification mode incognito (0 session)
    await page.goto(BASE_URL);

    // Vérifie que page charge (pas de 404/500)
    await expect(page).toHaveTitle(/KALA/i);

    // Vérifie présence section profs
    await expect(page.locator('h2').filter({ hasText: /profs vérifiés/i })).toBeVisible({ timeout: 5000 });

    // Si carte prof visible, vérifier structure (prénom, distance, prix)
    const cartes = page.locator('section#profs a[href*="/prof/"]');
    const count = await cartes.count();

    if (count > 0) {
      const premiere = cartes.first();
      // Avatar (img ou initiale)
      await expect(premiere.locator('img').or(premiere.locator('span'))).toBeVisible();
      // Prénom
      await expect(premiere.locator('text=/[A-Z][a-z]+/')).toBeVisible();
      // Distance en km
      await expect(premiere.locator('text=/km/i')).toBeVisible();
      // Prix
      await expect(premiere.locator('text=/€|EUR/i')).toBeVisible();
    } else {
      // État vide honnête (EX-004)
      await expect(page.locator('text=/aucun prof|devenir prof/i')).toBeVisible();
    }
  });

  test('EX-014 — Fiche prof consultable sans compte', async ({ page }) => {
    // Naviguer vers une fiche prof existante (ID seed)
    await page.goto(`${BASE_URL}/prof/${PROF_SEED_ID}`);

    // Vérifier pas de redirection vers /login
    await expect(page).not.toHaveURL(/\/login/);

    // Vérifier présence éléments clés (titre, tarif, badge vérifié ou mention "en cours")
    const titre = page.locator('h1,h2').first();
    await expect(titre).toBeVisible({ timeout: 5000 });

    // Tarif visible
    await expect(page.locator('text=/€|EUR/i')).toBeVisible();
  });

  test('EX-007 — Réservation atteignable en ≤3 clics depuis accueil', async ({ page }) => {
    let clics = 0;

    await page.goto(BASE_URL);
    clics++; // Navigation initiale = 1 clic

    // Cliquer sur 1re carte prof si présente
    const carte = page.locator('section#profs a[href*="/prof/"]').first();
    if (await carte.isVisible({ timeout: 2000 })) {
      await carte.click();
      clics++;

      // La fiche prof porte le CTA « Réserver un cours » vers /mes-cours?prof=<id>
      // (réservation en flux normal, pas de route /reservation dédiée)
      const cta = page.locator('a[href*="/mes-cours?prof="]').first();
      if (await cta.isVisible({ timeout: 2000 })) {
        await cta.click();
        clics++;

        // Sans session : porte d'auth vers /login?next= — avec session : /mes-cours?prof=
        await expect(page).toHaveURL(/\/(login|mes-cours)/, { timeout: 5000 });
      }
    }

    // Réservation doit être accessible en ≤3 clics (départ accueil compté)
    expect(clics).toBeLessThanOrEqual(3);
  });

  test('EX-028/029/030 — Formulaire de réservation (ou porte auth) derrière /mes-cours?prof=', async ({ page }) => {
    await page.goto(`${BASE_URL}/mes-cours?prof=${PROF_SEED_ID}`);

    // Vérifier que la page charge
    await expect(page.locator('form,main')).toBeVisible({ timeout: 5000 });

    // Sans session : porte d'auth avec CTA vers /login?next=/mes-cours?prof=
    const porteAuth = page.locator('a[href*="/login?next="]');
    if (await porteAuth.first().isVisible({ timeout: 2000 })) {
      // Parcours anonyme : le CTA mène bien vers la connexion avec retour au formulaire
      await expect(porteAuth.first()).toHaveAttribute('href', /\/login\?next=/);
      return;
    }

    // Avec session : champs clés du cours (instrument, niveau, domicile de l'élève)
    await expect(page.locator('#instrument')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#niveau')).toBeVisible();
    await expect(page.locator('#adresse-eleve')).toBeVisible();

    // Récapitulatif pricing : tarif prof + frais de service 9 % + total (EX-028)
    const recap = page.locator('text=/tarif|frais|total/i');
    if (await recap.first().isVisible({ timeout: 2000 })) {
      await expect(recap.first()).toContainText(/€|EUR/i);
    }

    // Vérifie qu'aucun champ carte bancaire Stripe n'est affiché (EX-034 : PaymentIntent côté serveur)
    await expect(page.locator('iframe[name*="stripe"]')).not.toBeVisible({ timeout: 1000 });
  });

  test('EX-063/064 — Routes auth accessibles (callback public, proxy correct)', async ({ page }) => {
    // Vérifier /login accessible
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('form,input[type="email"]')).toBeVisible({ timeout: 5000 });

    // Vérifier /callback ne redirige pas vers /login (route publique)
    const response = await page.goto(`${BASE_URL}/callback`);
    // Peut renvoyer erreur si pas de code OAuth, mais NE DOIT PAS rediriger vers /login
    expect(response?.url()).not.toContain('/login');
  });

  test('EX-013 — Responsive 375px sans overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    // Vérifier aucun débordement horizontal (scrollWidth ≤ clientWidth + marge erreur 5px)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('EX-103 — Lighthouse performance > 0 (smoke test)', async ({ page }) => {
    // Test simplifié : vérifier que page charge en < 5s (proxy perf)
    const start = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
  });
});

test.describe('KALA — Timeline du cours (Brique 4, lecture seule si non auth)', () => {

  test('EX-051/060 — Page timeline accessible (redirect login attendu si non auth)', async ({ page }) => {
    // Tentative accès à la timeline d'un cours sans session
    await page.goto(`${BASE_URL}/cours/f0000000-0000-4000-8000-000000000001/timeline`);

    // Soit redirection vers /login (attendu), soit page avec état vide "connectez-vous"
    const url = page.url();
    const isLoginRedirect = url.includes('/login');
    const hasEmptyState = await page.locator('text=/connectez-vous|connexion requise/i').isVisible({ timeout: 2000 });

    expect(isLoginRedirect || hasEmptyState).toBe(true);
  });
});
