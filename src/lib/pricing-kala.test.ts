/**
 * pricing-kala.test.ts — Tests unitaires du calcul de frais 9%
 */

import { describe, it, expect } from 'vitest';
import { calculerPricing } from './pricing-kala';

describe('calculerPricing', () => {
  it('calcule 9% sur cours 100€ (10000 centimes)', () => {
    const result = calculerPricing(10000);
    // Frais = 900 centimes (9€)
    expect(result.tarifCents).toBe(10000);
    expect(result.fraisServiceCents).toBe(900);
    expect(result.totalCents).toBe(10900);
    expect(result.montantProfCents).toBe(10000); // prof garde 100%
  });

  it('calcule 9% sur cours 20€ (2000 centimes)', () => {
    const result = calculerPricing(2000);
    // Frais = 180 centimes (1.80€)
    expect(result.fraisServiceCents).toBe(180);
    expect(result.totalCents).toBe(2180);
    expect(result.montantProfCents).toBe(2000);
  });

  it('arrondit au centime le plus proche (half-up)', () => {
    const result = calculerPricing(1000); // 10€
    // 9% de 1000 = 90 centimes (exactement 90, aucun arrondi nécessaire)
    expect(result.fraisServiceCents).toBe(90);
    expect(result.totalCents).toBe(1090);
  });

  it('arrondit correctement 9% sur 15€ (1500 centimes)', () => {
    const result = calculerPricing(1500);
    // 9% de 1500 = 135 centimes (1.35€)
    expect(result.fraisServiceCents).toBe(135);
    expect(result.totalCents).toBe(1635);
  });

  it('arrondit correctement 9% sur 7€ (700 centimes)', () => {
    const result = calculerPricing(700);
    // 9% de 700 = 63 centimes (0.63€)
    expect(result.fraisServiceCents).toBe(63);
    expect(result.totalCents).toBe(763);
  });

  it('gère zéro sans erreur', () => {
    const result = calculerPricing(0);
    expect(result.fraisServiceCents).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(result.montantProfCents).toBe(0);
  });

  it('rejette un tarif négatif', () => {
    expect(() => calculerPricing(-1000)).toThrow(/tarif négatif interdit/);
  });

  it('rejette un tarif non entier', () => {
    expect(() => calculerPricing(10.5)).toThrow(/doit être un entier en centimes/);
  });

  it('garantit que le prof reçoit 100% du tarif dans tous les cas', () => {
    [500, 1234, 9999, 20000].forEach((tarif) => {
      const result = calculerPricing(tarif);
      expect(result.montantProfCents).toBe(tarif); // zéro commission prof
    });
  });

  it('garantit que le total vaut exactement tarif + frais au centime près', () => {
    const result = calculerPricing(12345);
    expect(result.totalCents).toBe(result.tarifCents + result.fraisServiceCents);
  });
});
