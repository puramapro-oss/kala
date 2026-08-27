/**
 * lib/resend.ts — Helpers Resend KALA (T-56 EX-038)
 * Patron réutilisé d'AHIMSA, adapté vocabulaire prof.
 */

import { Resend } from 'resend';
import { APP_NAME, APP_URL } from './constants';
import { formatPrice } from './utils';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'hello@kala.purama.dev';

function emailShell({
  accentColor = '#C7A87D',
  title,
  bodyHtml,
  cta,
  footnote,
}: {
  accentColor?: string;
  title: string;
  bodyHtml: string;
  cta?: { href: string; label: string; color?: string };
  footnote?: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0F; color: #F5F5FA; padding: 32px;">
      <h1 style="color: ${accentColor}; letter-spacing: 0.04em;">${title}</h1>
      ${bodyHtml}
      ${cta ? `<a href="${cta.href}" style="display:inline-block; background:${cta.color ?? '#6B7F6A'}; color:#fff; padding:14px 28px; border-radius:12px; text-decoration:none; font-weight:bold; margin:16px 0;">${cta.label}</a>` : ''}
      ${footnote ?? `<p style="font-size:12px; color:#8A8A99; margin-top:32px;">${APP_NAME} — SASU PURAMA, 8 Rue Chapelle 25560 Frasne<br>TVA non applicable art. 293B CGI</p>`}
    </div>
  `;
}

/**
 * EX-038 : notification prof "Cours terminé : +X€ reçus".
 * Montant en centimes (cohérence w/ splitRevenue/logMouvement).
 */
export async function sendCoursTermineEmail(
  to: string,
  profPrenom: string,
  montantCents: number
) {
  const formatted = formatPrice(montantCents);

  // SPF/DKIM/DMARC kala.purama.dev non configuré à ce stade (D-024, D-022 SPEC.md).
  // L'envoi sera tenté, mais peut échouer → log serveur clair si échec.
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Cours terminé : ${formatted} reçus !`,
      html: emailShell({
        title: `Félicitations ${profPrenom} !`,
        bodyHtml: `<p style="line-height: 1.8; color: rgba(245,245,250,0.7);">
          Le cours vient de se terminer.<br>
          Tu as reçu <strong>${formatted}</strong> sur ton compte Stripe Connect.<br><br>
          Le versement SEPA a été déclenché automatiquement et devrait arriver sous peu.
        </p>`,
        cta: { href: `${APP_URL}/gains`, label: 'Voir mes gains', color: '#6B7F6A' },
        footnote: `<p style="font-size:12px; color:#8A8A99;">Détail des versements visible dans ton espace Gains.<br>${APP_NAME}</p>`,
      }),
    });

    console.log(`[resend] Email cours terminé envoyé à ${to} (${formatted})`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[resend] Échec envoi email cours terminé (${to}, ${formatted}). Cause probable : SPF/DKIM kala.purama.dev non configuré (cf D-024/D-022 SPEC.md). Erreur:`,
      message
    );
    // NE PAS throw : l'échec d'email ne doit pas bloquer la clôture du cours.
  }
}

export async function sendWelcomeEmail(to: string, prenom: string) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Bienvenue sur ${APP_NAME} !`,
    html: emailShell({
      title: `Bienvenue, ${prenom} !`,
      bodyHtml: `<p style="line-height: 1.8; color: rgba(245,245,250,0.7);">
        Trouve un prof vérifié pour apprendre la musique ou une activité de loisir à domicile,<br>
        ou deviens prof et gagne 100% de ton tarif.
      </p>`,
      cta: { href: `${APP_URL}/dashboard`, label: 'Découvrir' },
    }),
  });
}
