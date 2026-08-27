import { ImageResponse } from 'next/og';

// B22-3 : variante maskable pour l'écran d'accueil iOS — mêmes barres de forme d'onde que
// FormeOnde.tsx/LogoKala.tsx, centrées dans une zone de sécurité (~22% de marge) pour
// survivre au recadrage maskable. Satori ne rend pas les <path> obliques du logo complet —
// on garde le langage barres du logo (KALA).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1C1F26',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 44, borderRadius: 6, background: '#C9A227', display: 'flex' }} />
          <div style={{ width: 12, height: 66, borderRadius: 6, background: '#C9A227', display: 'flex' }} />
          <div style={{ width: 12, height: 88, borderRadius: 6, background: '#C9A227', display: 'flex' }} />
          <div style={{ width: 12, height: 60, borderRadius: 6, background: '#C9A227', display: 'flex', opacity: 0.75 }} />
          <div style={{ width: 12, height: 36, borderRadius: 6, background: '#C9A227', display: 'flex', opacity: 0.5 }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
