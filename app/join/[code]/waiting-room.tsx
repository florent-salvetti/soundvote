'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeWinner, type ResultRow } from '@/lib/round-results'

const VOTER_ID_KEY = 'soundvote_voter_id'

function generateVoterId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

type Option = { id: string; label: string; artist: string | null; position: number }
type Round  = { id: string; question: string; status: string; options: Option[] }

export default function WaitingRoom({
  code,
  sessionId,
  initialRound,
}: {
  code: string
  sessionId: string
  initialRound: Round | null
}) {
  const [round, setRound] = useState<Round | null>(initialRound)
  const [voterId, setVoterId] = useState<string | null>(null)
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null)
  const [isVoting, setIsVoting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [results, setResults] = useState<ResultRow[] | null>(null)

  // Voter identity — lecture/creation dans localStorage
  useEffect(() => {
    let id = localStorage.getItem(VOTER_ID_KEY)
    if (!id) {
      id = generateVoterId()
      localStorage.setItem(VOTER_ID_KEY, id)
    }
    setVoterId(id)
  }, [])

  // Controle anti double-vote : si on a deja vote sur ce round (via localStorage), restaurer l'etat
  useEffect(() => {
    if (round?.status === 'voting' && round.id) {
      const prev = localStorage.getItem(`soundvote_vote_${round.id}`)
      setVotedOptionId(prev)
    }
  }, [round?.id, round?.status])

  // Resultats via get_round_results (seule voie autorisee pour le public, uniquement sur round closed)
  useEffect(() => {
    if (round?.status !== 'closed' || !round.id) return

    const supabase = createClient()
    supabase
      .rpc('get_round_results', { p_round_id: round.id })
      .then(({ data }) => {
        setResults((data as ResultRow[]) ?? [])
      })
  }, [round?.id, round?.status])

  // Abonnement aux changements sur rounds pour cette session uniquement.
  // JAMAIS sur la table votes : cf. contrainte securite CLAUDE.md.
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`session-rounds-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rounds',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const updated = payload.new as { id: string; question: string; status: string }

          if (updated.status === 'voting') {
            const { data: opts } = await supabase
              .from('options')
              .select('id, label, artist, position')
              .eq('round_id', updated.id)
              .order('position')

            setRound({ ...updated, options: (opts as Option[]) ?? [] })
          } else if (updated.status === 'closed') {
            setRound((prev) => prev ? { ...prev, status: 'closed' } : null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  async function handleVote(optionId: string) {
    if (!voterId || votedOptionId || isVoting || !round) return
    setIsVoting(true)
    setVoteError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.from('votes').insert({
        round_id: round.id,
        option_id: optionId,
        voter_anon_id: voterId,
      })

      // 23505 = unique_violation : garde-fou final si localStorage a ete efface.
      if (!error || error.code === '23505') {
        setVotedOptionId(optionId)
        localStorage.setItem(`soundvote_vote_${round.id}`, optionId)
      } else {
        console.error('Vote error:', error)
        setVoteError(`Erreur : ${error.message} (${error.code})`)
      }
    } catch (err) {
      console.error('Vote exception:', err)
      setVoteError('Impossible de voter. Verifie ta connexion.')
    } finally {
      setIsVoting(false)
    }
  }

  // ── Ecran resultats (round clos) ──────────────────────────────────────────

  if (round?.status === 'closed') {
    if (!results) {
      return (
        <main className="page-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-green mb-4" />
          <p className="text-sm text-gray-mid">Calcul des resultats...</p>
        </main>
      )
    }

    const { type, winners } = computeWinner(results)
    const totalVotes = results.reduce((sum, r) => sum + r.total, 0)

    return (
      <main className="page-bg min-h-screen px-4 py-12 text-white">
        <div className="mx-auto w-full max-w-sm">

          <p className="mb-8 text-xs font-semibold uppercase tracking-widest text-gray-mid">
            Session {code}
          </p>

          {/* Bandeau gagnant */}
          <div className="mb-8 rounded-2xl border border-border bg-surface px-6 py-6 text-center">
            {type === 'none' && (
              <p className="text-sm text-gray-mid">Aucun vote sur cette manche.</p>
            )}
            {type === 'single' && (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neon-green">
                  Gagnant
                </p>
                <p className="font-display text-3xl font-extrabold leading-tight text-neon-green text-glow-green">
                  {winners[0].label}
                </p>
                {winners[0].artist && (
                  <p className="mt-1 text-sm text-gray-mid">{winners[0].artist}</p>
                )}
              </>
            )}
            {type === 'tie' && (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neon-magenta">
                  Egalite
                </p>
                <p className="font-display text-2xl font-extrabold text-neon-magenta">
                  {winners.map((w) => w.label).join(' / ')}
                </p>
              </>
            )}
          </div>

          {/* Barres de resultats */}
          <div className="flex flex-col gap-4">
            {results.map((r) => {
              const pct = totalVotes > 0 ? Math.round((r.total / totalVotes) * 100) : 0
              const isWinner = type !== 'none' && winners.some((w) => w.option_id === r.option_id)

              return (
                <div
                  key={r.option_id}
                  className={`rounded-2xl border px-5 py-4 transition-colors ${
                    isWinner
                      ? 'border-neon-green/30 bg-neon-green/5'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <p className={`font-display font-bold ${isWinner ? 'text-neon-green' : 'text-gray-hi'}`}>
                        {r.label}
                      </p>
                      {r.artist && (
                        <p className="mt-0.5 text-xs text-gray-mid">{r.artist}</p>
                      )}
                    </div>
                    <span className={`shrink-0 font-display text-sm tabular-nums font-bold ${
                      isWinner ? 'text-neon-green' : 'text-gray-mid'
                    }`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`bar-fill h-full rounded-full ${isWinner ? 'bg-neon-green' : 'bg-gray-dim'}`}
                      style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
                    />
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </main>
    )
  }

  // ── Ecran vote (round en cours) ──────────────────────────────────────────

  if (round?.status === 'voting') {
    return (
      <main className="page-bg min-h-screen px-4 py-10 text-white">
        <div className="mx-auto w-full max-w-sm">

          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-gray-mid">
            Session {code}
          </p>

          <h1 className="mb-8 font-display text-2xl font-extrabold leading-tight text-white">
            {round.question}
          </h1>

          {voteError && (
            <p className="mb-4 rounded-xl border border-neon-magenta/20 bg-neon-magenta/10 px-4 py-3 text-sm text-neon-magenta">
              {voteError}
            </p>
          )}

          <div className="flex flex-col gap-4">
            {round.options.map((o) => {
              const isVoted = votedOptionId === o.id
              const isOther = votedOptionId !== null && !isVoted

              return (
                <button
                  key={o.id}
                  onClick={() => handleVote(o.id)}
                  disabled={!!votedOptionId || isVoting}
                  className={[
                    'w-full rounded-2xl border px-6 py-6 text-left transition-all duration-200',
                    'active:scale-[0.98] disabled:cursor-default',
                    isVoted
                      ? 'border-neon-green bg-neon-green/10 glow-green'
                      : isOther
                      ? 'border-border bg-surface opacity-30'
                      : 'border-border bg-surface hover:border-neon-green/30 hover:bg-surface-2',
                  ].join(' ')}
                >
                  <p className={`font-display text-xl font-bold ${isVoted ? 'text-neon-green' : 'text-white'}`}>
                    {o.label}
                  </p>
                  {o.artist && (
                    <p className={`mt-1 text-sm ${isVoted ? 'text-neon-green/70' : 'text-gray-mid'}`}>
                      {o.artist}
                    </p>
                  )}
                  {isVoted && (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-neon-green">
                      Vote enregistre ✓
                    </p>
                  )}
                </button>
              )
            })}
          </div>

        </div>
      </main>
    )
  }

  // ── Ecran attente (pas encore de vote lance) ──────────────────────────────

  return (
    <main className="page-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">

      <div className="mb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-mid">
          Session
        </p>
        <p className="font-display text-7xl font-extrabold tracking-[.15em] text-white text-glow-green">
          {code}
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-green" />
        <span className="text-xs font-semibold uppercase tracking-widest text-neon-green">
          En direct
        </span>
      </div>

      <h1 className="font-display text-2xl font-bold text-white">
        En attente du DJ...
      </h1>
      <p className="mt-3 text-sm text-gray-mid">Le vote va bientot commencer.</p>

    </main>
  )
}
