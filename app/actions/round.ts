'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function launchRound(sessionId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const question = (formData.get('question') as string)?.trim() || 'Quelle sera la prochaine chanson ?'

  const options: {
    label: string
    artist: string | null
    position: number
    spotify_track_id:  string | null
    spotify_image_url: string | null
  }[] = []

  for (let i = 1; i <= 4; i++) {
    const label = (formData.get(`option_label_${i}`) as string)?.trim()
    if (label) {
      const artist            = (formData.get(`option_artist_${i}`)       as string)?.trim() || null
      const spotify_track_id  = (formData.get(`spotify_track_id_${i}`)    as string)?.trim() || null
      const spotify_image_url = (formData.get(`spotify_image_url_${i}`)   as string)?.trim() || null
      options.push({ label, artist, position: options.length, spotify_track_id, spotify_image_url })
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

  // 2. Insere les options — nettoyage si echec pour eviter un round orphelin en lobby
  const { error: optionsError } = await supabase
    .from('options')
    .insert(options.map(o => ({ ...o, round_id: round.id })))

  if (optionsError) {
    await supabase.from('rounds').delete().eq('id', round.id)
    throw new Error(`Erreur creation options : ${optionsError.message}`)
  }

  // 3. Persiste la blacklist des titres proposes (non-bloquant si echec)
  const songKeys = options.map(o =>
    `${o.label.toLowerCase().trim()}|${(o.artist ?? '').toLowerCase().trim()}`
  )
  const { error: blacklistError } = await supabase
    .from('session_used_songs')
    .upsert(
      songKeys.map(k => ({ session_id: sessionId, song_key: k })),
      { onConflict: 'session_id,song_key', ignoreDuplicates: true }
    )
  if (blacklistError) {
    console.error('blacklist iTunes incomplete:', blacklistError)
  }

  // 4. Passe le round en voting → declenche la notification Realtime au public
  const { error: updateError } = await supabase
    .from('rounds')
    .update({ status: 'voting' })
    .eq('id', round.id)

  if (updateError) {
    throw new Error(`Erreur lancement vote : ${updateError.message}`)
  }

  // 5. Mise a jour de l'activite DJ pour reinitialiser le timer d'inactivite
  await supabase
    .from('sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId)

  revalidatePath(`/dj/sessions/${sessionId}`)
  redirect(`/dj/sessions/${sessionId}`)
}

export type DrawLibraryResult = { poolExhausted?: true; error?: string } | undefined

export async function drawLibraryRound(sessionId: string): Promise<DrawLibraryResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Chansons deja proposees dans cette session
  const { data: usedData } = await supabase
    .from('session_used_songs')
    .select('song_key')
    .eq('session_id', sessionId)
  const usedSet = new Set((usedData ?? []).map(r => r.song_key as string))

  // 2. Toute la bibliotheque du DJ
  const { data: allSongs, error: libError } = await supabase
    .from('library_songs')
    .select('id, title_clean, title_original, artist, smule_url')
    .eq('dj_id', user.id)
  if (libError) return { error: `Erreur lecture bibliotheque : ${libError.message}` }

  // 3. Filtre en Node.js (evite la complexite du filtre NOT IN PostgREST avec des URLs)
  const available = (allSongs ?? []).filter(s => !usedSet.has(s.smule_url as string))
  if (available.length === 0) return { poolExhausted: true }

  // 4. Tirage aleatoire, au plus 4 chansons
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  const drawn = shuffled.slice(0, 4)

  // 5. Cree le round en lobby
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({ session_id: sessionId, question: 'Quelle sera la prochaine chanson ?', status: 'lobby' })
    .select('id')
    .single()
  if (roundError || !round) return { error: `Erreur creation round : ${roundError?.message}` }

  // 6. Insere les options — nettoyage round si echec
  const { error: optionsError } = await supabase
    .from('options')
    .insert(drawn.map((s, i) => ({
      round_id:          round.id,
      label:             (s.title_clean ?? s.title_original) as string,
      artist:            s.artist ?? null,
      position:          i,
      spotify_track_id:  null,
      spotify_image_url: null,
    })))
  if (optionsError) {
    await supabase.from('rounds').delete().eq('id', round.id)
    return { error: `Erreur insertion options : ${optionsError.message}` }
  }

  // 7. Blacklist AVANT voting — nettoyage complet si echec
  const { error: blacklistError } = await supabase
    .from('session_used_songs')
    .upsert(
      drawn.map(s => ({ session_id: sessionId, song_key: s.smule_url as string })),
      { onConflict: 'session_id,song_key', ignoreDuplicates: true }
    )
  if (blacklistError) {
    await supabase.from('rounds').delete().eq('id', round.id) // cascade supprime les options
    return { error: `Erreur blacklist : ${blacklistError.message}` }
  }

  // 8. Passe en voting → Realtime public se declenche ici
  const { error: updateError } = await supabase
    .from('rounds')
    .update({ status: 'voting' })
    .eq('id', round.id)
  if (updateError) {
    await supabase.from('session_used_songs')
      .delete()
      .eq('session_id', sessionId)
      .in('song_key', drawn.map(s => s.smule_url as string))
    await supabase.from('rounds').delete().eq('id', round.id)
    return { error: `Erreur lancement vote : ${updateError.message}` }
  }

  // 9. MAJ activite DJ
  await supabase
    .from('sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId)

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

  // Mise a jour de l'activite DJ
  await supabase
    .from('sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId)

  revalidatePath(`/dj/sessions/${sessionId}`)
  redirect(`/dj/sessions/${sessionId}`)
}
