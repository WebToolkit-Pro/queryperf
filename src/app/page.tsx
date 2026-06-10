'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LiveParseIndicator } from '@/components/LiveParseIndicator';

export default function Home() {
  const router = useRouter();
  const [schema, setSchema] = useState('');
  const [queries, setQueries] = useState('');
  const [isTypingSchema, setIsTypingSchema] = useState(false);
  const [isTypingQueries, setIsTypingQueries] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState({
    'n-plus-one': true,
    'missing-index': true,
    'select-star': true,
    'unpaginated': true,
    'cascade-risk': false,
  });

  const handleSchemaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSchema(e.target.value);
    setIsTypingSchema(true);
    setTimeout(() => setIsTypingSchema(false), 50);
  };

  const handleQueriesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQueries(e.target.value);
    setIsTypingQueries(true);
    setTimeout(() => setIsTypingQueries(false), 50);
  };

  const toggleMetric = (key: keyof typeof metrics) => {
    setMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunAudit = async () => {
    if (!schema.trim() || !queries.trim()) {
      setError('Both schema and queries are required.');
      return;
    }
    setError(null);
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, queries, metricsConfig: metrics }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Analysis failed');

      router.push(`/audit/${data.auditId}`);
    } catch (err: any) {
      setError(err.message);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-12 py-12">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-display font-medium text-primary tracking-tight">QueryPerf</h1>
        <div className="flex gap-4 text-sm font-mono text-secondary">
          <a href="#" className="hover:text-primary transition-colors">Docs</a>
          <a href="#" className="hover:text-primary transition-colors">GitHub</a>
        </div>
      </header>

      <div className="mb-8">
        <p className="text-base text-secondary">
          Paste your Prisma schema and AI-generated queries.<br/>
          We'll find what breaks under load.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-critical-bg border border-critical/30 rounded text-critical text-sm font-mono">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Schema Input */}
        <div className="flex flex-col">
          <div className="bg-surface border border-border rounded-t-md px-4 py-2 text-xs font-mono text-secondary uppercase tracking-wider flex justify-between items-center">
            <span>schema.prisma</span>
          </div>
          <textarea 
            value={schema}
            onChange={handleSchemaChange}
            placeholder="model User { ... }"
            className="h-[360px] w-full bg-base border-x border-border p-4 font-mono text-sm text-primary focus:outline-none focus:border-border-strong resize-none whitespace-pre"
            spellCheck={false}
          />
          <LiveParseIndicator isTyping={isTypingSchema} />
        </div>

        {/* Queries Input */}
        <div className="flex flex-col">
          <div className="bg-surface border border-border rounded-t-md px-4 py-2 text-xs font-mono text-secondary uppercase tracking-wider flex justify-between items-center">
            <span>queries.ts</span>
          </div>
          <textarea 
            value={queries}
            onChange={handleQueriesChange}
            placeholder="const users = await prisma.user.findMany();"
            className="h-[360px] w-full bg-base border-x border-border p-4 font-mono text-sm text-primary focus:outline-none focus:border-border-strong resize-none whitespace-pre"
            spellCheck={false}
          />
          <LiveParseIndicator isTyping={isTypingQueries} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-secondary uppercase tracking-wider mr-2">Audit rules:</span>
          {Object.entries(metrics).map(([key, enabled]) => (
            <button
              key={key}
              onClick={() => toggleMetric(key as keyof typeof metrics)}
              className={\`text-xs font-mono px-2 py-1 rounded transition-colors \${enabled ? 'bg-accent-dim text-accent' : 'text-muted hover:text-secondary'}\`}
            >
              [{key} {enabled ? '✓' : ' '}]
            </button>
          ))}
        </div>

        <button
          onClick={handleRunAudit}
          disabled={isAnalyzing}
          className="bg-accent text-bg-base font-mono font-medium px-6 py-2 rounded shadow-[0_0_15px_rgba(91,141,239,0.2)] hover:shadow-[0_0_20px_rgba(91,141,239,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? 'Analyzing...' : 'Run Audit →'}
        </button>
      </div>
    </div>
  );
}