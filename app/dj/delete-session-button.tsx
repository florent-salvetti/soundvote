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
    return <span className="text-xs text-zinc-500">Suppression...</span>
  }

  if (errorMsg) {
    return <span className="text-xs text-red-400">{errorMsg}</span>
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={handleCancel}
          className="text-xs text-zinc-500 transition-colors hover:text-white"
        >
          Annuler
        </button>
        <button
          onClick={handleConfirm}
          className="text-xs font-medium text-red-400 transition-colors hover:text-red-300"
        >
          Confirmer
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-zinc-600 transition-colors hover:text-red-400"
    >
      Supprimer
    </button>
  )
}
