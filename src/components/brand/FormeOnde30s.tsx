'use client';

/**
 * FormeOnde30s — lecteur signature KALA (DESIGN-PLAN §3) : l'extrait 30s d'un prof
 * (EX-001) ou d'une entrée de timeline (EX-003) s'affiche comme une onde audio
 * jouable qui se teinte au fil de la lecture. 12 barres de hauteur fixe dessinées
 * à la main (zéro aléa → rendu serveur/client identiques, pas de flash au
 *hydratation). Le média vit dans un <video> caché : video_30s_url porte une vidéo,
 * le rendu reste une ONDE, jamais un lecteur carré.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Hauteurs normalisées (0-1) — symétrie douce façon sortie de mixage, déterministe
const HAUTEURS_BARRES = [0.32, 0.58, 0.42, 0.86, 0.54, 0.98, 0.66, 0.5, 0.9, 0.62, 0.38, 0.72];

interface FormeOnde30sProps {
  url: string;
  /** Prénom ou contexte pour l'accessibilité : « Écouter l'extrait de Marie (30 s) ». */
  label: string;
  /** Étiquette de durée affichée à droite de l'onde (défaut « 0:30 », l'extrait prof). */
  dureeAffichee?: string;
  className?: string;
}

export default function FormeOnde30s({ url, label, dureeAffichee = '0:30', className }: FormeOnde30sProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enLecture, setEnLecture] = useState(false);
  const [progression, setProgression] = useState(0); // 0 → 1
  const [indisponible, setIndisponible] = useState(false);

  const basculer = useCallback(() => {
    const video = videoRef.current;
    if (!video || indisponible) return;
    if (video.paused) {
      // play() renvoie une promesse : un réseau qui coupe est un état, pas une exception
      // à laisser remonter — l'onde retombe sur son message honnête.
      video.play().catch(() => setIndisponible(true));
    } else {
      video.pause();
    }
  }, [indisponible]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      // duration est NaN tant que les métadonnées ne sont pas chargées (preload="metadata")
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setProgression(video.currentTime / video.duration);
      }
    };
    const onPlay = () => setEnLecture(true);
    const onPause = () => setEnLecture(false);
    const onEnded = () => {
      // Fin d'écoute : l'onde revient à zéro, prête pour une 2e écoute
      setProgression(0);
      setEnLecture(false);
    };
    const onError = () => setIndisponible(true);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [url]);

  // Une barre se teinte quand la tête de lecture passe son centre (i + 0,5)
  const barresJouees = progression * HAUTEURS_BARRES.length;

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <video
        ref={videoRef}
        src={url}
        preload="metadata"
        playsInline
        className="hidden"
        aria-hidden="true"
      />

      {/* min-h/min-w 11 = 44px : zone tactile pleine (S41-d), même sur mobile */}
      <button
        type="button"
        onClick={basculer}
        disabled={indisponible}
        aria-label={
          enLecture
            ? `Arrêter l'extrait de ${label}`
            : `Écouter l'extrait de ${label} (${dureeAffichee})`
        }
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-on-dark/40 bg-primary/10 text-primary-on-dark transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enLecture ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
          </svg>
        )}
      </button>

      {indisponible ? (
        <p className="text-sm text-muted-foreground">Extrait indisponible pour le moment.</p>
      ) : (
        <>
          {/* L'onde elle-même est décorative (aria-hidden) : le bouton porte le sens,
              la progression n'est pas une information nécessaire au lecteur d'écran. */}
          <div className="flex h-12 min-w-0 flex-1 items-center gap-[3px]" aria-hidden="true">
            {HAUTEURS_BARRES.map((h, i) => {
              const jouee = barresJouees > i + 0.5;
              return (
                <span
                  key={i}
                  className="w-[5px] shrink-0 rounded-full transition-colors duration-150"
                  style={{
                    height: `${Math.round(h * 100)}%`,
                    background: jouee ? 'var(--primary-on-dark)' : 'var(--foreground-secondary)',
                  }}
                />
              );
            })}
          </div>
          <span
            className="shrink-0 font-mono text-xs font-medium text-muted-foreground"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {dureeAffichee}
          </span>
        </>
      )}
    </div>
  );
}
