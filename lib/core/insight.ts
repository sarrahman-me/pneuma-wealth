/**
 * Mesin coaching.
 *
 * Aturan dievaluasi dalam urutan prioritas tetap, dan yang pertama cocok
 * menang — jadi keluarannya tidak pernah bertentangan dengan dirinya sendiri.
 *
 * Fungsi ini murni: tidak menyentuh database dan tidak punya efek samping.
 * Versi desktop menulis "memory" tepat saat insight dibaca, yang berarti
 * sekadar me-refresh halaman mencemari riwayat. Di sini pencatatan memory
 * adalah langkah terpisah yang dipanggil secara sadar oleh pemanggil.
 */

import { formatMultiplier, formatRupiah } from './format'
import { isBurningTooFast } from './pace'
import type {
  CoachingInsight,
  InsightInput,
  MemoryEntry,
  TimeBucket,
  Tone,
} from './insight-types'

/** Runway di bawah ini dianggap genting. */
export const RUNWAY_CRITICAL_DAYS = 7

/** Biaya tetap dianggap mendesak bila jatuh tempo dalam rentang ini. */
export const DUE_SOON_DAYS = 7

/** Sudah memakai porsi ini dari jatah hari ini berarti sudah dekat batas. */
export const NEAR_LIMIT_RATIO = 0.8

/** Tidak ada pemasukan selama ini, untuk pemasukan tak menentu, layak disebut. */
export const INCOME_DROUGHT_DAYS = 21

/** Di atas porsi ini, pengeluaran didominasi keinginan, bukan kebutuhan. */
export const DISCRETIONARY_HEAVY_RATIO = 0.6

