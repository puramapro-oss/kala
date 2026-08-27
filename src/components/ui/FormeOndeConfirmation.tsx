'use client';

import { useEffect, useState } from 'react';

interface FormeOndeConfirmationProps {
  /** Déclenche l'animation de la forme d'onde au tap (mise à true depuis le parent) */
  trigger: boolean;
  /** Position X en pixels où afficher la forme d'onde (optionnel, centré par défaut) */
  x?: number;
  /** Position Y en pixels où afficher la forme d'onde (optionnel, centré par défaut) */
  y?: number;
  /** Callback appelé à la fin de l'animation */
  onComplete?: () => void;
}

/**
 * FormeOndeConfirmation — La signature visuelle unique de KALA (DESIGN-PLAN §3).
 * Micro-interaction : une forme d'onde (barres verticales arrondies, comme une piste audio)
 * apparaît au tap, avec un spring naturel (scale 0.8→1, opacity 0→1→0).
 * Utilisée uniquement pour les validations clés (réservation confirmée, cours terminé, paiement reçu).
 */
export default function FormeOndeConfirmation({ trigger, x, y, onComplete }: FormeOndeConfirmationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 1200); // durée totale de l'animation

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!visible) return null;

  const posX = x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
  const posY = y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-forme-onde-spring"
      >
        {/* Forme d'onde stylisée : 5 barres verticales arrondies, hauteurs asymétriques
            comme une piste audio en lecture */}
        <rect x="8" y="24" width="6" height="16" rx="3" fill="var(--primary)" opacity="0.85" />
        <rect x="18" y="16" width="6" height="32" rx="3" fill="var(--primary)" opacity="0.85" />
        <rect x="28" y="8" width="6" height="48" rx="3" fill="var(--primary)" opacity="0.9" />
        <rect x="38" y="20" width="6" height="24" rx="3" fill="var(--primary)" opacity="0.85" />
        <rect x="48" y="28" width="6" height="8" rx="3" fill="var(--primary)" opacity="0.85" />
      </svg>

      <style jsx>{`
        @keyframes forme-onde-spring {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          40% {
            transform: scale(1.1);
            opacity: 1;
          }
          60% {
            transform: scale(0.95);
            opacity: 1;
          }
          80% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }

        .animate-forme-onde-spring {
          animation: forme-onde-spring 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        /* Respecte prefers-reduced-motion (DESIGN-PLAN §6) */
        @media (prefers-reduced-motion: reduce) {
          .animate-forme-onde-spring {
            animation: none;
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
