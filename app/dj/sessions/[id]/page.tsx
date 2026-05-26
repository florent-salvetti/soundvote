import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { launchRound, closeRound } from '@/app/actions/round'
import LiveResults from './live-results'
import SessionQR from './session-qr'
import RoundHistory from './round-history'
import { type ResultRow } from '@/lib/round-results'

export const dynamic = 'force-dynamic'

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

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

  type ClosedRound = { id: string; question: string; results: ResultRow[] }
  let closedRounds: ClosedRound[] = []
  if (!activeRound) {
    const { data: closedData } = await supabase
      .from('rounds')
      .select('id, question')
      .eq('session_id', id)
      .eq('status', 'closed')
      .order('created_at', { ascending: false })
    if (closedData && closedData.length > 0) {
      closedRounds = await Promise.all(
        (closedData as { id: string; question: string }[]).map(async (r) => {
          const { data } = await supabase.rpc('get_round_results', { p_round_id: r.id })
          return { ...r, results: (data as ResultRow[]) ?? [] }
        })
      )
    }
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const joinUrl = `${protocol}://${host}/join/${session.code}`

  const launchRoundAction = launchRound.bind(null, id)
  const closeRoundAction = activeRound ? closeRound.bind(null, id, activeRound.id) : null

  return (
    <main className="page-bg min-h-screen px-5 py-10 text-cream">
      <div className="mx-auto w-full max-w-md">

        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/dj"
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim transition-colors hover:text-cream"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Tableau de bord
          </Link>
        </div>

        {/* Code session + QR */}
        <div className="mb-8 rounded-2xl border border-border bg-surface p-6">
          <p className="mb-3 font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
            Code session
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-display text-5xl font-normal tracking-[.2em] text-cream text-glow-green">
                {session.code}
              </p>
              <p className="mt-2 truncate font-mono text-[10px] tracking-wider text-gray-dim">
                {joinUrl}
              </p>
            </div>
            <div className="shrink-0 self-start rounded-xl bg-white p-2 sm:self-auto">
              <SessionQR url={joinUrl} />
            </div>
          </div>
        </div>

        {errorMsg && (
          <p className="mb-6 rounded-xl border border-neon-magenta/20 bg-neon-magenta/10 px-4 py-3 font-sans text-sm text-neon-magenta">
            {decodeURIComponent(errorMsg)}
          </p>
        )}

        {activeRound ? (
          /* ── Round en cours ── */
          <div>
            <div className="mb-5 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-green" />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-neon-green">
                Vote en cours
              </span>
            </div>

            <p className="mb-6 font-display text-2xl font-normal leading-tight text-cream">
              {activeRound.question}
            </p>

            <div className="flex flex-col gap-2.5">
              {roundOptions.map((o, idx) => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs font-bold text-gray-mid">
                    {OPTION_LETTERS[idx] ?? idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-sans font-semibold text-cream">{o.label}</p>
                    {o.artist && (
                      <p className="mt-0.5 font-mono text-[10px] text-gray-dim">{o.artist}</p>
                    )}
                  </div>
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
                  className="w-full rounded-xl border border-neon-magenta/30 py-3.5 font-sans text-sm font-semibold text-neon-magenta transition-all hover:bg-neon-magenta/10 hover:glow-magenta"
                >
                  Clore le vote
                </button>
              </form>
            )}
          </div>
        ) : (
          <div>
            {/* Historique des manches */}
            <RoundHistory rounds={closedRounds} />

            {/* Formulaire nouvelle manche */}
            <form action={launchRoundAction} className="flex flex-col gap-5">

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
                  Question
                </label>
                <input
                  name="question"
                  placeholder="Quelle sera la prochaine chanson ?"
                  className="h-12 rounded-xl border border-border bg-surface-2 px-4 font-sans text-sm text-cream placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
                  Options (2 minimum)
                </p>
                {OPTION_LETTERS.map((letter, i) => (
                  <div key={letter} className="flex items-start gap-3">
                    <span className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 font-mono text-xs font-bold text-gray-mid">
                      {letter}
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <input
                        name={`option_label_${i + 1}`}
                        required={i < 2}
                        placeholder={i < 2 ? 'Titre' : 'Titre (optionnel)'}
                        className="h-11 rounded-xl border border-border bg-surface-2 px-3 font-sans text-sm text-cream placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
                      />
                      <input
                        name={`option_artist_${i + 1}`}
                        placeholder="Artiste (optionnel)"
                        className="h-9 rounded-xl border border-border bg-surface-2 px-3 font-mono text-[11px] text-cream placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="flex h-14 items-center justify-center gap-2.5 rounded-xl bg-neon-green font-sans text-base font-semibold text-bg shadow-lg shadow-neon-green/20 transition-all hover:brightness-110"
              >
                Lancer le vote
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </div>
        )}

      </div>
    </main>
  )
}
