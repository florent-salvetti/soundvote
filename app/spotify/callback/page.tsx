import { Suspense } from 'react'
import CallbackHandler from './callback-handler'

export default function SpotifyCallbackPage() {
  return (
    <main className="page-bg flex min-h-screen items-center justify-center">
      <Suspense
        fallback={
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-gray-mid">
            Connexion...
          </p>
        }
      >
        <CallbackHandler />
      </Suspense>
    </main>
  )
}
