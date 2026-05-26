'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { searchTracks, getRecommendations, type MusicTrack } from '@/lib/music'

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

type TrackSlot = {
  label:    string
  artist:   string
  trackId:  string
  imageUrl: string
} | null

type Props = {
  launchRoundAction: (fd: FormData) => Promise<void>
}

export default function RoundForm({ launchRoundAction }: Props) {
  const [question,    setQuestion]    = useState('')
  const [slots,       setSlots]       = useState<TrackSlot[]>([null, null, null, null])
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<MusicTrack[]>([])
  const [showDrop,    setShowDrop]    = useState(false)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [isPending,   startTransition] = useTransition()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search sur le champ A
  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowDrop(false); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const tracks = await searchTracks(query)
      setResults(tracks)
      setShowDrop(tracks.length > 0)
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query])

  function trackToSlot(t: MusicTrack): TrackSlot {
    return { label: t.name, artist: t.artist, trackId: t.id, imageUrl: t.imageUrl }
  }

  async function handleSelectTrack(track: MusicTrack) {
    const next = [...slots]
    next[0] = trackToSlot(track)
    next[1] = null; next[2] = null; next[3] = null
    setSlots([...next])
    setQuery('')
    setShowDrop(false)

    setLoadingRecs(true)
    const recs = await getRecommendations(track.name, track.artist)
    recs.slice(0, 3).forEach((rec, i) => { next[i + 1] = trackToSlot(rec) })
    setSlots([...next])
    setLoadingRecs(false)
  }

  function clearSlot(idx: number) {
    const next = [...slots]
    next[idx] = null
    if (idx === 0) { next[1] = null; next[2] = null; next[3] = null }
    setSlots(next)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    slots.forEach((slot, i) => {
      if (!slot) return
      fd.set(`option_label_${i + 1}`,      slot.label)
      fd.set(`option_artist_${i + 1}`,     slot.artist)
      fd.set(`spotify_track_id_${i + 1}`,  slot.trackId)
      fd.set(`spotify_image_url_${i + 1}`, slot.imageUrl)
    })
    startTransition(async () => { await launchRoundAction(fd) })
  }

  const filledCount = slots.filter(Boolean).length

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Question */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
          Question
        </label>
        <input
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Quelle sera la prochaine chanson ?"
          className="h-12 rounded-xl border border-border bg-surface-2 px-4 font-sans text-sm text-cream placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
        />
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2.5">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
          Options (2 minimum)
        </p>

        {/* Slot A — recherche */}
        <div className="relative">
          <div className="flex items-start gap-3">
            <BadgeA filled={!!slots[0]} />
            <div className="flex-1">
              {slots[0] ? (
                <TrackCard slot={slots[0]} onClear={() => clearSlot(0)} />
              ) : (
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => results.length > 0 && setShowDrop(true)}
                  onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                  placeholder="Chercher un titre..."
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 font-sans text-sm text-cream placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
                />
              )}
            </div>
          </div>
          {showDrop && results.length > 0 && (
            <div className="absolute left-10 right-0 top-12 z-20 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
              {results.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onMouseDown={() => handleSelectTrack(track)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <TrackThumb track={track} />
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-semibold text-cream">{track.name}</p>
                    <p className="truncate font-mono text-[10px] text-gray-dim">{track.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Slots B/C/D — recommandations Last.fm */}
        {loadingRecs ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-4">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-dim">
              Recommandations...
            </span>
          </div>
        ) : (
          (['B', 'C', 'D'] as const).map((letter, i) => (
            <div key={letter} className="flex items-start gap-3">
              <span className={`mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold ${slots[i + 1] ? 'border-neon-green/30 bg-neon-green/10 text-neon-green' : 'border-border bg-surface-2 text-gray-dim'}`}>
                {letter}
              </span>
              <div className="flex-1">
                {slots[i + 1] ? (
                  <TrackCard slot={slots[i + 1]!} onClear={() => clearSlot(i + 1)} />
                ) : (
                  <div className="flex h-11 items-center rounded-xl border border-border bg-surface-2 px-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-gray-dim">
                      {slots[0] ? 'Aucune reco trouvee' : 'Choisir A en premier'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || filledCount < 2}
        className="flex h-14 items-center justify-center gap-2.5 rounded-xl bg-neon-green font-sans text-base font-semibold text-bg shadow-lg shadow-neon-green/20 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Lancement...' : 'Lancer le vote'}
        {!isPending && (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 9h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </form>
  )
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function BadgeA({ filled }: { filled: boolean }) {
  return (
    <span className={`mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold ${filled ? 'border-neon-green/30 bg-neon-green/10 text-neon-green' : 'border-border bg-surface-2 text-gray-mid'}`}>
      A
    </span>
  )
}

function TrackThumb({ track }: { track: MusicTrack }) {
  if (!track.imageUrl) return <div className="h-9 w-9 shrink-0 rounded-md bg-surface-2" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={track.imageUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-md object-cover" />
}

function TrackCard({ slot, onClear }: { slot: NonNullable<TrackSlot>; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neon-green/20 bg-neon-green/5 px-3 py-2.5">
      {slot.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slot.imageUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-md object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-sm font-semibold text-cream">{slot.label}</p>
        <p className="truncate font-mono text-[10px] text-gray-dim">{slot.artist}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Retirer"
        className="shrink-0 text-gray-dim transition-colors hover:text-neon-magenta"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
