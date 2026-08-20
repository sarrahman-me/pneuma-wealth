import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const authConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
)

/**
 * Middleware hanya memasang konteks sesi Clerk. Penjagaan akses dilakukan di
 * setiap halaman dan server action lewat `getCurrentUser`/`requireCurrentUser`
 * — pengecekan berbasis pencocokan path gampang meleset dari cara Next.js
 * benar-benar merutekan permintaan.
 *
 * Tanpa kunci Clerk, middleware dilewati supaya pengembangan lokal tetap jalan;
 * `lib/server/auth.ts` yang menolak kondisi itu di produksi.
 */
export default authConfigured ? clerkMiddleware() : () => NextResponse.next()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)',
    '/(api|trpc)(.*)',
  ],
}
