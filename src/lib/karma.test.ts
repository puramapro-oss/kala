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

  it('répartit 8,65 € et affecte le reliquat à la SASU', () => {
    const result = splitRevenue(8.65);
    expect(result.partUsers).toBe(4.33);
    expect(result.partAsso).toBe(0.87);
    expect(result.partSASU).toBe(3.45);
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

  it('conserve chaque centime et chaque part reste positive ou nulle', () => {
    for (let cents = 0; cents <= 1000; cents++) {
      const split = splitRevenue(cents / 100);
      const parts = [split.partUsers, split.partAsso, split.partSASU]
        .map((part) => Math.round(part * 100));
      expect(split.montantTotal).toBe(cents / 100);
      expect(Math.min(...parts)).toBeGreaterThanOrEqual(0);
      expect(parts[0] + parts[1] + parts[2]).toBe(cents);
    }
  });

  it('arrondit les demi-centimes après conversion des frais en centimes', () => {
    expect(splitRevenue(1.48 - 0.35)).toEqual({
      montantTotal: 1.13, partUsers: 0.57, partAsso: 0.11, partSASU: 0.45,
    });
  });

  it.each([NaN, Infinity, Number.MAX_SAFE_INTEGER])('rejette le montant non représentable %s', (invalid) => {
    expect(() => splitRevenue(invalid)).toThrow(/non représentable/);
  });
});
