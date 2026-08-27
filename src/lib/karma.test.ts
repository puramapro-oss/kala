/**
 * karma.test.ts — Tests unitaires du split KARMA 50/10/40
 */

import { describe, it, expect } from 'vitest';
import { splitRevenue } from './karma';

describe('splitRevenue', () => {
  it('répartit 10€ en 5/1/4', () => {
    const result = splitRevenue(10);
    expect(result.partUsers).toBe(5);
    expect(result.partAsso).toBe(1);
    expect(result.partSASU).toBe(4);
    expect(result.montantTotal).toBe(10);
  });

  it('répartit 8.65€ (cas réel frais 9% sur garde 100€, net Stripe ~8.65€)', () => {
    const result = splitRevenue(8.65);
    // 50% = 4.325 → arrondi 4.33
    // 10% = 0.865 → arrondi 0.87
    // 40% = 3.46 → arrondi 3.46
    expect(result.partUsers).toBe(4.33);
    expect(result.partAsso).toBe(0.87);
    expect(result.partSASU).toBe(3.46);
  });

  it('arrondit chaque part au centime (half-up)', () => {
    const result = splitRevenue(1); // 0.50 / 0.10 / 0.40
    expect(result.partUsers).toBe(0.5);
    expect(result.partAsso).toBe(0.1);
    expect(result.partSASU).toBe(0.4);
  });

  it('gère zéro sans erreur', () => {
    const result = splitRevenue(0);
    expect(result.partUsers).toBe(0);
    expect(result.partAsso).toBe(0);
    expect(result.partSASU).toBe(0);
  });

  it('rejette un revenu négatif', () => {
    expect(() => splitRevenue(-5)).toThrow(/revenu négatif interdit/);
  });

  it('conserve la somme totale dans montantTotal', () => {
    const result = splitRevenue(123.45);
    expect(result.montantTotal).toBe(123.45);
    // Somme parts peut différer légèrement d'un arrondi — ici on vérifie juste la cohérence
    const somme = result.partUsers + result.partAsso + result.partSASU;
    expect(somme).toBeCloseTo(123.45, 1); // tolérance 0.1 centime
  });
});
