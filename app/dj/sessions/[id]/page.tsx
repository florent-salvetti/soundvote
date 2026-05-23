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
    <main className="page-bg min-h-screen px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-md">

        <Link
          href="/dj"
          className="mb-8 inline-flex items-center gap-1.5 text-xs text-gray-mid transition-colors hover:text-white"
        >
          ← Tableau de bord
        </Link>

        {/* Code de session + QR */}
        <div className="mb-8 rounded-2xl border border-border bg-surface p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-mid">
            Code session
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-display text-5xl font-extrabold tracking-[.2em] text-white text-glow-green">
                {session.code}
              </p>
              <p className="mt-2 truncate text-xs text-gray-dim">{joinUrl}</p>
            </div>
            <div className="shrink-0 self-start rounded-xl bg-white p-2 sm:self-auto">
              <SessionQR url={joinUrl} />
            </div>
          </div>
        </div>

        {errorMsg && (
          <p className="mb-6 rounded-xl border border-neon-magenta/20 bg-neon-magenta/10 px-4 py-3 text-sm text-neon-magenta">
            {decodeURIComponent(errorMsg)}
          </p>
        )}

        {activeRound ? (
          /* ── Round en cours ── */
          <div>
            <div className="mb-5 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-green" />
              <span className="text-xs font-semibold uppercase tracking-widest text-neon-green">
                Vote en cours
              </span>
            </div>

            <p className="mb-6 font-display text-xl font-bold text-white">
              {activeRound.question}
            </p>

            <div className="flex flex-col gap-3">
              {roundOptions.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-border bg-surface px-5 py-3.5"
                >
                  <p className="font-sans font-semibold text-gray-hi">{o.label}</p>
                  {o.artist && (
                    <p className="mt-0.5 text-xs text-gray-mid">{o.artist}</p>
                  )}
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
                  className="w-full rounded-xl border border-neon-magenta/30 py-3.5 font-display text-sm font-bold tracking-wide text-neon-magenta transition-all hover:bg-neon-magenta/10 hover:glow-magenta"
                >
                  Clore le vote
                </button>
              </form>
            )}
          </div>
        ) : (
          <div>
            {/* ── Resultats manche precedente ── */}
            {lastClosedRound && closedWinner && (
              <div className="mb-8 rounded-2xl border border-border bg-surface p-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-dim">
                  Manche precedente
                </p>
                <p className="mb-4 text-sm text-gray-mid">{lastClosedRound.question}</p>

                <div className="mb-5 rounded-xl bg-surface-2 px-4 py-3">
                  {closedWinner.type === 'none' && (
                    <p className="text-sm text-gray-mid">Aucun vote sur cette manche.</p>
                  )}
                  {closedWinner.type === 'single' && (
                    <p className="font-display font-bold">
                      Gagnant{' '}
                      <span className="text-neon-green text-glow-green">
                        {closedWinner.winners[0].label}
                      </span>
                    </p>
                  )}
                  {closedWinner.type === 'tie' && (
                    <p className="font-display font-bold">
                      Egalite{' '}
                      <span className="text-neon-magenta">
                        {closedWinner.winners.map((w) => w.label).join(' et ')}
                      </span>
                    </p>
                  )}
                </div>

                {lastClosedResults.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {lastClosedResults.map((r) => {
                      const pct = closedTotalVotes > 0
                        ? Math.round((r.total / closedTotalVotes) * 100)
                        : 0
                      return (
                        <div key={r.option_id}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-4">
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-gray-hi">{r.label}</span>
                              {r.artist && (
                                <span className="ml-2 text-xs text-gray-mid">{r.artist}</span>
                              )}
                            </div>
                            <span className="shrink-0 text-xs tabular-nums text-gray-mid">
                              {r.total} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="bar-fill h-full rounded-full bg-neon-green/50"
                              style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Formulaire nouvelle manche ── */}
            <form action={launchRoundAction} className="flex flex-col gap-5">

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-mid">
                  Question
                </label>
                <input
                  name="question"
                  placeholder="Quelle sera la prochaine chanson ?"
                  className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-white placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
                />
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-mid">
                  Options (2 minimum)
                </p>
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
                  >
                    <span className="text-xs text-gray-dim">
                      Option {n}{n > 2 ? ' — optionnelle' : ''}
                    </span>
                    <input
                      name={`option_label_${n}`}
                      required={n <= 2}
                      placeholder="Titre"
                      className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
                    />
                    <input
                      name={`option_artist_${n}`}
                      placeholder="Artiste (optionnel)"
                      className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-gray-hi placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="rounded-xl bg-neon-green py-4 font-display text-sm font-bold tracking-wide text-bg transition-all hover:brightness-110 hover:glow-green"
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
