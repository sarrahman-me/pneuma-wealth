"use client";

import React from "react";

export type CoachingInsight = {
  status_title: string;
  bullets: string[];
  next_step: string;
  tone: "calm" | "warn" | "praise" | "neutral" | string;
  debug_meta?: {
    rule_id: string;
    key_numbers: number[];
  } | null;
};

type CoachingInsightCardProps = {
  insight: CoachingInsight;
  compact?: boolean;
};

export default function CoachingInsightCard({
  insight,
  compact,
}: CoachingInsightCardProps) {
  const bulletItems = compact ? insight.bullets.slice(0, 1) : insight.bullets;

  return (
    <div className={`insight-card insight-${insight.tone}`}>
      <div className="insight-title">{insight.status_title}</div>
      {bulletItems.length > 0 && (
        <ul className="insight-bullets">
          {bulletItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
      {!compact && <div className="insight-next">{insight.next_step}</div>}
    </div>
  );
}
