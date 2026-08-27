import type { AuthError } from '@supabase/supabase-js';

/**
 * Traduit les erreurs GoTrue (anglaises, ex. "Invalid login credentials") en français
 * actionnable — B27-3 (passage 27) : l'app entière est en français sauf ce message, sur
 * l'écran précis où l'utilisateur est déjà en difficulté.
 */
export function translateAuthError(error: AuthError | { message: string; code?: string }): string {
  const code = 'code' in error ? error.code : undefined;
  const message = error.message ?? '';

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'Email ou mot de passe incorrect. Vérifiez votre saisie ou réinitialisez votre mot de passe.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Votre email n\'est pas encore confirmé. Vérifiez votre boîte de réception.';
  }
  if (code === 'user_already_exists' || /user already registered/i.test(message)) {
    return 'Un compte existe déjà avec cet email. Connectez-vous plutôt.';
  }
  if (code === 'weak_password' || /password.*(least|characters)/i.test(message)) {
    return 'Mot de passe trop court : 8 caractères minimum.';
  }
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) {
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  }
  if (code === 'user_not_found') {
    return 'Aucun compte ne correspond à cet email.';
  }
  if (/network|fetch/i.test(message)) {
    return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
  }

  return 'Une erreur est survenue. Réessayez ou contactez le support si le problème persiste.';
}
