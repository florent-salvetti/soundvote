'use client'

import { useState, useTransition } from 'react'
import { deleteSession } from '@/app/actions/session'

export default function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    setConfirming(true)
    setErrorMsg(null)
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault()
    setConfirming(false)
  }

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await deleteSession(sessionId)
      if (result.error) {
        setErrorMsg(result.error)
        setConfirming(false)
      }
    })
  }

  if (isPending) {
    return <span className="text-xs italic text-gray-mid">Suppression...</span>
  }

  if (errorMsg) {
    return <span className="text-xs text-neon-magenta">{errorMsg}</span>
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={handleCancel}
          className="text-xs text-gray-mid transition-colors hover:text-white"
        >
          Annuler
        </button>
        <button
          onClick={handleConfirm}
          className="text-xs font-semibold text-neon-magenta transition-all hover:glow-magenta"
        >
          Confirmer
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-gray-dim transition-colors hover:text-neon-magenta"
    >
      Supprimer
    </button>
  )
}
