#!/usr/bin/env node
/**
 * BLOQUANT 6.5 — check-tokens.mjs
 * Vérifie unicité des tokens design (rounded-*, hex bruts, text-primary nu).
 * Exit 1 si violation, 0 sinon.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { glob } from 'glob';

const errors = [];

// Whitelist rounded-* autorisés
const allowedRounded = new Set([
  'rounded-lg',
  'rounded-pill',
  'rounded-full', // uniquement avatars circulaires
  'rounded-sm',
]);

// 1. Grep rounded-* hors whitelist
const roundedRegex = /rounded-[a-z0-9]+/g;
const srcFiles = glob.sync('src/**/*.{ts,tsx}', { cwd: process.cwd() });

for (const file of srcFiles) {
  const content = readFileSync(file, 'utf8');
  const matches = content.matchAll(roundedRegex);
  for (const match of matches) {
    const token = match[0];
    if (!allowedRounded.has(token)) {
      errors.push(`${file}: rounded-* hors whitelist: ${token}`);
    }
  }
}

// 2. Grep hex bruts #[0-9A-Fa-f]{6} hors tailwind.config.ts et globals.css
// Exception: text-[#0A0A0F] est autorisé (fix contraste AA BLOQUANT 1)
const hexRegex = /#[0-9A-Fa-f]{6}/g;
const excludeHex = new Set(['tailwind.config.ts', 'globals.css']);
const allowedInlineHex = new Set(['#0A0A0F']); // Fix contraste AA

for (const file of srcFiles) {
  if (excludeHex.has(file.split('/').pop())) continue;
  const content = readFileSync(file, 'utf8');
  const matches = content.matchAll(hexRegex);
  for (const match of matches) {
    const hex = match[0];
    if (allowedInlineHex.has(hex)) continue; // Exception autorisée
    // Tolérer si dans resend.ts (emails, OG images, cas hors design système web)
    if (file.includes('resend.ts') || file.includes('api/og/route.tsx') || file.includes('(admin)/')) continue;
    errors.push(`${file}: hex brut non autorisé: ${hex}`);
  }
}

// 3. Grep text-primary nu (pas text-primary-on-dark, pas bg-primary, pas border-primary, pas text-primary-foreground)
const textPrimaryRegex = /\btext-primary\b/g;
const excludePrimaryFiles = new Set(['tailwind.config.ts', 'globals.css']);

for (const file of srcFiles) {
  if (excludePrimaryFiles.has(file.split('/').pop())) continue;
  const content = readFileSync(file, 'utf8');
  const matches = content.matchAll(textPrimaryRegex);
  for (const match of matches) {
    // Vérifier contexte : doit être suivi de -on-dark, -foreground, ou dans bg-/border-/ring-
    const idx = match.index;
    const before = content.slice(Math.max(0, idx - 10), idx);
    const after = content.slice(idx, Math.min(content.length, idx + 40));

    // Exclure si c'est bg-primary, border-primary, ring-primary, text-primary-on-dark, text-primary-foreground
    if (
      before.includes('bg-') ||
      before.includes('border-') ||
      before.includes('ring-') ||
      after.includes('text-primary-on-dark') ||
      after.includes('text-primary-foreground')
    ) {
      continue;
    }

    errors.push(`${file}:${idx}: text-primary nu sans -on-dark`);
  }
}

if (errors.length > 0) {
  console.error('❌ check-tokens ÉCHEC:\n');
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}

console.log('✅ check-tokens OK — unicité tokens respectée');
process.exit(0);
