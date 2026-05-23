import { createAnonClient } from '@/lib/supabase/anon-client'
import WaitingRoom from './waiting-room'

// Toujours dynamique : le statut de la session change en cours de soiree
export const dynamic = 'force-dynamic'

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
        <p className="text-5xl mb-4">?</p>
        <h1 className="text-xl font-semibold text-white">Code inconnu</h1>
        <p className="mt-2 text-zinc-400">
          Verifie le code avec le DJ et reessaie.
        </p>
      </main>
    )
  }

  if (session.status === 'closed') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
        <p className="text-5xl mb-4">🎵</p>
        <h1 className="text-xl font-semibold text-white">Session terminee</h1>
        <p className="mt-2 text-zinc-400">La soiree est finie. A bientot.</p>
      </main>
    )
  }

  return <WaitingRoom code={normalizedCode} sessionId={session.id} />
}
