import { login, signup } from '@/app/actions/auth'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-white">SoundVote</h1>

        <LoginForm searchParams={searchParams} />
      </div>
    </main>
  )
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorMessage = params?.error

  return (
    <form className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-zinc-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-zinc-400 focus:outline-none"
          placeholder="ton@email.com"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-zinc-400">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          minLength={6}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-zinc-400 focus:outline-none"
          placeholder="••••••••"
        />
      </div>

      {errorMessage && (
        <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-400">
          {errorMessage}
        </p>
      )}

      <div className="mt-2 flex flex-col gap-3">
        <button
          formAction={login}
          className="rounded-lg bg-white px-4 py-3 font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          Se connecter
        </button>
        <button
          formAction={signup}
          className="rounded-lg border border-zinc-700 px-4 py-3 font-semibold text-white transition-colors hover:border-zinc-400"
        >
          Creer un compte
        </button>
      </div>
    </form>
  )
}
