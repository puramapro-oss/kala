/**
 * utils.ts — Helpers génériques KALA
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', opts ?? { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(date)
  );
}

export function isSuperAdmin(email?: string | null): boolean {
  return email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || email === 'matiss.frasne@gmail.com';
}

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getFirstName(name?: string | null): string {
  return name?.trim().split(' ')[0] || 'toi';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
