'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function launchRound(sessionId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const question = (formData.get('question') as string)?.trim()
  if (!question) redirect(`/dj/sessions/${sessionId}?error=Question+requise`)

  // Collecte les options non vides dans l'ordre du formulaire
  const options: { label: string; artist: string | null; position: number }[] = []
  for (let i = 1; i <= 4; i++) {
    const label = (formData.get(`option_label_${i}`) as string)?.trim()
    if (label) {
      const artist = (formData.get(`option_artist_${i}`) as string)?.trim() || null
      options.push({ label, artist, position: options.length })
    }
  }

  if (options.length < 2) {
    redirect(`/dj/sessions/${sessionId}?error=Au+moins+2+options+requises`)
  }

  // 1. Cree le round en lobby
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({ session_id: sessionId, question, status: 'lobby' })
    .select('id')
    .single()

  if (roundError || !round) {
    throw new Error(`Erreur creation round : ${roundError?.message}`)
  }

  // 2. Insere les options (elles sont en base avant la notification Realtime)
  const { error: optionsError } = await supabase
    .from('options')
    .insert(options.map(o => ({ ...o, round_id: round.id })))

  if (optionsError) {
    throw new Error(`Erreur creation options : ${optionsError.message}`)
  }

  // 3. Passe le round en voting → declenche la notification Realtime au public
  const { error: updateError } = await supabase
    .from('rounds')
    .update({ status: 'voting' })
    .eq('id', round.id)

  if (updateError) {
    throw new Error(`Erreur lancement vote : ${updateError.message}`)
  }

  revalidatePath(`/dj/sessions/${sessionId}`)
  redirect(`/dj/sessions/${sessionId}`)
}

export async function closeRound(sessionId: string, roundId: string, _formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // La policy dj_manage_own_rounds verifie que le round appartient au DJ
  const { error } = await supabase
    .from('rounds')
    .update({ status: 'closed' })
    .eq('id', roundId)

  if (error) throw new Error(`Erreur cloture : ${error.message}`)

  revalidatePath(`/dj/sessions/${sessionId}`)
  redirect(`/dj/sessions/${sessionId}`)
}
