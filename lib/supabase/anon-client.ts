import { createClient } from '@supabase/supabase-js'

// Client sans authentification pour les pages publiques.
// N'utilise jamais de cookie de session : garanti role anon en base.
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
