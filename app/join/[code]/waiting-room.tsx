'use client'

import { useEffect, useState } from 'react'

const VOTER_ID_KEY = 'soundvote_voter_id'

// UUID v4 sans dependance externe
function generateVoterId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function WaitingRoom({
  code,
  sessionId,
}: {
  code: string
  sessionId: string
}) {
  const [voterId, setVoterId] = useState<string | null>(null)

  useEffect(() => {
    // Recupere ou cree l'identite anonyme du votant, une seule fois par navigateur
    let id = localStorage.getItem(VOTER_ID_KEY)
    if (!id) {
      id = generateVoterId()
      localStorage.setItem(VOTER_ID_KEY, id)
    }
    setVoterId(id)
  }, [])

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
