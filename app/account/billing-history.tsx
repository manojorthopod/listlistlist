import type { TopupPurchase } from '@/types'

interface Props {
  purchases: TopupPurchase[]
}

const PACK_LABELS: Record<string, string> = {
  starter_pack: 'Starter pack (100 credits)',
  growth_pack:  'Growth pack (300 credits)',
  scale_pack:   'Scale pack (700 credits)',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  })
}

function formatGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export function BillingHistory({ purchases }: Props) {
  if (purchases.length === 0) {
    return (
      <p className="text-sm text-text-disabled py-4 text-center">
        No credit purchases yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs uppercase tracking-widest text-text-secondary pb-2 pr-4 font-medium">
              Date
            </th>
            <th className="text-left text-xs uppercase tracking-widest text-text-secondary pb-2 pr-4 font-medium">
              Pack
            </th>
            <th className="text-right text-xs uppercase tracking-widest text-text-secondary pb-2 font-medium">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id} className="border-b border-border/50 last:border-0">
              <td className="py-3 pr-4 text-text-secondary text-xs font-mono whitespace-nowrap">
                {formatDate(p.created_at)}
              </td>
              <td className="py-3 pr-4 text-text-primary">
                {PACK_LABELS[p.pack_name] ?? p.pack_name}
              </td>
              <td className="py-3 text-right font-mono text-text-primary whitespace-nowrap">
                {formatGbp(p.amount_paid)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
