import type { CoachingInsight } from '@/lib/core/insight-types'

const toneClass = (insight: CoachingInsight) => {
  if (insight.tone === 'alert') return 'insight-card insight-alert'
  if (insight.ruleId === 'consistency_praise') return 'insight-card insight-praise'
  if (insight.mode === 'watchful') return 'insight-card insight-warn'
  return 'insight-card insight-calm'
}

export default function CoachingInsightCard({ insight }: { insight: CoachingInsight }) {
  return (
    <section className={toneClass(insight)}>
      {insight.continuityLine ? (
        <p className="insight-continuity">{insight.continuityLine}</p>
      ) : null}
      <h2 className="insight-title">{insight.statusTitle}</h2>
      <ul className="insight-bullets">
        {insight.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <p className="insight-next">{insight.nextStep}</p>
    </section>
  )
}
