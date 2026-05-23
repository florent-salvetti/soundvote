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

    const supabase = createClient()
    const { error } = await supabase.from('votes').insert({
      round_id: round.id,
      option_id: optionId,
      voter_anon_id: voterId,
    })

    // 23505 = unique_violation : garde-fou final si localStorage a ete efface.
    // Dans ce cas on affiche quand meme le feedback sur l'option tapee.
    if (!error || error.code === '23505') {
      setVotedOptionId(optionId)
      localStorage.setItem(`soundvote_vote_${round.id}`, optionId)
    }

    setIsVoting(false)
  }

  // Ecran resultats (round clos)
  if (round?.status === 'closed') {
    if (!results) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
          <p className="text-sm text-zinc-500">Calcul des resultats...</p>
        </main>
      )
    }

    const { type, winners } = computeWinner(results)
    const totalVotes = results.reduce((sum, r) => sum + r.total, 0)

    return (
      <main className="flex min-h-screen flex-col bg-black px-4 py-12 text-white">
        <div className="mx-auto w-full max-w-md">
          <p className="mb-6 text-sm text-zinc-500">Session {code}</p>

          {/* Bandeau gagnant */}
          <div className="mb-8 rounded-xl bg-zinc-900 px-5 py-4">
            {type === 'none' && (
              <p className="font-semibold text-zinc-400">Aucun vote sur cette manche.</p>
            )}
            {type === 'single' && (
              <p className="font-semibold">
                Gagnant : <span className="text-emerald-400">{winners[0].label}</span>
              </p>
            )}
            {type === 'tie' && (
              <p className="font-semibold">
                Egalite : <span className="text-emerald-400">{winners.map((w) => w.label).join(' et ')}</span>
              </p>
            )}
          </div>

          {/* Resultats par option */}
          <div className="flex flex-col gap-4">
            {results.map((r) => {
              const pct = totalVotes > 0 ? Math.round((r.total / totalVotes) * 100) : 0
              return (
                <div key={r.option_id} className="rounded-2xl border border-zinc-800 px-6 py-5">
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold">{r.label}</p>
                      {r.artist && <p className="mt-1 text-sm text-zinc-400">{r.artist}</p>}
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-zinc-400">
                      {r.total} <span className="text-zinc-600">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-zinc-500"
                      style={{ width: `${pct}%` }}
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

  // Ecran vote (round en cours)
  if (round?.status === 'voting') {
    return (
      <main className="flex min-h-screen flex-col bg-black px-4 py-12 text-white">
        <div className="mx-auto w-full max-w-md">
          <p className="mb-6 text-sm text-zinc-500">Session {code}</p>
          <h1 className="mb-8 text-2xl font-bold leading-snug">{round.question}</h1>
          <div className="flex flex-col gap-3">
            {round.options.map((o) => {
              const isVoted = votedOptionId === o.id
              const isOther = votedOptionId !== null && !isVoted

              return (
                <button
                  key={o.id}
                  onClick={() => handleVote(o.id)}
                  disabled={!!votedOptionId || isVoting}
                  className={[
                    'w-full rounded-2xl border px-6 py-5 text-left transition-colors disabled:cursor-default',
                    isVoted
                      ? 'border-emerald-400 bg-emerald-400/10'
                      : isOther
                      ? 'border-zinc-800 opacity-40'
                      : 'border-zinc-700 hover:border-zinc-400 active:border-zinc-300',
                  ].join(' ')}
                >
                  <p className="text-lg font-semibold">{o.label}</p>
                  {o.artist && <p className="mt-1 text-sm text-zinc-400">{o.artist}</p>}
                  {isVoted && (
                    <p className="mt-2 text-xs font-medium text-emerald-400">Vote enregistre</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </main>
    )
  }

  // Ecran attente (pas encore de vote lance)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
      <div className="mb-8 flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <span className="text-sm text-zinc-400">Session {code}</span>
      </div>
      <h1 className="text-2xl font-bold text-white">En attente du DJ...</h1>
      <p className="mt-3 text-zinc-500">Le vote va bientot commencer.</p>
    </main>
  )
}
