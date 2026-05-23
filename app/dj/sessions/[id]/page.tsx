import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, code, status')
    .eq('id', id)
    .eq('dj_id', user.id)
    .single()

  if (!session) redirect('/dj')

  // Construction de l'URL de partage a partir des headers de la requete
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const joinUrl = `${protocol}://${host}/join/${session.code}`

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-md">

        <Link
          href="/dj"
          className="mb-10 inline-block text-sm text-zinc-500 transition-colors hover:text-white"
        >
          Retour au tableau de bord
        </Link>

        <div className="mb-10 rounded-2xl border border-zinc-800 p-8 text-center">
          <p className="mb-2 text-sm uppercase tracking-widest text-zinc-500">Code de la session</p>
          <p className="font-mono text-6xl font-bold tracking-widest">{session.code}</p>
        </div>

        <div className="mb-8 rounded-xl bg-zinc-900 px-5 py-4">
          <p className="mb-1 text-xs text-zinc-500">Lien a partager</p>
          <p className="break-all font-mono text-sm text-zinc-300">{joinUrl}</p>
        </div>

        <p className="text-center text-sm text-zinc-600">
          Les manches de vote arrivent dans la prochaine etape.
        </p>

      </div>
    </main>
  )
}
