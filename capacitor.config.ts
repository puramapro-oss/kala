import type { CapacitorConfig } from '@capacitor/cli';

/**
 * KALA — Capacitor 7 config
 *
 * Stratégie : web wrapping. L'app web Next.js (cours de musique et loisirs
 * à domicile) sert de binaire iOS/Android via WebView, avec haptics
 * natifs. Bundle id: dev.purama.kala.
 */

const config: CapacitorConfig = {
  appId: 'dev.purama.kala',
  appName: 'KALA',
  webDir: 'public', // dummy — server.url prend le dessus (wrapping web live, pas de build statique)
  server: {
    url: 'https://kala.purama.dev',
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
    allowNavigation: ['kala.purama.dev', 'auth.purama.dev', '*.stripe.com'],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#1C1F26',
    preferredContentMode: 'mobile',
    scheme: 'KALA',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#1C1F26',
    captureInput: true,
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
    overrideUserAgent: undefined,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1C1F26',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1C1F26',
      overlaysWebView: true,
    },
    Haptics: {},
    Preferences: {
      group: 'dev.purama.kala.prefs',
    },
  },
};

export default config;
