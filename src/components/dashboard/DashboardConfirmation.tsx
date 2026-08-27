'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import FormeOndeConfirmation from '@/components/ui/FormeOndeConfirmation';

/**
 * DashboardConfirmation — Déclenche FormeOndeConfirmation si ?confirmation=reservation (DESIGN-PLAN §3)
 * Branché dans /dashboard page.tsx
 */
export default function DashboardConfirmation() {
  const searchParams = useSearchParams();
  const [ondeTriggered, setOndeTriggered] = useState(false);

  useEffect(() => {
    if (searchParams.get('confirmation') === 'reservation') {
      // Déclencher la forme d'onde au centre de l'écran après montage
      setOndeTriggered(true);
    }
  }, [searchParams]);

  return (
    <FormeOndeConfirmation
      trigger={ondeTriggered}
      onComplete={() => setOndeTriggered(false)}
    />
  );
}
