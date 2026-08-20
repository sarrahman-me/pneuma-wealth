import Link from 'next/link'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import TransactionRow, { type TransactionView } from '../components/TransactionRow'
import { getDb } from '@/lib/db'
import { categories, transactions } from '@/lib/db/schema'
import { addDays } from '@/lib/core/money'
import { todayIn } from '@/lib/core/timezone'
import { formatRupiah } from '@/lib/core/format'
import { getCurrentUser, listCategories } from '@/lib/server/user'

export const dynamic = 'force-dynamic'

const RANGES = [
  { key: '7', label: '7 hari' },
  { key: '30', label: '30 hari' },
  { key: '90', label: '90 hari' },
] as const

type SearchParams = Promise<{ range?: string; kind?: string }>

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getCurrentUser()
  if (!user) {
    return (
      <main>
        <h1>Riwayat</h1>
        <p>
          <Link href="/sign-in">Masuk</Link> untuk melihat riwayat.
        </p>
      </main>
    )
  }

  const params = await searchParams
  const range = RANGES.find((option) => option.key === params.range) ?? RANGES[1]
  const kindFilter = params.kind === 'IN' || params.kind === 'OUT' ? params.kind : null

  const today = todayIn(user.timezone)
  const start = addDays(today, -(Number(range.key) - 1))

  const rows: TransactionView[] = await getDb()
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      dateLocal: transactions.dateLocal,
      description: transactions.description,
      source: transactions.source,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, user.id),
        gte(transactions.dateLocal, start),
        lte(transactions.dateLocal, today),
        kindFilter ? eq(transactions.kind, kindFilter) : undefined,
      ),
    )
    .orderBy(desc(transactions.dateLocal), desc(transactions.createdAt))
    .limit(200)

  const categoryOptions = (await listCategories(user.id)).map((category) => ({
    id: category.id,
    name: category.name,
  }))

  const totalIn = rows
    .filter((row) => row.kind === 'IN')
    .reduce((sum, row) => sum + row.amount, 0)
  const totalOut = rows
    .filter((row) => row.kind === 'OUT')
    .reduce((sum, row) => sum + row.amount, 0)

  const href = (next: { range?: string; kind?: string }) => {
    const query = new URLSearchParams()
    query.set('range', next.range ?? range.key)
    const kind = next.kind ?? kindFilter ?? ''
    if (kind) query.set('kind', kind)
    return `/history?${query.toString()}`
  }

  return (
    <main>
      <h1>Riwayat</h1>

      <div className="history-toolbar">
        <div className="filter-row">
          {RANGES.map((option) => (
            <Link
              key={option.key}
              href={href({ range: option.key })}
              className={option.key === range.key ? 'pill pill-out' : 'pill pill-muted'}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <div className="filter-row">
          <Link
            href={href({ kind: '' })}
            className={kindFilter === null ? 'pill pill-out' : 'pill pill-muted'}
          >
            Semua
          </Link>
          <Link
            href={href({ kind: 'OUT' })}
            className={kindFilter === 'OUT' ? 'pill pill-out' : 'pill pill-muted'}
          >
            Uang keluar
          </Link>
          <Link
            href={href({ kind: 'IN' })}
            className={kindFilter === 'IN' ? 'pill pill-in' : 'pill pill-muted'}
          >
            Uang masuk
          </Link>
        </div>
      </div>

      <p className="helper-text">
        Masuk {formatRupiah(totalIn)} · Keluar {formatRupiah(totalOut)} · {rows.length} catatan
      </p>

      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">Belum ada catatan di rentang ini.</p>
          <p className="empty-desc">Coba pilih rentang waktu yang lebih panjang.</p>
        </div>
      ) : (
        <ul className="tx-list">
          {rows.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              categories={categoryOptions}
              showDate
            />
          ))}
        </ul>
      )}

      {rows.length === 200 ? (
        <p className="history-footer">Menampilkan 200 catatan terbaru.</p>
      ) : null}
    </main>
  )
}
