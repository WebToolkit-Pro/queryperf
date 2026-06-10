'use client';

import { useState } from 'react';
import { Finding } from '@/lib/analyzer';

export function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(true);
  const [resolved, setResolved] = useState(false);

  const severityColors = {
    critical: 'bg-critical-bg text-critical border-critical/30',
    warning: 'bg-warning-bg text-warning border-warning/30',
    info: 'bg-info-bg text-info border-info/30',
  };

  const badgeColor = severityColors[finding.severity];

  if (resolved) {
    return (
      <div className="bg-surface border border-border rounded-md p-4 mb-3 flex items-center justify-between opacity-50">
        <div className="flex items-center gap-3">
          <span className="text-muted line-through font-mono text-sm">{finding.title}</span>
        </div>
        <button 
          onClick={() => setResolved(false)}
          className="text-xs font-mono text-secondary hover:text-primary transition-colors"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-md mb-3 overflow-hidden transition-all duration-150">
      <div 
        className="p-4 cursor-pointer hover:bg-elevated transition-colors flex items-start justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${badgeColor}`}>
              ● {finding.severity.toUpperCase()}
            </span>
            <span className="font-mono text-primary font-medium">{finding.title}</span>
          </div>
          {finding.location && (
            <div className="text-xs font-mono text-secondary mt-1">
              {finding.location}
            </div>
          )}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setResolved(true); }}
          className="text-xs font-mono text-muted hover:text-pass transition-colors border border-border hover:border-pass/30 rounded px-2 py-1"
        >
          Mark Resolved
        </button>
      </div>

      {expanded && (
        <div className="p-4 border-t border-border bg-base/30">
          <p className="text-sm text-secondary mb-4 leading-relaxed">
            {finding.description}
          </p>
          
          <div className="bg-base border border-border rounded p-3">
            <div className="text-xs font-mono text-secondary mb-2">Fix: {finding.fix.explanation}</div>
            <pre className="text-sm font-mono text-primary overflow-x-auto p-2 bg-surface rounded border border-border-strong whitespace-pre-wrap">
              {finding.fix.code}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}