'use client';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; href: string } | ReactNode;
  icon?: ReactNode;
  /** B37-3 (passage 37, MOYEN) : par défaut centré (état vide plein écran/section, ex. /journal
   *  « Aucune entrée pour le moment »). `"left"` aligne le bloc sur le bord intérieur d'une carte
   *  dont le titre est déjà à gauche (ex. /wallet « Historique ») — même règle que B37-1, un état
   *  vide ne doit pas retomber sur un axe différent du titre qui le précède dans la même carte. */
  align?: 'center' | 'left';
}

export default function EmptyState({ title, description, action, icon, align = 'center' }: EmptyStateProps) {
  const isLeft = align === 'left';
  return (
    <div
      className={
        isLeft
          ? 'flex flex-col items-start py-6 px-0 text-left'
          : 'flex flex-col items-center justify-center py-12 px-4 text-center'
      }
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && <p className={`text-muted-foreground mb-6 ${isLeft ? '' : 'max-w-sm'}`}>{description}</p>}
      {action && (
        <div>
          {typeof action === 'object' && 'label' in action && 'href' in action ? (
            <a
              href={action.href}
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border-2 border-transparent bg-primary-on-dark text-[#0A0A0F] font-semibold hover:opacity-90 transition-opacity"
            >
              {action.label}
            </a>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}