export const timeBucketOf = (hour: number): TimeBucket => {
  if (hour >= 5 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 15) return 'midday'
  if (hour >= 15 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

const noTxNextStep = (bucket: TimeBucket): string => {
  switch (bucket) {
    case 'morning':
      return 'Langkah kecil: catat pengeluaran pertama begitu terjadi.'
    case 'midday':
    case 'afternoon':
      return 'Langkah kecil: catat satu pengeluaran siang ini, walau kecil.'
    case 'evening':
      return 'Langkah kecil: ingat-ingat hari ini, catat yang sempat terlewat.'
    case 'night':
      return 'Kalau hari ini memang tidak ada pengeluaran, biarkan kosong — itu juga catatan.'
  }
}

/**
 * Kalimat penyambung dari hari sebelumnya. Hanya muncul kalau ada perubahan
 * nyata yang layak diakui — bukan basa-basi setiap hari.
 */
export const buildContinuityLine = (
  lastMemory: MemoryEntry | null,
  today: string,
  tone: Tone,
  bucket: TimeBucket,
): string | null => {
  if (lastMemory && lastMemory.dateLocal !== today) {
    if (lastMemory.mode !== 'calm' && tone === 'calm') {
      return 'Kemarin sempat ketat, hari ini kita mulai lagi pelan-pelan.'
    }
    if (lastMemory.mode === 'calm' && tone === 'alert') {
      return 'Hari ini lebih ketat dari kemarin. Kita jaga pelan-pelan.'
    }
    return `Catatan terakhir: ${lastMemory.headline}`
  }

  if (!lastMemory) {
    return bucket === 'night'
      ? 'Hari ini hampir selesai, besok kita mulai lagi.'
      : 'Hari ini kita mulai pelan-pelan.'
  }

  return null
}

type Rule = {
  id: string
  when: (input: InsightInput) => boolean
  build: (input: InsightInput) => Omit<CoachingInsight, 'ruleId' | 'mode' | 'continuityLine'>
}

/**
 * Urutan array ini ADALAH prioritasnya. Yang paling mendesak dan paling
 * membatasi pilihan pengguna ada di atas.
 */
const RULES: Rule[] = [
  {
    id: 'onboarding_incomplete',
    when: ({ settings }) => settings.dailyLivingCost <= 0,
    build: () => ({
      statusTitle: 'Aplikasi belum tahu biaya hidup harianmu.',
      bullets: [
        'Tanpa angka ini, dana penyangga dan runway tidak bisa dihitung.',
        'Perkiraan kasar sudah cukup — bisa diubah kapan saja.',
      ],
      nextStep: 'Isi biaya hidup harian di halaman Aturan.',
      tone: 'calm',
      keyNumbers: [],
    }),
  },
  {
    id: 'onboarding_few_tx',
    when: ({ stats }) => stats.txCountTotal < 5,
    build: ({ stats, allowance }) => ({
      statusTitle: `Baru ${stats.txCountTotal} transaksi, pelan-pelan bangun ritme.`,
      bullets: [
        `Total catatan saat ini ${stats.txCountTotal} transaksi.`,
        `Jatah hari ini ${formatRupiah(allowance.allowed)}.`,
      ],
      nextStep: 'Langkah kecil: catat 1 transaksi hari ini agar ritme terasa.',
      tone: 'calm',
      keyNumbers: [stats.txCountTotal, allowance.allowed],
    }),
  },
  {
    id: 'fresh_income',
    when: ({ stats }) => stats.incomeToday > 0,
    // Kartu ritual di atas sudah menyebutkan jumlah dan pembagiannya, jadi di
    // sini sengaja tidak diulang. Yang tersisa untuk dikatakan adalah apa yang
    // biasanya terjadi setelah hari ini.
    build: ({ stats, funds, allowance, cadence }) => ({
      statusTitle: 'Minggu pertama yang menentukan sisa siklus.',
      bullets: [
        cadence.typicalGap !== null
          ? `Uang ini harus bertahan sekitar ${cadence.typicalGap} hari, sampai pemasukan berikutnya.`
          : 'Belum cukup data untuk menebak kapan pemasukan berikutnya datang.',
        `Uang tersedia ${formatRupiah(funds.available)} setelah tagihan disisihkan.`,
      ],
      nextStep: `Hari ini cukup ${formatRupiah(allowance.allowed)} — sama seperti hari-hari berikutnya.`,
      tone: 'calm',
      keyNumbers: [stats.incomeToday, funds.available, allowance.allowed],
    }),
  },
  {
    id: 'runway_critical',
    when: ({ funds }) => funds.runwayDays !== null && funds.runwayDays <= RUNWAY_CRITICAL_DAYS,
    build: ({ funds }) => ({
      statusTitle: `Runway tinggal ${funds.runwayDays} hari.`,
      bullets: [
        `Uang tersedia ${formatRupiah(funds.available)} setelah semua tagihan terjadwal.`,
        'Ini kondisi yang butuh pemasukan, bukan sekadar hemat.',
      ],
      nextStep: 'Prioritaskan kebutuhan inti hari ini, dan kejar satu sumber pemasukan.',
      tone: 'alert',
      keyNumbers: [funds.runwayDays ?? 0, funds.available],
    }),
  },
  {
    id: 'burning_too_fast',
    when: ({ pace }) => isBurningTooFast(pace),
    build: ({ pace, allowance }) => ({
      statusTitle: `Laju belanjamu ${formatMultiplier(pace.paceRatio ?? 1)} lebih cepat dari rencana.`,
      bullets: [
        `${pace.daysElapsed} hari sejak pemasukan terakhir, terpakai ${formatRupiah(pace.spentSinceIncome)} dari rencana ${formatRupiah(pace.plannedSoFar ?? 0)}.`,
        pace.shortfallDays !== null && pace.shortfallDays > 0
          ? `Dengan laju ini uang habis ${pace.daysUntilEmpty} hari lagi — sekitar ${pace.shortfallDays} hari sebelum pemasukan berikutnya biasanya datang.`
          : pace.daysUntilEmpty !== null
            ? `Dengan laju ini uang habis ${pace.daysUntilEmpty} hari lagi.`
            : 'Laju ini belum bisa diproyeksikan ke depan.',
      ],
      nextStep: `Kembali ke ${formatRupiah(allowance.allowed)} per hari mulai sekarang, sebelum sisa siklus yang menanggungnya.`,
      tone: 'alert',
      keyNumbers: [pace.spentSinceIncome, pace.plannedSoFar ?? 0, pace.daysUntilEmpty ?? 0],
    }),
  },
  {
    id: 'overspent_today',
    when: ({ allowance }) => allowance.allowed > 0 && allowance.overspent,
    build: ({ allowance, funds }) => ({
      statusTitle: `Hari ini melewati jatah ${formatRupiah(allowance.allowed)}.`,
      bullets: [
        `Terpakai ${formatRupiah(allowance.spent)} hari ini.`,
        `Kelebihan ${formatRupiah(-allowance.remaining)} akan mengurangi jatah besok.`,
      ],
      nextStep:
        funds.mode === 'calm'
          ? 'Tahan belanja tambahan sampai besok; penyanggamu masih aman.'
          : 'Hentikan pengeluaran tambahan sampai besok.',
      tone: 'alert',
      keyNumbers: [allowance.spent, allowance.allowed, allowance.remaining],
    }),
  },
  {
    id: 'wish_ready',
    when: ({ stats }) => stats.wishReadyCount > 0,
    build: ({ stats }) => ({
      statusTitle: `${stats.wishReadyCount} keinginan sudah lewat masa tunggu.`,
      bullets: [
        `Total yang sedang ditahan ${formatRupiah(stats.wishWaitingAmount)}.`,
        'Kalau masih ingin setelah menunggu, itu bukan dorongan sesaat.',
      ],
      nextStep: 'Putuskan di halaman Keinginan: beli, atau lepaskan.',
      tone: 'calm',
      keyNumbers: [stats.wishReadyCount, stats.wishWaitingAmount],
    }),
  },
  {
    id: 'fixed_cost_due_soon',
    when: ({ stats }) =>
      stats.unpaidFixedCostCount > 0 &&
      stats.daysToNextDue !== null &&
      stats.daysToNextDue <= DUE_SOON_DAYS,
    build: ({ stats, funds }) => ({
      statusTitle:
        stats.daysToNextDue === 0
          ? 'Ada biaya tetap jatuh tempo hari ini.'
          : `Biaya tetap jatuh tempo ${stats.daysToNextDue} hari lagi.`,
      bullets: [
        `${stats.unpaidFixedCostCount} tagihan belum lunas, total ${formatRupiah(stats.unpaidFixedCostAmount)}.`,
        'Uangnya sudah disisihkan, jadi jatah harianmu tidak terpengaruh.',
      ],
      nextStep: 'Bayar yang paling dekat jatuh tempo, lalu tandai lunas di sini.',
      tone: funds.available < stats.unpaidFixedCostAmount ? 'alert' : 'calm',
      keyNumbers: [stats.daysToNextDue ?? 0, stats.unpaidFixedCostAmount],
    }),
  },
  {
    id: 'buffer_low',
    when: ({ funds }) => funds.mode === 'tight',
    build: ({ funds, allowance, settings }) => ({
      statusTitle: `Penyangga baru terisi ${Math.round((funds.bufferRatio ?? 0) * 100)}%.`,
      bullets: [
        `Terkumpul ${formatRupiah(funds.bufferBalance)} dari target ${formatRupiah(funds.bufferTarget)}.`,
        // Penyangga tidak lagi jadi gerbang, jadi katakan apa adanya: jatah
        // tetap ada, hanya lebih kecil selama penyangga masih diisi.
        `${settings.bufferFillPercent}% dari uangmu sedang mengisi penyangga, sisanya jadi jatah harian.`,
      ],
      nextStep: `Jaga pengeluaran hari ini di bawah ${formatRupiah(allowance.allowed)}.`,
      tone: 'alert',
      keyNumbers: [funds.bufferBalance, funds.bufferTarget, funds.runwayDays ?? 0],
    }),
  },
  {
    id: 'no_tx_today',
    when: ({ stats }) => stats.txCountToday === 0,
    build: ({ allowance, timeBucket }) => ({
      statusTitle: 'Belum ada catatan hari ini.',
      bullets: [
        `Jatah hari ini ${formatRupiah(allowance.allowed)}.`,
        allowance.carry > 0
          ? `Termasuk ${formatRupiah(allowance.carry)} sisa kemarin.`
          : allowance.carry < 0
            ? `Sudah dipotong ${formatRupiah(-allowance.carry)} dari kelebihan kemarin.`
            : 'Belum ada sisa atau kelebihan dari kemarin.',
      ],
      nextStep: noTxNextStep(timeBucket),
      tone: 'calm',
      keyNumbers: [allowance.allowed, allowance.carry],
    }),
  },
  {
    id: 'near_limit',
    when: ({ allowance }) =>
      allowance.allowed > 0 && allowance.spent >= allowance.allowed * NEAR_LIMIT_RATIO,
    build: ({ allowance }) => ({
      statusTitle: `Hampir menyentuh jatah ${formatRupiah(allowance.allowed)}.`,
      bullets: [
        `Sudah terpakai ${formatRupiah(allowance.spent)} hari ini.`,
        `Sisa ${formatRupiah(Math.max(0, allowance.remaining))}.`,
      ],
      nextStep: `Kalau perlu belanja lagi, pilih yang paling penting di bawah ${formatRupiah(Math.max(0, allowance.remaining))}.`,
      tone: 'calm',
      keyNumbers: [allowance.spent, allowance.allowed, allowance.remaining],
    }),
  },
  {
    id: 'income_drought',
    when: ({ stats }) =>
      stats.daysSinceIncome !== null && stats.daysSinceIncome >= INCOME_DROUGHT_DAYS,
    build: ({ stats, funds }) => ({
      statusTitle: `Sudah ${stats.daysSinceIncome} hari tanpa pemasukan.`,
      bullets: [
        funds.runwayDays !== null
          ? `Runway saat ini ${funds.runwayDays} hari.`
          : 'Runway belum bisa dihitung.',
        'Untuk pemasukan tak menentu, jeda panjang itu wajar — yang penting terlihat.',
      ],
      nextStep: 'Cek apakah ada tagihan/invoice yang bisa ditagih minggu ini.',
      tone: funds.mode === 'calm' ? 'calm' : 'alert',
      keyNumbers: [stats.daysSinceIncome ?? 0, funds.runwayDays ?? 0],
    }),
  },
  {
    id: 'discretionary_heavy',
    when: ({ stats }) =>
      stats.spent7d > 0 &&
      stats.discretionaryShare7d !== null &&
      stats.discretionaryShare7d >= DISCRETIONARY_HEAVY_RATIO,
    build: ({ stats }) => {
      const percent = Math.round((stats.discretionaryShare7d ?? 0) * 100)
      return {
        statusTitle: `${percent}% pengeluaran 7 harimu bukan kebutuhan.`,
        bullets: [
          `Total 7 hari ${formatRupiah(stats.spent7d)}.`,
          'Ini bukan penilaian — hanya supaya polanya terlihat.',
        ],
        nextStep: 'Pilih satu kategori keinginan yang paling mudah dikurangi minggu ini.',
        tone: 'calm',
        keyNumbers: [percent, stats.spent7d],
      }
    },
  },
  {
    id: 'consistency_praise',
    when: ({ stats }) => stats.daysWithTx7d >= 6,
    build: ({ stats }) => ({
      statusTitle: `Kamu konsisten ${stats.daysWithTx7d} dari 7 hari.`,
      bullets: [
        `Total pengeluaran 7 hari ${formatRupiah(stats.spent7d)}.`,
        `Rata-rata ${formatRupiah(Math.floor(stats.spent7d / 7))} per hari.`,
      ],
      nextStep: 'Pertahankan: cukup 1 catatan per hari selama 2 hari lagi.',
      tone: 'calm',
      keyNumbers: [stats.daysWithTx7d, stats.spent7d],
    }),
  },
  {
    id: 'steady',
    when: () => true,
    build: ({ allowance, funds }) => ({
      statusTitle: 'Hari ini berjalan sesuai rencana.',
      bullets: [
        `Sisa jatah hari ini ${formatRupiah(Math.max(0, allowance.remaining))}.`,
        funds.runwayDays !== null
          ? `Aman ${funds.runwayDays} hari tanpa pemasukan baru.`
          : `Uang tersedia ${formatRupiah(funds.available)}.`,
      ],
      nextStep: 'Tidak ada yang perlu dilakukan. Lanjutkan saja.',
      tone: 'calm',
      keyNumbers: [allowance.remaining, funds.runwayDays ?? 0],
    }),
  },
]

export const computeInsight = (input: InsightInput): CoachingInsight => {
  // `steady` selalu cocok, jadi rule selalu ketemu.
  const rule = RULES.find((candidate) => candidate.when(input)) as Rule
  const built = rule.build(input)

  return {
    ...built,
    ruleId: rule.id,
    mode: input.funds.mode,
    continuityLine: buildContinuityLine(
      input.lastMemory,
      input.today,
      built.tone,
      input.timeBucket,
    ),
  }
}

/**
 * Memory dicatat hanya ketika ada yang benar-benar berubah — hari baru, atau
 * rule yang berbeda dari catatan terakhir. Ini yang menjaga riwayat tetap
 * bermakna alih-alih penuh duplikat.
 */
export const shouldRecordMemory = (
  insight: CoachingInsight,
  lastMemory: MemoryEntry | null,
  today: string,
): boolean => {
  if (!lastMemory) return true
  if (lastMemory.dateLocal !== today) return true
  return lastMemory.ruleId !== insight.ruleId
}
