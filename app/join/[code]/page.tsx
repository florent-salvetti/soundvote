import { createAnonClient } from '@/lib/supabase/anon-client'
import WaitingRoom from './waiting-room'

export const dynamic = 'force-dynamic'

type Option = { id: string; label: string; artist: string | null; position: number; spotify_image_url: string | null }
type ActiveRound = { id: string; question: string; status: string; options: Option[] }

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const normalizedCode = code.toUpperCase()

  const supabase = createAnonClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('code', normalizedCode)
    .maybeSingle()

  if (!session) {
    return (
      <main className="page-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 font-display text-6xl font-extrabold text-gray-dim">?</p>
        <h1 className="font-display text-2xl font-bold text-white">Code inconnu</h1>
        <p className="mt-3 text-sm text-gray-mid">Verifie le code avec le DJ et reessaie.</p>
      </main>
    )
  }

  if (session.status === 'closed') {
    return (
      <main className="page-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Session terminee</h1>
        <p className="mt-3 text-sm text-gray-mid">La soiree est finie. A bientot.</p>
      </main>
    )
  }

  // Si un vote est deja en cours quand le public rejoint, on l'affiche immediatement
  let initialRound: ActiveRound | null = null
  const { data: roundData } = await supabase
    .from('rounds')
    .select('id, question, status')
    .eq('session_id', session.id)
    .eq('status', 'voting')
    .maybeSingle()

  if (roundData) {
    const { data: opts } = await supabase
      .from('options')
      .select('id, label, artist, position, spotify_image_url')
      .eq('round_id', roundData.id)
      .order('position')
    initialRound = { ...roundData, options: (opts as Option[]) ?? [] }
  }

  return (
    <WaitingRoom
      code={normalizedCode}
      sessionId={session.id}
      initialRound={initialRound}
    />
  )
}
