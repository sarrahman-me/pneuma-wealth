/**
 * Klien database.
 *
 * Inisialisasi sengaja malas (lazy): Next.js mengevaluasi kode top-level saat
 * build, dan `neon()` melempar error kalau `DATABASE_URL` belum ada — itu akan
 * menggagalkan build pertama sebelum env vars terpasang.
 *
 * Jangan bungkus klien ini dengan `Proxy`; beberapa pustaka memeriksa properti
 * objek adapter dan Proxy akan memecahkannya secara diam-diam.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const createDb = () => {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL belum diset. Jalankan `vercel env pull .env.local`.')
  }
  return drizzle(neon(url), { schema })
}

let cached: ReturnType<typeof createDb> | null = null

export const getDb = () => {
  if (!cached) {
    cached = createDb()
  }
  return cached
}

export { schema }
