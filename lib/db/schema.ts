/**
 * Skema PNEUMA.
 *
 * Semua nilai uang disimpan sebagai bilangan bulat rupiah (`bigint`, dibaca
 * sebagai number). Tidak ada tipe pecahan di mana pun.
 *
 * Semua tabel milik pengguna dikunci ke `user_id` sejak awal, walaupun untuk
 * sekarang hanya ada satu pengguna — supaya tidak perlu migrasi menyakitkan
 * kalau nanti dipakai berdua atau dibagikan.
 */

import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const transactionKind = pgEnum('transaction_kind', ['IN', 'OUT'])
export const transactionSource = pgEnum('transaction_source', ['manual', 'fixed_cost'])
export const accountKind = pgEnum('account_kind', ['spendable', 'savings'])
/** Kebutuhan vs keinginan — inilah yang membuat coaching bisa menjelaskan "kenapa boros". */
export const categoryNature = pgEnum('category_nature', ['essential', 'discretionary'])
export const recurrence = pgEnum('recurrence', ['daily', 'weekly', 'monthly', 'yearly'])
export const coachMode = pgEnum('coach_mode', ['calm', 'watchful', 'tight'])
export const wishStatus = pgEnum('wish_status', ['waiting', 'bought', 'released'])

const money = (name: string) => bigint(name, { mode: 'number' })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  /** ID pengguna di penyedia auth (Clerk). Null hanya untuk pengguna dev lokal. */
  externalId: text('external_id').unique(),
  name: text('name'),
  /** Zona waktu IANA milik pengguna. Semua `date_local` dihitung terhadap ini. */
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Biaya bertahan hidup per hari — untuk penyangga dan runway, bukan jatah belanja. */
  dailyLivingCost: money('daily_living_cost').notNull().default(0),
  bufferDays: integer('buffer_days').notNull().default(30),
  /** Persen uang tersedia yang mengisi penyangga selama penyangga belum penuh. */
  bufferFillPercent: integer('buffer_fill_percent').notNull().default(55),
  allowanceHorizonDays: integer('allowance_horizon_days').notNull().default(30),
  allowanceMin: money('allowance_min').notNull().default(0),
  allowanceMax: money('allowance_max').notNull().default(500000),
  obligationHorizonDays: integer('obligation_horizon_days').notNull().default(30),
  /** Onboarding belum selesai selama biaya hidup harian belum diisi. */
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Hanya akun `spendable` yang masuk hitungan saldo likuid. */
    kind: accountKind('kind').notNull().default('spendable'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_user_idx').on(table.userId),
    // Tanpa ini, bootstrap yang berjalan balapan membuat akun ganda.
    unique('accounts_user_name_unique').on(table.userId, table.name),
  ],
)

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nature: categoryNature('nature').notNull().default('discretionary'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [unique('categories_user_name_unique').on(table.userId, table.name)],
)

export const fixedCosts = pgTable(
  'fixed_costs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    amount: money('amount').notNull(),
    /**
     * Dibaca menurut `recurrence`: diabaikan untuk harian, hari dalam pekan
     * (1–7, 1 = Senin) untuk mingguan, tanggal (1–31) untuk bulanan dan tahunan.
     */
    dueDay: integer('due_day').notNull().default(1),
    /** Bulan jatuh tempo (1–12). Hanya bermakna untuk siklus tahunan. */
    dueMonth: integer('due_month').notNull().default(1),
    recurrence: recurrence('recurrence').notNull().default('monthly'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('fixed_costs_user_idx').on(table.userId)],
)

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    kind: transactionKind('kind').notNull(),
    amount: money('amount').notNull(),
    /** Tanggal menurut zona waktu pengguna, bukan zona waktu server. */
    dateLocal: date('date_local').notNull(),
    description: text('description'),
    source: transactionSource('source').notNull().default('manual'),
    fixedCostId: uuid('fixed_cost_id').references(() => fixedCosts.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('transactions_user_date_idx').on(table.userId, table.dateLocal),
    index('transactions_account_idx').on(table.accountId),
  ],
)

