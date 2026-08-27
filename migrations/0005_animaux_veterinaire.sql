-- 0005_animaux_veterinaire.sql — vétérinaire référent sur le profil animal (passage 30, B30-3)
-- Le SPEC animal (« vétérinaire référent ») et l'écran journal (carte « Besoin d'un vétérinaire ? »)
-- supposaient ces colonnes ; elles n'avaient jamais été déployées (erreur PostgREST 42703 à la
-- première vraie lecture). Additive, aucun impact sur l'existant.
ALTER TABLE purama_marketplace.animaux
  ADD COLUMN IF NOT EXISTS veterinaire_nom       text,
  ADD COLUMN IF NOT EXISTS veterinaire_telephone text;
