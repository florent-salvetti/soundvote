import { login, signup } from '@/app/actions/auth'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="page-bg flex min-h-screen flex-col px-6 py-10">

      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#f3ecdc" />
          <circle cx="12" cy="12" r="3" fill="#0c0a14" />
          <path d="M21 5.5C18.3 3 15.3 1.5 12 1.5" stroke="#0c0a14" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span className="font-display text-lg font-medium italic tracking-tight text-cream">
          soundvote
        </span>
      </div>

      {/* Hero */}
      <div className="mt-12">
        <p className="font-mono text-xs tracking-[0.2em] text-neon-green uppercase">
          Pour les DJ qui laissent la piste choisir
        </p>
        <h1 className="mt-4 font-display text-5xl font-normal leading-[0.92] tracking-tight text-cream">
          La salle<br />
          <span className="italic text-neon-green">décide</span>.<br />
          Tu mixes.
        </h1>
      </div>

      <LoginForm searchParams={searchParams} />

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
    <form className="mt-10 flex flex-col gap-4">

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-mid">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="toi@dj.fm"
          className="h-14 rounded-xl border border-border bg-surface-2 px-4 font-sans text-base text-cream placeholder-gray-dim outline-none transition-colors focus:border-neon-green/40 focus:ring-1 focus:ring-neon-green/15"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="font-mono text-[10px] tracking-[0.18em] uppercase text-gray-mid">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          minLength={6}
          placeholder="••••••••••"
          className="h-14 rounded-xl border border-border bg-surface-2 px-4 font-sans text-base text-cream placeholder-gray-dim outline-none transition-colors focus:border-neon-green/40 focus:ring-1 focus:ring-neon-green/15"
        />
      </div>

      {errorMessage && (
        <p className="rounded-xl border border-neon-magenta/20 bg-neon-magenta/8 px-4 py-3 text-sm text-neon-magenta">
          {errorMessage}
        </p>
      )}

      <div className="mt-2 flex flex-col gap-3">
        <button
          formAction={login}
          className="flex h-14 items-center justify-center gap-2.5 rounded-xl bg-neon-green font-sans text-base font-semibold text-bg shadow-lg shadow-neon-green/20 transition-all hover:brightness-110"
        >
          Ouvrir la console
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 9h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          formAction={signup}
          className="h-12 rounded-xl border border-border font-sans text-sm text-gray-mid transition-colors hover:border-cream/20 hover:text-cream"
        >
          Créer un compte
        </button>
      </div>

    </form>
  )
}
