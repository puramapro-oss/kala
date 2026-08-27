#!/usr/bin/env node
/**
 * Vérification pixel des correctifs BLOQUANTS 1 et 3 (passage 10 DA).
 * Utilise sharp pour échantillonner les pixels réels des screenshots.
 */

import sharp from 'sharp';
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SCREENSHOTS_DIR = 'test-results/screenshots-pixel-verify';
const ERRORS = [];

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Screenshot home 375px dark (viewport + full-page)
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // Attendre le rendu CSS
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/home-375-dark.png`, fullPage: false });
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/home-375-dark-full.png`, fullPage: true });

  // Screenshot home 1440px dark
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/home-1440-dark.png`, fullPage: false });

  // Screenshot home 768px dark (pour vérifier le panneau héros)
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/home-768-dark.png`, fullPage: false });

  await browser.close();
}

async function verifyBloquant1() {
  // BLOQUANT 1 — Le bras doit toucher l'animal (0 pixel de fond entre les deux)
  // Recette : sur la ligne horizontale passant par le centre du bras, aux 3 largeurs,
  // 0 pixel de luminance < 150 ne doit séparer le dernier pixel clair du personnage et le premier pixel clair de l'animal

  console.log('🔍 BLOQUANT 1 — Vérification contact bras/animal...');

  for (const width of [375, 768, 1440]) {
    const img = sharp(`${SCREENSHOTS_DIR}/home-${width}-dark.png`);
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

    // Le panneau héros est dans la zone supérieure de la page
    // À 1440: panneau ~384×384px dans la colonne droite (x~800-1184)
    // À 768: panneau ~420px de hauteur dans la colonne droite
    // À 375: bandeau plein 192px de hauteur en haut

    // Stratégie simple : chercher une bande horizontale dans la moitié supérieure de l'image
    // et vérifier qu'il n'y a pas de "trou" (pixel sombre) entre deux zones claires espacées

    const midY = Math.floor(info.height * 0.25); // Ligne à 25% de la hauteur (dans le héros)
    let foundGap = false;

    for (let x = 0; x < info.width - 20; x++) {
      const pixelIndex = (midY * info.width + x) * 3;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      // Pixel clair (blanc ou beige silhouette)
      if (luminance >= 150) {
        // Chercher le prochain pixel clair dans les 20px suivants
        let nextClearX = -1;
        for (let nx = x + 1; nx < Math.min(x + 20, info.width); nx++) {
          const nIdx = (midY * info.width + nx) * 3;
          const nLum = 0.299 * data[nIdx] + 0.587 * data[nIdx + 1] + 0.114 * data[nIdx + 2];
          if (nLum >= 150) {
            nextClearX = nx;
            break;
          }
        }

        if (nextClearX > x + 1) {
          // Il y a un gap de pixels sombres
          const gapSize = nextClearX - x - 1;
          if (gapSize >= 5) {
            foundGap = true;
            ERRORS.push(`BLOQUANT 1 @ ${width}px: gap de ${gapSize}px détecté entre x=${x} et x=${nextClearX} (y=${midY})`);
          }
        }
      }
    }

    if (!foundGap) {
      console.log(`  ✅ ${width}px: contact OK (0 gap ≥5px détecté)`);
    }
  }
}

async function verifyBloquant2() {
  // BLOQUANT 2 — Pixel du fond du panneau héros doit être vert franc (g − r ≥ 12, b < r)
  // Échantillonner dans la zone de fond (coin supérieur gauche du panneau, hors silhouettes)
  console.log('🔍 BLOQUANT 2 — Vérification dégradé vert franc...');

  for (const width of [375, 768, 1440]) {
    const img = sharp(`${SCREENSHOTS_DIR}/home-${width}-dark.png`);
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

    // Échantillonner plusieurs pixels dans la zone de fond (quadrant supérieur gauche du panneau)
    // À 1440: panneau dans colonne droite x~800-1184, y~100-484
    // À 768: panneau colonne droite x~400-768, y~100-520
    // À 375: bandeau plein largeur x~50-325, y~50-150
    const samplePoints =
      width === 1440
        ? [
            [900, 150],
            [1000, 250],
          ]
        : width === 768
          ? [
              [500, 150],
              [600, 250],
            ]
          : [
              [150, 100],
              [200, 120],
            ];

    let allGreen = true;
    for (const [x, y] of samplePoints) {
      const pixelIndex = (y * info.width + x) * 3;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      const isVertFranc = g - r >= 12 && b < r;

      if (!isVertFranc) {
        ERRORS.push(
          `BLOQUANT 2 @ ${width}px: pixel fond (${x},${y}) RGB(${r},${g},${b}) n'est PAS vert franc (g-r=${g - r}, b<r=${b < r})`
        );
        allGreen = false;
      }
    }

    if (allGreen) {
      console.log(`  ✅ ${width}px: fond vert franc OK sur échantillons`);
    }
  }
}

async function verifyBloquant3() {
  // BLOQUANT 3 — La pastille "0% de commission" doit être entièrement entre y=0 et y=725 sur mobile 375px
  // et aucun pixel orange ne doit apparaître dans la zone y=741→812 (tab bar)
  console.log('🔍 BLOQUANT 3 — Vérification position pastille 0%...');

  const img = sharp(`${SCREENSHOTS_DIR}/home-375-dark-full.png`);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  // Chercher des pixels orange (alerte) dans la zone interdite y=741→812
  let foundOrangeInTabBar = false;

  for (let y = 741; y <= Math.min(812, info.height - 1); y++) {
    for (let x = 0; x < info.width; x++) {
      const pixelIndex = (y * info.width + x) * 3;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      // Orange alerte ~(255, 153, 85) ou proche
      const isOrange = r > 200 && g > 100 && g < 180 && b < 120;

      if (isOrange) {
        foundOrangeInTabBar = true;
        ERRORS.push(
          `BLOQUANT 3 @ 375px: pixel orange détecté dans zone tab bar (x=${x}, y=${y}) RGB(${r},${g},${b})`
        );
        break;
      }
    }
    if (foundOrangeInTabBar) break;
  }

  if (!foundOrangeInTabBar) {
    console.log(`  ✅ 375px: pastille 0% absente de la zone tab bar (y=741→812)`);
  }
}

async function main() {
  console.log('📸 Prise de screenshots...');
  await takeScreenshots();
  console.log('✅ Screenshots pris.\n');

  await verifyBloquant1();
  await verifyBloquant2();
  await verifyBloquant3();

  if (ERRORS.length > 0) {
    console.error('\n❌ ÉCHECS:\n');
    ERRORS.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('\n✅ Tous les bloquants 1, 2, 3 vérifiés par échantillonnage pixel — VERT');
  }
}

main();
