'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Pas de I (confondu avec 1 et l), O (confondu avec 0), L (confondu avec 1)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_LENGTH = 4
const MAX_ATTEMPTS = 10

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}

export async function createSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode()

    const { data, error } = await supabase
      .from('sessions')
      .insert({ code, dj_id: user.id })
      .select('id')
      .single()

    if (!error && data) {
      redirect(`/dj/sessions/${data.id}`)
    }

    // 23505 = unique_violation PostgreSQL : collision sur le code, on reessaie
    if (error?.code !== '23505') {
      throw new Error(`Erreur creation session : ${error?.message}`)
    }
  }

  throw new Error(`Impossible de generer un code unique apres ${MAX_ATTEMPTS} tentatives`)
}
