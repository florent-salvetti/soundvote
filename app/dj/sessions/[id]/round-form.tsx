'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { searchTracks, getRecommendations, type MusicTrack } from '@/lib/music'

const OPTION_LETTERS    = ['A', 'B', 'C', 'D'] as const
const DEFAULT_QUESTION  = 'Quelle sera la prochaine chanson ?'

type TrackSlot = {
  label:    string
  artist:   string
  trackId:  string
  imageUrl: string
} | null

type Props = {
  launchRoundAction: (fd: FormData) => Promise<void>
  usedTrackNames?:   string[]
}

export default function RoundForm({ launchRoundAction, usedTrackNames = [] }: Props) {
  const [question,       setQuestion]       = useState(DEFAULT_QUESTION)
  const [editingQuestion, setEditingQuestion] = useState(false)
  const questionInputRef = useRef<HTMLInputElement>(null)

  // Focus programmatique — evite le autoFocus natif qui rejoue au retour sur l'onglet Android
  useEffect(() => {
    if (editingQuestion) questionInputRef.current?.focus()
  }, [editingQuestion])
  const [slots,       setSlots]       = useState<TrackSlot[]>([null, null, null, null])
  const [activeSlot,  setActiveSlot]  = useState<number | null>(null)
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<MusicTrack[]>([])
  const [showDrop,    setShowDrop]    = useState(false)
  const [loadingSlots, setLoadingSlots] = useState<boolean[]>([false, false, false, false])
  const [cachedRecs,  setCachedRecs]  = useState<MusicTrack[]>([])
  const [isPending,   startTransition] = useTransition()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef         = useRef<HTMLInputElement>(null)

  // Recos disponibles = celles qui ne sont pas deja dans un slot ni deja proposees
  function availableRecs(currentSlots: TrackSlot[], recs: MusicTrack[]): MusicTrack[] {
    return recs.filter(
      (r) =>
        !currentSlots.some((s) => s?.label === r.name) &&
        !usedTrackNames.includes(r.name.toLowerCase()),
    )
  }

  // Auto-focus + pre-charge les recos quand on ouvre un slot B/C/D
  useEffect(() => {
    if (activeSlot === null) return
    inputRef.current?.focus()
    if (activeSlot > 0 && cachedRecs.length > 0) {
      const avail = availableRecs(slots, cachedRecs)
      setResults(avail)
      setShowDrop(avail.length > 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot])

  // Debounce search — si query vide sur B/C/D, re-affiche les recos
  useEffect(() => {
    if (activeSlot === null) return
    if (!query.trim()) {
      if (activeSlot > 0 && cachedRecs.length > 0) {
        const avail = availableRecs(slots, cachedRecs)
        setResults(avail)
        setShowDrop(avail.length > 0)
      } else {
        setResults([])
        setShowDrop(false)
      }
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      const tracks = await searchTracks(query)
      setResults(tracks)
      setShowDrop(tracks.length > 0)
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeSlot])

  function trackToSlot(t: MusicTrack): TrackSlot {
    return { label: t.name, artist: t.artist, trackId: t.id, imageUrl: t.imageUrl }
  }

  async function handleSelectTrack(track: MusicTrack, idx: number) {
    const next = [...slots]
    next[idx] = trackToSlot(track)
    setSlots([...next])
    setQuery('')
    setShowDrop(false)
    setActiveSlot(null)

    // Slot A : vide B/C/D et charge les recos Last.fm
    if (idx === 0) {
      next[1] = null; next[2] = null; next[3] = null
      setSlots([...next])
      setCachedRecs([])
      setLoadingSlots([false, true, true, true])

      const recs = await getRecommendations(track.name, track.artist)
      const filtered = availableRecs(next, recs)
      setCachedRecs(filtered)

      const afterRecs = [...next]
      filtered.slice(0, 3).forEach((rec, i) => { afterRecs[i + 1] = trackToSlot(rec) })
      setSlots(afterRecs)
      setLoadingSlots([false, false, false, false])
    }
  }

  function clearSlot(idx: number) {
    const next = [...slots]
    next[idx] = null
    if (idx === 0) {
      next[1] = null; next[2] = null; next[3] = null
      setCachedRecs([])
    }
    setSlots(next)
  }

  function openSlot(idx: number) {
    setActiveSlot(idx)
    setQuery('')
    setResults([])
    setShowDrop(false)
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
      <div>
        {editingQuestion ? (
          <input
            ref={questionInputRef}
            name="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onBlur={() => {
              if (!question.trim()) setQuestion(DEFAULT_QUESTION)
              setEditingQuestion(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                if (!question.trim()) setQuestion(DEFAULT_QUESTION)
                setEditingQuestion(false)
              }
            }}
            className="h-12 w-full rounded-xl border border-neon-green/40 bg-surface-2 px-4 font-sans text-sm text-cream outline-none ring-1 ring-neon-green/20"
          />
        ) : (
          <>
            {/* input caché pour que le FormData contienne la valeur */}
            <input type="hidden" name="question" value={question} />
            <button
              type="button"
              onClick={() => setEditingQuestion(true)}
              className="group flex w-full items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-left transition-colors hover:border-neon-green/30"
            >
              <span className="font-sans text-sm text-cream">{question}</span>
              <svg
                width="15" height="15" viewBox="0 0 15 15" fill="none"
                className="shrink-0 text-gray-dim transition-colors group-hover:text-neon-green"
              >
                <path
                  d="M6.07 1.33a1 1 0 0 1 1.86 0l.32.9a5.5 5.5 0 0 1 1.06.61l.94-.2a1 1 0 0 1 1.08.57l.43.87a1 1 0 0 1-.28 1.22l-.73.56c.02.2.02.4 0 .6l.73.56a1 1 0 0 1 .28 1.22l-.43.87a1 1 0 0 1-1.08.57l-.94-.2a5.5 5.5 0 0 1-1.06.61l-.32.9a1 1 0 0 1-1.86 0l-.32-.9a5.5 5.5 0 0 1-1.06-.61l-.94.2a1 1 0 0 1-1.08-.57l-.43-.87a1 1 0 0 1 .28-1.22l.73-.56a5.5 5.5 0 0 1 0-.6l-.73-.56a1 1 0 0 1-.28-1.22l.43-.87a1 1 0 0 1 1.08-.57l.94.2a5.5 5.5 0 0 1 1.06-.61l.32-.9ZM7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2.5">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-dim">
          Options (2 minimum)
        </p>

        {OPTION_LETTERS.map((letter, idx) => {
          const slot       = slots[idx]
          const isActive   = activeSlot === idx
          const isLoading  = loadingSlots[idx]
          const hasRecs    = idx > 0 && cachedRecs.length > 0 && availableRecs(slots, cachedRecs).length > 0

          return (
            <div key={letter} className="relative flex items-start gap-3">

              {/* Badge lettre */}
              <span className={`mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold transition-colors ${slot ? 'border-neon-green/30 bg-neon-green/10 text-neon-green' : isActive ? 'border-neon-green/50 bg-neon-green/10 text-neon-green' : 'border-border bg-surface-2 text-gray-mid'}`}>
                {letter}
              </span>

              <div className="flex-1">
                {isLoading ? (
                  /* Chargement reco */
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-gray-dim">
                      Recommandation...
                    </span>
                  </div>
                ) : slot ? (
                  <TrackCard slot={slot} onClear={() => clearSlot(idx)} />
                ) : isActive ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setShowDrop(true)}
                    onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                    placeholder="Chercher un titre..."
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-neon-green/40 bg-surface-2 px-3 font-sans text-sm text-cream placeholder-gray-dim outline-none ring-1 ring-neon-green/20"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => openSlot(idx)}
                    className="flex h-11 w-full items-center rounded-xl border border-border bg-surface-2 px-3 text-left transition-colors hover:border-neon-green/30 hover:bg-surface"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-wider text-gray-dim">
                      {hasRecs ? 'Recos dispo — cliquer pour choisir' : 'Chercher un titre...'}
                    </span>
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {isActive && showDrop && results.length > 0 && (
                <div className="absolute left-10 right-0 top-12 z-20 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
                  {results.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      onMouseDown={() => handleSelectTrack(track, idx)}
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
          )
        })}
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
