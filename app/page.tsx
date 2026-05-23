import { redirect } from 'next/navigation'

// Le proxy.ts intercepte / avant ce composant.
// Ce redirect ne s'execute qu'en cas de contournement du proxy (tests unitaires, etc.).
export default function Home() {
  redirect('/login')
}