export const fixedCostPayments = pgTable(
  'fixed_cost_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fixedCostId: uuid('fixed_cost_id')
      .notNull()
      .references(() => fixedCosts.id, { onDelete: 'cascade' }),
    /**
     * Kunci periode, bentuknya mengikuti siklus biaya tetapnya: `YYYY-MM-DD`
     * harian, `YYYY-Www` mingguan, `YYYY-MM` bulanan, `YYYY` tahunan.
     */
    period: text('period').notNull(),
    paidDateLocal: date('paid_date_local'),
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('fixed_cost_payments_period_unique').on(table.fixedCostId, table.period),
  ],
)

/**
 * Jatah harian dikunci di sini, bukan dihitung ulang tiap request.
 * Baris terbaru per pengguna adalah anchor yang sedang berlaku.
 */
export const allowanceAnchors = pgTable(
  'allowance_anchors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    anchoredOn: date('anchored_on').notNull(),
    baseAllowance: money('base_allowance').notNull(),
    flexibleAtAnchor: money('flexible_at_anchor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('allowance_anchors_user_date_unique').on(table.userId, table.anchoredOn),
  ],
)

/**
 * Rekap harian yang sudah ditutup. Menyimpan ini membuat carry-over
 * deterministik dan bisa diaudit, bukan hasil hitung ulang yang bisa berubah
 * kalau transaksi lama diedit.
 */
export const dailyLedger = pgTable(
  'daily_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dateLocal: date('date_local').notNull(),
    baseAllowance: money('base_allowance').notNull(),
    carry: money('carry').notNull().default(0),
    spent: money('spent').notNull().default(0),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [unique('daily_ledger_user_date_unique').on(table.userId, table.dateLocal)],
)

export const coachingMemory = pgTable(
  'coaching_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dateLocal: date('date_local').notNull(),
    mode: coachMode('mode').notNull(),
    headline: text('headline').notNull(),
    ruleId: text('rule_id').notNull(),
    context: jsonb('context'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('coaching_memory_user_date_idx').on(table.userId, table.dateLocal)],
)


/**
 * Keinginan yang sedang ditahan.
 *
 * Dicatat sebelum uangnya keluar, lalu ditahan sampai `ready_on`. Ini satu-
 * satunya tempat aplikasi ikut campur sebelum pembelian terjadi; sisanya hanya
 * mencatat yang sudah lewat.
 */
export const wishItems = pgTable(
  'wish_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    amount: money('amount').notNull(),
    createdOn: date('created_on').notNull(),
    /** Tanggal paling awal keinginan ini boleh diputuskan. */
    readyOn: date('ready_on').notNull(),
    status: wishStatus('status').notNull().default('waiting'),
    note: text('note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** Transaksi yang lahir kalau keinginan ini jadi dibeli. */
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('wish_items_user_status_idx').on(table.userId, table.status)],
)

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(settings, { fields: [users.id], references: [settings.userId] }),
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  fixedCosts: many(fixedCosts),
  wishItems: many(wishItems),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  fixedCost: one(fixedCosts, {
    fields: [transactions.fixedCostId],
    references: [fixedCosts.id],
  }),
}))

export const fixedCostsRelations = relations(fixedCosts, ({ one, many }) => ({
  user: one(users, { fields: [fixedCosts.userId], references: [users.id] }),
  payments: many(fixedCostPayments),
}))

export const fixedCostPaymentsRelations = relations(fixedCostPayments, ({ one }) => ({
  fixedCost: one(fixedCosts, {
    fields: [fixedCostPayments.fixedCostId],
    references: [fixedCosts.id],
  }),
  transaction: one(transactions, {
    fields: [fixedCostPayments.transactionId],
    references: [transactions.id],
  }),
}))

export const wishItemsRelations = relations(wishItems, ({ one }) => ({
  user: one(users, { fields: [wishItems.userId], references: [users.id] }),
  transaction: one(transactions, {
    fields: [wishItems.transactionId],
    references: [transactions.id],
  }),
}))
