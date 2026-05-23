import { createAnonClient } from '@/lib/supabase/anon-client'
import WaitingRoom from './waiting-room'

export const dynamic = 'force-dynamic'

type Option = { id: string; label: string; artist: string | null; position: number }
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
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
        <p className="mb-4 text-5xl text-zinc-600">?</p>
        <h1 className="text-xl font-semibold text-white">Code inconnu</h1>
        <p className="mt-2 text-zinc-400">Verifie le code avec le DJ et reessaie.</p>
      </main>
    )
  }

  if (session.status === 'closed') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
        <h1 className="text-xl font-semibold text-white">Session terminee</h1>
        <p className="mt-2 text-zinc-400">La soiree est finie. A bientot.</p>
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
      .select('id, label, artist, position')
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
