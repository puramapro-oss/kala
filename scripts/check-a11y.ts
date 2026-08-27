/**
 * check-a11y.ts — Scan axe-core (WCAG2AA) sur home + fiche prof, 3 viewports (T-60).
 *
 * Usage:
 *   npx tsx scripts/check-a11y.ts
 *
 * Prérequis : serveur (dev ou prod) sur http://localhost:3000, profs démo seedés.
 * Sortie : exit 1 si une violation color-contrast (ou toute violation critical/serious) trouvée.
 */

import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = 'http://localhost:3000';

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];

const SCREENS = [
  { name: 'home', path: '/' },
  { name: 'prof', path: '/prof/c0000000-0000-4000-8000-000000000001' },
];

async function main() {
  console.log('♿ Scan axe-core (WCAG2AA) KALA\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();

  let totalViolations = 0;
  let totalContrastViolations = 0;

  for (const screen of SCREENS) {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BASE_URL}${screen.path}`, { waitUntil: 'networkidle', timeout: 15000 });

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

      const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
      totalContrastViolations += contrastViolations.length;
      totalViolations += results.violations.length;

      const label = `${screen.name}@${viewport.name}px`;
      if (results.violations.length === 0) {
        console.log(`  ✅ ${label} — 0 violation`);
      } else {
        console.log(`  ❌ ${label} — ${results.violations.length} violation(s):`);
        for (const v of results.violations) {
          console.log(`      [${v.id}] ${v.impact} — ${v.nodes.length} nœud(s)`);
          for (const node of v.nodes.slice(0, 5)) {
            console.log(`        ${node.target.join(' ')} — ${node.failureSummary?.split('\n')[0] ?? ''}`);
          }
        }
      }
    }
  }

  await browser.close();

  console.log(`\n${totalViolations === 0 ? '✅' : '❌'} Total : ${totalViolations} violation(s), dont ${totalContrastViolations} color-contrast`);

  if (totalViolations > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Erreur fatale:', err);
  process.exit(1);
});
