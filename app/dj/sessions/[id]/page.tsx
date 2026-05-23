import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { launchRound, closeRound } from '@/app/actions/round'
import LiveResults from './live-results'
import SessionQR from './session-qr'
import { computeWinner, type ResultRow } from '@/lib/round-results'

export const dynamic = 'force-dynamic'

type Option = { id: string; label: string; artist: string | null; position: number }
type Round  = { id: string; question: string; status: string }

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error: errorMsg } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, code, status')
    .eq('id', id)
    .eq('dj_id', user.id)
    .single()

  if (!session) redirect('/dj')

  // Round actif (lobby ou voting) pour cette session
  const { data: activeRound } = await supabase
    .from('rounds')
    .select('id, question, status')
    .eq('session_id', id)
    .in('status', ['lobby', 'voting'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: Round | null }

  let roundOptions: Option[] = []
  let initialCounts: Record<string, number> = {}
  if (activeRound) {
    const { data: opts } = await supabase
      .from('options')
      .select('id, label, artist, position')
      .eq('round_id', activeRound.id)
      .order('position')
    roundOptions = (opts as Option[]) ?? []

    const { data: countsData } = await supabase
      .from('vote_counts')
      .select('option_id, total')
      .eq('round_id', activeRound.id)
    if (countsData) {
      for (const row of countsData as { option_id: string; total: number }[]) {
        initialCounts[row.option_id] = row.total
      }
    }
  }

  // Derniere manche cloturee — affichee au DJ apres cloture, avant la prochaine manche
  let lastClosedRound: { id: string; question: string } | null = null
  let lastClosedResults: ResultRow[] = []
  if (!activeRound) {
    const { data: closedData } = await supabase
      .from('rounds')
      .select('id, question')
      .eq('session_id', id)
      .eq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (closedData) {
      lastClosedRound = closedData as { id: string; question: string }
      const { data: rpcData } = await supabase.rpc('get_round_results', { p_round_id: closedData.id })
      lastClosedResults = (rpcData as ResultRow[]) ?? []
    }
  }

  const closedWinner = lastClosedRound ? computeWinner(lastClosedResults) : null
  const closedTotalVotes = lastClosedResults.reduce((sum, r) => sum + r.total, 0)

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const joinUrl = `${protocol}://${host}/join/${session.code}`

  const launchRoundAction = launchRound.bind(null, id)
  const closeRoundAction = activeRound ? closeRound.bind(null, id, activeRound.id) : null

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-md">

        <Link
          href="/dj"
          className="mb-10 inline-block text-sm text-zinc-500 transition-colors hover:text-white"
        >
          Retour au tableau de bord
        </Link>

        {/* Code, lien et QR */}
        <div className="mb-8 flex items-center gap-4 rounded-xl border border-zinc-800 px-5 py-4">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-2xl font-bold tracking-widest">{session.code}</span>
            <p className="mt-1 truncate text-xs text-zinc-500">{joinUrl}</p>
          </div>
          <SessionQR url={joinUrl} />
        </div>

        {errorMsg && (
          <p className="mb-6 rounded-lg bg-red-950 px-4 py-3 text-sm text-red-400">
            {decodeURIComponent(errorMsg)}
          </p>
        )}

        {activeRound ? (
          /* Round en cours */
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Vote en cours</span>
            </div>
            <p className="mb-6 text-lg font-semibold">{activeRound.question}</p>
            <div className="flex flex-col gap-3">
              {roundOptions.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-zinc-700 px-5 py-4"
                >
                  <p className="font-semibold">{o.label}</p>
                  {o.artist && <p className="mt-0.5 text-sm text-zinc-400">{o.artist}</p>}
                </div>
              ))}
            </div>
            <LiveResults
              roundId={activeRound.id}
              options={roundOptions}
              initialCounts={initialCounts}
            />
            {closeRoundAction && (
              <form action={closeRoundAction} className="mt-8">
                <button
                  type="submit"
                  className="w-full rounded-xl border border-red-900 bg-red-950/50 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-950"
                >
                  Clore le vote
                </button>
              </form>
            )}
          </div>
        ) : (
          <div>
            {/* Resultats de la manche precedente */}
            {lastClosedRound && closedWinner && (
              <div className="mb-8 rounded-xl border border-zinc-800 px-5 py-5">
                <p className="mb-1 text-xs text-zinc-600">Manche precedente</p>
                <p className="mb-4 text-sm text-zinc-500">{lastClosedRound.question}</p>
                <div className="mb-5 rounded-lg bg-zinc-900 px-4 py-3">
                  {closedWinner.type === 'none' && (
                    <p className="font-semibold text-zinc-400">Aucun vote sur cette manche.</p>
                  )}
                  {closedWinner.type === 'single' && (
                    <p className="font-semibold">
                      Gagnant : <span className="text-emerald-400">{closedWinner.winners[0].label}</span>
                    </p>
                  )}
                  {closedWinner.type === 'tie' && (
                    <p className="font-semibold">
                      Egalite : <span className="text-emerald-400">{closedWinner.winners.map((w) => w.label).join(' et ')}</span>
                    </p>
                  )}
                </div>
                {lastClosedResults.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {lastClosedResults.map((r) => {
                      const pct = closedTotalVotes > 0 ? Math.round((r.total / closedTotalVotes) * 100) : 0
                      return (
                        <div key={r.option_id}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-4">
                            <div className="min-w-0">
                              <span className="font-semibold">{r.label}</span>
                              {r.artist && <span className="ml-2 text-sm text-zinc-400">{r.artist}</span>}
                            </div>
                            <span className="shrink-0 text-sm tabular-nums text-zinc-400">
                              {r.total} <span className="text-zinc-600">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-zinc-600"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Formulaire nouvelle manche */}
            <form action={launchRoundAction} className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-zinc-400">Question</label>
                <input
                  name="question"
                  required
                  placeholder="Quelle sera la prochaine chanson ?"
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-zinc-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-4">
                <p className="text-sm text-zinc-400">Options (2 minimum)</p>

                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex flex-col gap-2 rounded-xl border border-zinc-800 p-4">
                    <span className="text-xs text-zinc-600">
                      Option {n}{n > 2 ? ' (optionnelle)' : ''}
                    </span>
                    <input
                      name={`option_label_${n}`}
                      required={n <= 2}
                      placeholder="Titre"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-white placeholder-zinc-600 focus:border-zinc-400 focus:outline-none"
                    />
                    <input
                      name={`option_artist_${n}`}
                      placeholder="Artiste (optionnel)"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white placeholder-zinc-600 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="rounded-xl bg-white py-4 font-semibold text-black transition-colors hover:bg-zinc-200"
              >
                Lancer le vote
              </button>
            </form>
          </div>
        )}

      </div>
    </main>
  )
}
