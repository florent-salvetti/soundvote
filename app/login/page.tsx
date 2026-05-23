import { login, signup } from '@/app/actions/auth'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="page-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-10 text-center">
          <h1 className="font-display text-5xl font-extrabold tracking-tight text-white text-glow-green">
            SoundVote
          </h1>
          <p className="mt-2 text-sm text-gray-mid">Espace DJ</p>
        </div>

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
    <div className="rounded-2xl border border-border bg-surface p-8">
      <form className="flex flex-col gap-5">

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium uppercase tracking-widest text-gray-mid">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="ton@email.com"
            className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-white placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium uppercase tracking-widest text-gray-mid">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            minLength={6}
            placeholder="••••••••"
            className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-white placeholder-gray-dim outline-none transition-colors focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/20"
          />
        </div>

        {errorMessage && (
          <p className="rounded-lg border border-neon-magenta/20 bg-neon-magenta/10 px-4 py-3 text-sm text-neon-magenta">
            {errorMessage}
          </p>
        )}

        <div className="mt-1 flex flex-col gap-3">
          <button
            formAction={login}
            className="rounded-lg bg-neon-green py-3 font-display text-sm font-bold tracking-wide text-bg transition-all hover:brightness-110 hover:glow-green"
          >
            Se connecter
          </button>
          <button
            formAction={signup}
            className="rounded-lg border border-border py-3 font-sans text-sm text-gray-hi transition-colors hover:border-neon-green/30 hover:text-white"
          >
            Creer un compte
          </button>
        </div>

      </form>
    </div>
  )
}
