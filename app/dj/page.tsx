import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { redirect } from 'next/navigation'

export default async function DjPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Garde cote serveur en complement du middleware
  if (!user) redirect('/login')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">Tableau de bord DJ</h1>
        <p className="mb-8 text-zinc-400">{user.email}</p>
        <form>
          <button
            formAction={logout}
            className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-400 hover:text-white"
          >
            Se deconnecter
          </button>
        </form>
      </div>
    </main>
  )
}
