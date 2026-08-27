/**
 * Script création user test avec password valide via Admin API
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Charger .env.local avant de lire les vars
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const email = 'demo-client@test.kala';
  const password = 'DemoTest123!'; // mot de passe utilisable pour tests Playwright

  // Supprimer si existe déjà
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users.find((u) => u.email === email);
  if (existing) {
    console.log(`🗑️  Suppression user existant ${email}...`);
    await supabase.auth.admin.deleteUser(existing.id);
  }

  // Créer user avec mot de passe hashé correctement
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_demo: true },
  });

  if (error) {
    console.error('❌ Erreur création user:', error.message);
    process.exit(1);
  }

  console.log(`✅ User créé: ${email}`);
  console.log(`   ID: ${data.user.id}`);
  console.log(`   Password: ${password}`);
  console.log('\n💾 Credentials pour Playwright:');
  console.log(`   EMAIL="${email}"`);
  console.log(`   PASSWORD="${password}"`);
}

main();
