"use client";

import React from "react";

export type CoachingInsight = {
  status_title: string;
  bullets: string[];
  next_step: string;
  tone: "calm" | "alert" | string;
  coach_mode: "calm" | "watchful" | string;
  continuity_line?: string | null;
  memory_reflection?: string | null;
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
      {insight.continuity_line && (
        <div className="insight-continuity">{insight.continuity_line}</div>
      )}
      <div className="insight-title">{insight.status_title}</div>
      {!compact && insight.memory_reflection && (
        <div className="insight-memory">{insight.memory_reflection}</div>
      )}
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
