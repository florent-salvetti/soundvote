export type ResultRow = {
  option_id: string
  label: string
  artist: string | null
  total: number
}

export function computeWinner(results: ResultRow[]): {
  type: 'none' | 'single' | 'tie'
  winners: ResultRow[]
} {
  const grandTotal = results.reduce((sum, r) => sum + r.total, 0)
  if (grandTotal === 0) return { type: 'none', winners: [] }

  const maxVotes = Math.max(...results.map((r) => r.total))
  const winners = results.filter((r) => r.total === maxVotes)

  return {
    type: winners.length > 1 ? 'tie' : 'single',
    winners,
  }
}
