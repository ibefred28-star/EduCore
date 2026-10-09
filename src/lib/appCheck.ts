import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
import { app } from './firebase';
import config from '../../firebase-applet-config.json';

let appCheckInstance: AppCheck | null = null;

/**
 * Prepares and initializes Firebase App Check.
 * Protects backend services against abusive bots and scrapers.
 * 
 * In development or preview environments, debug tokens are supported to ensure
 * developers and administrators are never accidentally locked out.
 */
export function initAppCheck(): AppCheck | null {
  if (typeof window === 'undefined') return null;
  if (appCheckInstance) return appCheckInstance;

  // Use reCAPTCHA v3 site key if provided in firebase-applet-config.json
  const siteKey = config.recaptchaSiteKey;

  try {
    const isDev = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname.includes('.run.app');

    if (isDev) {
      // Enable debug token for local and container preview environments
      // This prevents locking out developers during iterative development
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    if (siteKey) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      console.log('Firebase App Check initialized successfully');
    } else {
      console.info('Firebase App Check: recaptchaSiteKey not configured; operating in permissive mode.');
    }
  } catch (err) {
    console.warn('Firebase App Check initialization skipped:', err);
  }

  return appCheckInstance;
}
