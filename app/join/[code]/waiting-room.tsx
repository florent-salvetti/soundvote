'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeWinner, type ResultRow } from '@/lib/round-results'
import QRCode from 'react-qr-code'

const VOTER_ID_KEY = 'soundvote_voter_id'
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

function generateVoterId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

type Option = { id: string; label: string; artist: string | null; position: number; spotify_image_url: string | null }
type Round  = { id: string; question: string; status: string; options: Option[] }

// Confettis purement CSS — pas de lib externe
const CONFETTI_ITEMS = [
  { color: '#ff4d5e', left: '8%',  delay: '0s',    size: 10 },
  { color: '#d4ff3a', left: '18%', delay: '0.15s',  size: 7  },
  { color: '#f3ecdc', left: '32%', delay: '0.05s',  size: 9  },
  { color: '#ff4d5e', left: '50%', delay: '0.25s',  size: 8  },
  { color: '#d4ff3a', left: '65%', delay: '0.1s',   size: 11 },
  { color: '#f3ecdc', left: '78%', delay: '0.2s',   size: 7  },
  { color: '#ff4d5e', left: '90%', delay: '0.05s',  size: 9  },
] as const

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
  const [copied, setCopied] = useState(false)

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${code}`
    : `https://soundvote.vercel.app/join/${code}`

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'SoundVote',
        text: `Vote pour la prochaine chanson — session ${code}`,
        url: joinUrl,
      }).catch(() => null)
    } else {
      await navigator.clipboard.writeText(joinUrl).catch(() => null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [code, joinUrl])

  // Voter identity
  useEffect(() => {
    let id = localStorage.getItem(VOTER_ID_KEY)
    if (!id) {
      id = generateVoterId()
      localStorage.setItem(VOTER_ID_KEY, id)
    }
    setVoterId(id)
  }, [])

  // Anti double-vote : restaurer l'etat depuis localStorage
  useEffect(() => {
    if (round?.status === 'voting' && round.id) {
      const prev = localStorage.getItem(`soundvote_vote_${round.id}`)
      setVotedOptionId(prev)
    }
  }, [round?.id, round?.status])

  // Resultats (uniquement via get_round_results, acces public autorise uniquement sur round closed)
  useEffect(() => {
    if (round?.status !== 'closed' || !round.id) return

    const supabase = createClient()
    supabase
      .rpc('get_round_results', { p_round_id: round.id })
      .then(({ data }) => {
        setResults((data as ResultRow[]) ?? [])
      })
  }, [round?.id, round?.status])

  // Abonnement rounds uniquement. JAMAIS votes (cf. CLAUDE.md contrainte securite).
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
              .select('id, label, artist, position, spotify_image_url')
              .eq('round_id', updated.id)
              .order('position')

            setRound({ ...updated, options: (opts as Option[]) ?? [] })
            setVotedOptionId(null)
            setVoteError(null)
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

      // 23505 = unique_violation : garde-fou si localStorage efface
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

  // ── Ecran resultats ───────────────────────────────────────────────────────

  if (round?.status === 'closed') {
    if (!results) {
      return (
        <main className="page-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <span className="mb-4 inline-block h-2 w-2 animate-pulse rounded-full bg-neon-green" />
          <p className="font-mono text-xs tracking-widest uppercase text-gray-mid">
            Calcul des resultats...
          </p>
        </main>
      )
    }

    const { type, winners } = computeWinner(results)
    const totalVotes = results.reduce((sum, r) => sum + r.total, 0)

    return (
      <main className="page-bg relative min-h-screen overflow-hidden px-5 py-12 text-cream">

        {/* Confettis (uniquement si un gagnant) */}
        {type !== 'none' && (
          <div className="pointer-events-none absolute inset-x-0 top-0" aria-hidden>
            {CONFETTI_ITEMS.map((item, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: item.left,
                  top: '-2vh',
                  width: item.size,
                  height: item.size,
                  borderRadius: '2px',
                  backgroundColor: item.color,
                  animation: `confetti-fall 2.8s ${item.delay} ease-in both`,
                }}
              />
            ))}
          </div>
        )}

        <div className="mx-auto w-full max-w-sm">

          <p className="mb-8 font-mono text-[10px] tracking-[0.2em] uppercase text-gray-dim">
            Session {code}
          </p>

          {/* Carte gagnant */}
          <div className={`mb-8 rounded-2xl border px-6 py-6 text-center ${
            type === 'single'
              ? 'border-neon-green/30 bg-neon-green/5'
              : type === 'tie'
              ? 'border-neon-magenta/30 bg-neon-magenta/5'
              : 'border-border bg-surface'
          }`}>
            {type === 'none' && (
              <p className="font-mono text-xs uppercase tracking-widest text-gray-dim">
                Aucun vote sur cette manche.
              </p>
            )}
            {type === 'single' && (
              <>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-green">
                  Gagnant
                </p>
                <p className="font-display text-3xl font-normal leading-tight text-neon-green text-glow-green">
                  {winners[0].label}
                </p>
                {winners[0].artist && (
                  <p className="mt-1 font-mono text-xs text-gray-mid">{winners[0].artist}</p>
                )}
              </>
            )}
            {type === 'tie' && (
              <>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-magenta">
                  Egalite
                </p>
                <p className="font-display text-2xl font-normal text-neon-magenta">
                  {winners.map((w) => w.label).join(' / ')}
                </p>
              </>
            )}
          </div>

          {/* Barres de resultats */}
          <div className="flex flex-col gap-3">
            {results.map((r, idx) => {
              const pct = totalVotes > 0 ? Math.round((r.total / totalVotes) * 100) : 0
              const isWinner = type !== 'none' && winners.some((w) => w.option_id === r.option_id)

              return (
                <div
                  key={r.option_id}
                  className={`rounded-2xl border px-5 py-4 ${
                    isWinner ? 'border-neon-green/30 bg-neon-green/5' : 'border-border bg-surface'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                      isWinner ? 'bg-neon-green text-bg' : 'bg-surface-2 text-gray-mid'
                    }`}>
                      {OPTION_LETTERS[idx] ?? idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-sans font-semibold ${isWinner ? 'text-neon-green' : 'text-cream'}`}>
                        {r.label}
                      </p>
                      {r.artist && (
                        <p className="mt-0.5 font-mono text-[10px] text-gray-dim">{r.artist}</p>
                      )}
                    </div>
                    <span className={`shrink-0 font-mono text-sm tabular-nums font-bold ${
                      isWinner ? 'text-neon-green' : 'text-gray-mid'
                    }`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`bar-fill h-full rounded-full ${isWinner ? 'bg-neon-green' : 'bg-gray-dim/50'}`}
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

  // ── Ecran vote ────────────────────────────────────────────────────────────

  if (round?.status === 'voting') {
    return (
      <main className="page-bg min-h-screen px-5 py-10 text-cream">
        <div className="mx-auto w-full max-w-sm">

          <div className="mb-6 flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-gray-dim">
              Session {code}
            </p>
            <button
              onClick={handleShare}
              aria-label="Inviter des amis"
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] uppercase text-gray-dim transition-colors hover:text-cream"
            >
              {copied ? 'Copie !' : 'Inviter'}
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M9 1H5a1 1 0 00-1 1v8a1 1 0 001 1h7a1 1 0 001-1V4L9 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 1v3h3M3 4H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <h1 className="mb-8 font-display text-2xl font-normal leading-tight text-cream">
            {round.question}
          </h1>

          {voteError && (
            <p className="mb-4 rounded-xl border border-neon-magenta/20 bg-neon-magenta/10 px-4 py-3 font-sans text-sm text-neon-magenta">
              {voteError}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {round.options.map((o, idx) => {
              const isVoted = votedOptionId === o.id
              const isOther = votedOptionId !== null && !isVoted

              return (
                <button
                  key={o.id}
                  onClick={() => handleVote(o.id)}
                  disabled={!!votedOptionId || isVoting}
                  className={[
                    'flex w-full items-center gap-4 rounded-2xl border px-5 py-5 text-left transition-all duration-200',
                    'active:scale-[0.98] disabled:cursor-default',
                    isVoted
                      ? 'border-neon-green bg-neon-green/10 glow-green'
                      : isOther
                      ? 'border-border bg-surface opacity-30'
                      : 'border-border bg-surface hover:border-neon-green/30 hover:bg-surface-2',
                  ].join(' ')}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold transition-colors ${
                    isVoted
                      ? 'bg-neon-green text-bg'
                      : 'bg-surface-2 text-gray-mid'
                  }`}>
                    {OPTION_LETTERS[idx] ?? idx + 1}
                  </span>
                  {o.spotify_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.spotify_image_url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`font-sans font-semibold ${isVoted ? 'text-neon-green' : 'text-cream'}`}>
                      {o.label}
                    </p>
                    {o.artist && (
                      <p className={`mt-0.5 font-mono text-[10px] ${isVoted ? 'text-neon-green/70' : 'text-gray-dim'}`}>
                        {o.artist}
                      </p>
                    )}
                  </div>
                  {isVoted && (
                    <svg className="shrink-0 text-neon-green" width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5.5 9l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>

        </div>
      </main>
    )
  }

  // ── Ecran lobby (attente) ─────────────────────────────────────────────────

  return (
    <main className="page-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">

      {/* Code avec anneau pulsant */}
      <div className="relative mb-10 flex items-center justify-center">
        <div
          className="absolute rounded-full border border-neon-green/30"
          style={{ animation: 'pulse-ring 2s ease-out infinite', width: 120, height: 120 }}
          aria-hidden
        />
        <div
          className="absolute rounded-full border border-neon-green/15"
          style={{ animation: 'pulse-ring 2s 0.4s ease-out infinite', width: 120, height: 120 }}
          aria-hidden
        />
        <div className="relative">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-gray-dim mb-2">
            Session
          </p>
          <p className="font-display text-6xl font-normal tracking-[.15em] text-cream text-glow-green">
            {code}
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-neon-green">
          En direct
        </span>
      </div>

      <h1 className="font-display text-2xl font-normal text-cream">
        En attente du DJ...
      </h1>
      <p className="mt-3 font-sans text-sm text-gray-mid">
        Le vote va bientot commencer.
      </p>

      {/* QR code + partage */}
      <div className="mt-10 flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-white p-3">
          <QRCode value={joinUrl} size={120} />
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-gray-mid transition-colors hover:border-cream/20 hover:text-cream"
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Lien copie
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 1H5a1 1 0 00-1 1v8a1 1 0 001 1h7a1 1 0 001-1V4L9 1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 1v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 4H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Inviter des amis
            </>
          )}
        </button>
      </div>

    </main>
  )
}
