'use server'

import { revalidatePath } from 'next/cache'
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

export async function createSession(formData?: FormData): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const source = formData?.get('source') === 'library' ? 'library' : 'itunes'

  if (source === 'library') {
    const { count } = await supabase
      .from('library_songs')
      .select('id', { count: 'exact', head: true })
      .eq('dj_id', user.id)
    if (!count || count === 0) {
      return { error: 'Ta bibliotheque est vide. Importe d\'abord tes chansons Smule.' }
    }
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode()

    const { data, error } = await supabase
      .from('sessions')
      .insert({ code, dj_id: user.id, source })
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

export async function deleteSession(sessionId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error, count } = await supabase
    .from('sessions')
    .delete({ count: 'exact' })
    .eq('id', sessionId)
    .eq('dj_id', user.id)

  if (error) return { error: `Erreur suppression : ${error.message}` }
  // count === 0 = session inconnue ou n'appartient pas a ce DJ : pas un succes silencieux
  if (count === 0) return { error: 'Session introuvable ou acces refuse' }

  revalidatePath('/dj')
  return {}
}
