/**
 * Politique de confidentialité — KALA
 * EX-106 : contenu réel adapté marketplace de cours de musique et de loisirs à domicile.
 *
 * NIYAMA (2026-08-23) : contenu spécifique conservé (clauses marketplace propres à KALA) —
 * corrections factuelles seulement (PIEGES.md §16) : hébergeur DB réel = Hostinger (Paris),
 * jamais Hetzner ; PostHog retiré de la liste cookies analytiques (env var présente au niveau
 * écosystème mais jamais initialisée dans le code de CETTE app — aucun cookie de mesure
 * d'audience n'est réellement déposé aujourd'hui, seul le mécanisme de consentement existe).
 */

import { COMPANY_INFO, APP_NAME, APP_DOMAIN } from '@/lib/constants';

export const metadata = {
  title: `Politique de confidentialité · ${APP_NAME}`,
  description: 'Politique de confidentialité et protection des données personnelles KALA.',
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8">
          {/* inline-flex min-h-11 (B28-4, passage 29) : même correctif que cgu/page.tsx. */}
          <a href="/" className="inline-flex min-h-11 items-center text-sm text-primary-on-dark hover:underline">
            ← Retour à l'accueil
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">Politique de confidentialité</h1>
        <p className="text-muted-foreground mb-8">Dernière mise à jour : 7 août 2026</p>

        <div className="max-w-[65ch] space-y-6 text-foreground">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données personnelles collectées via {APP_NAME} est :
            </p>
            <p>
              <strong>{COMPANY_INFO.nom}</strong> ({COMPANY_INFO.forme_juridique})<br />
              Adresse : {COMPANY_INFO.adresse}, {COMPANY_INFO.code_postal} {COMPANY_INFO.commune}, {COMPANY_INFO.pays}<br />
              {COMPANY_INFO.siret ? (
                <>SIRET : {COMPANY_INFO.siret}<br /></>
              ) : (
                <>SIRET en cours d'attribution<br /></>
              )}
              Email de contact : <a href="mailto:hello@purama.dev" className="text-primary-on-dark underline">hello@purama.dev</a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">2. Données collectées et finalités</h2>
            <p>
              Dans le cadre de l'utilisation de la plateforme {APP_NAME}, les données suivantes peuvent être collectées :
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>
                <strong>Données d'identification :</strong> nom, prénom, adresse email, numéro de téléphone (si renseigné).
                <br />
                <em>Finalité :</em> création et gestion du compte utilisateur, communication entre Client et Prof.
              </li>
              <li>
                <strong>Données de profil de l&apos;élève :</strong> instrument ou discipline, niveau, objectif, contraintes du domicile.
                <br />
                <em>Finalité :</em> transmission des informations nécessaires au Prof pour dispenser le cours dans les meilleures conditions.
              </li>
              <li>
                <strong>Données de localisation :</strong> commune, code postal, coordonnées GPS approximatives (pour le rayon de recherche).
                <br />
                <em>Finalité :</em> affichage des profs disponibles à proximité, calcul de la distance. L&apos;adresse exacte du domicile n&apos;est
                communiquée au Prof qu&apos;après confirmation et paiement de la réservation.
              </li>
              <li>
                <strong>Données de paiement :</strong> informations de carte bancaire (traitées exclusivement par Stripe, sans transit par nos serveurs).
                <br />
                <em>Finalité :</em> traitement sécurisé des transactions, séquestre des fonds, versement au Prof.
              </li>
              <li>
                <strong>Données de timeline du cours :</strong> photos, notes.
                <br />
                <em>Finalité :</em> suivi du cours par l&apos;élève (ou son parent), preuve de réalisation de la prestation.
              </li>
              <li>
                <strong>Données de connexion :</strong> adresse IP, logs de connexion, données de navigation.
                <br />
                <em>Finalité :</em> sécurité du service, détection de fraudes, respect des obligations légales.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">3. Base légale du traitement</h2>
            <p>
              Les traitements de données personnelles effectués par {COMPANY_INFO.nom} reposent sur les bases légales suivantes :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                <strong>Exécution du contrat :</strong> gestion du compte, réservations, paiement, timeline du cours.
              </li>
              <li>
                <strong>Consentement :</strong> utilisation de la géolocalisation précise, envoi de communications marketing (si accepté).
              </li>
              <li>
                <strong>Intérêt légitime :</strong> lutte contre la fraude, amélioration du service, analyse statistique anonymisée.
              </li>
              <li>
                <strong>Obligation légale :</strong> conservation des données de transaction pour répondre aux obligations fiscales et comptables.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">4. Destinataires des données</h2>
            <p>
              Les données collectées sont accessibles aux catégories de destinataires suivants :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Les équipes internes de {COMPANY_INFO.nom}, dans la limite de leurs attributions.</li>
              <li>Les Profs, uniquement pour les données nécessaires à la réalisation du cours (profil de l&apos;élève, coordonnées du Client).</li>
              <li>Les prestataires techniques : Stripe (paiement), Supabase (hébergement base de données), Vercel (hébergement web), Resend (envoi d'emails).</li>
              <li>Les autorités compétentes, sur demande légale (justice, administration fiscale).</li>
            </ul>
            <p>
              Aucune donnée personnelle n'est vendue, louée ou cédée à des tiers à des fins commerciales.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">5. Durée de conservation</h2>
            <p>
              Les données personnelles sont conservées pour les durées suivantes :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Compte utilisateur actif :</strong> tant que le compte est actif + 3 ans après la dernière activité.</li>
              <li><strong>Données de transaction :</strong> 10 ans (obligation légale comptable et fiscale).</li>
              <li><strong>Notes de la timeline du cours :</strong> 30 jours après la fin du cours (suppression automatique).</li>
              <li><strong>Photos de la timeline du cours :</strong> 90 jours après la fin du cours (avec possibilité de téléchargement avant échéance).</li>
              <li><strong>Logs de connexion :</strong> 12 mois (sécurité et détection de fraude).</li>
            </ul>
            <p>
              À l'issue de ces durées, les données sont supprimées ou anonymisées de manière irréversible.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">6. Vos droits (RGPD)</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés,
              vous disposez des droits suivants :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Droit d'accès :</strong> obtenir une copie de vos données personnelles.</li>
              <li><strong>Droit de rectification :</strong> corriger des données inexactes ou incomplètes.</li>
              <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données (« droit à l'oubli »), sous réserve des obligations légales de conservation.</li>
              <li><strong>Droit à la limitation du traitement :</strong> demander le gel temporaire de vos données.</li>
              <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré et lisible par machine.</li>
              <li><strong>Droit d'opposition :</strong> vous opposer à un traitement fondé sur l'intérêt légitime ou à finalité marketing.</li>
              <li><strong>Droit de retirer votre consentement :</strong> pour les traitements nécessitant un consentement (géolocalisation, communications marketing).</li>
            </ul>
            <p>
              Pour exercer ces droits, vous pouvez :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Consulter, exporter et effacer vos données depuis la page « Ma mémoire » de votre compte.</li>
              <li>Nous contacter par email à : <a href="mailto:hello@purama.dev" className="text-primary-on-dark underline">hello@purama.dev</a></li>
            </ul>
            <p>
              Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (Commission Nationale de
              l'Informatique et des Libertés) : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary-on-dark underline">cnil.fr</a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">7. Sécurité des données</h2>
            <p>
              {COMPANY_INFO.nom} met en œuvre des mesures techniques et organisationnelles appropriées pour garantir
              la sécurité de vos données personnelles :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Chiffrement des données sensibles (mots de passe hashés avec bcrypt, communications HTTPS).</li>
              <li>Hébergement sur des serveurs sécurisés et conformes RGPD (Hostinger, serveur physique à Paris, France / conformité UE).</li>
              <li>Authentification sécurisée (OAuth 2.0, sessions à durée limitée).</li>
              <li>Contrôle d'accès strict aux données (RLS PostgreSQL, isolation multi-tenant).</li>
              <li>Sauvegardes régulières et journalisation des accès sensibles.</li>
            </ul>
            <p>
              Toutefois, aucune méthode de transmission sur Internet ou de stockage électronique n'est totalement sécurisée.
              {COMPANY_INFO.nom} ne peut garantir une sécurité absolue.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">8. Cookies et traceurs</h2>
            <p>
              Le site {APP_DOMAIN} utilise les cookies suivants :
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                <strong>Cookies strictement nécessaires :</strong> authentification, gestion de session utilisateur.
                Ces cookies sont indispensables au fonctionnement de la plateforme et ne nécessitent pas de consentement préalable.
              </li>
              <li>
                <strong>Cookies analytiques :</strong> mesure d'audience, déposés uniquement si vous avez donné votre consentement explicite via le bandeau de consentement.
              </li>
            </ul>
            <p>
              Vous pouvez à tout moment gérer vos préférences de cookies via le bandeau de consentement ou les paramètres
              de votre navigateur.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">9. Modifications de la politique de confidentialité</h2>
            <p>
              {COMPANY_INFO.nom} se réserve le droit de modifier la présente politique de confidentialité à tout moment,
              notamment pour se conformer à toute évolution législative, réglementaire, jurisprudentielle ou technologique.
            </p>
            <p>
              Les utilisateurs seront informés de toute modification significative par email ou notification dans l'application.
              La version en vigueur est toujours accessible depuis le site {APP_DOMAIN}.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold mb-3">10. Contact</h2>
            <p>
              Pour toute question relative à la protection de vos données personnelles ou pour exercer vos droits, vous pouvez nous contacter :
            </p>
            <p>
              <strong>{COMPANY_INFO.nom}</strong><br />
              Email : <a href="mailto:hello@purama.dev" className="text-primary-on-dark underline">hello@purama.dev</a><br />
              Adresse postale : {COMPANY_INFO.adresse}, {COMPANY_INFO.code_postal} {COMPANY_INFO.commune}, {COMPANY_INFO.pays}
            </p>
          </section>

          <section className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour : 7 août 2026
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
