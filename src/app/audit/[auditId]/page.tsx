import { supabase } from '@/lib/supabase';
import { AuditReport } from '@/lib/analyzer';
import { FindingCard } from '@/components/FindingCard';
import Link from 'next/link';
import { notFound } from 'next/navigation';

async function getAudit(id: string): Promise<AuditReport | null> {
  // If no DB connection is configured, return null gracefully (local dev)
  if (!process.env.SUPABASE_URL) return null;
  if (id.startsWith('local-dev-')) return null;

  const { data } = await supabase.from('audits').select('report').eq('id', id).single();
  return data?.report as AuditReport | null;
}

export default async function AuditPage({ params }: { params: { auditId: string } }) {
  const report = await getAudit(params.auditId);

  // If local dev or not found, we can't show it via SSR if not saved.
  // In a real MVP, the analyze route returns the payload directly, but here we read from DB.
  if (!report) {
    if (params.auditId.startsWith('local-dev-')) {
      return (
        <div className="max-w-[900px] mx-auto px-6 py-12 text-center">
          <h1 className="text-xl font-display text-primary mb-4">Local Dev Audit</h1>
          <p className="text-secondary text-sm">Audits are not saved unless Supabase credentials are configured.</p>
        </div>
      );
    }
    notFound();
  }

  const { findings, metrics, generatedAt, id } = report;
  const dateStr = new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-12 py-12">
      <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <Link href="/" className="text-secondary hover:text-primary transition-colors text-sm font-mono flex items-center gap-2">
          ← New Audit
        </Link>
        <div className="flex gap-4 text-sm font-mono text-secondary">
          <span>Audit #{id.split('-')[0]}</span>
          <span>{dateStr}</span>
        </div>
      </header>

      {/* Summary Bar */}
      <div className="flex grid grid-cols-4 border border-border rounded-md overflow-hidden mb-8 font-mono text-sm divide-x divide-border">
        <div className="p-3 bg-surface text-primary flex justify-center">{metrics.total} Issues</div>
        <div className="p-3 bg-critical-bg text-critical flex justify-center">{metrics.critical} Critical</div>
        <div className="p-3 bg-warning-bg text-warning flex justify-center">{metrics.warning} Warning</div>
        <div className="p-3 bg-info-bg text-info flex justify-center">{metrics.info} Info</div>
      </div>

      <div className="flex justify-between items-center border-b border-border pb-4 mb-6">
        <div className="text-sm text-secondary font-mono">
          Rules run: {metrics.rulesRun.join(', ')}
        </div>
        <div className="flex gap-3">
          <Link 
            href={\`/audit/\${id}/share.md\`}
            target="_blank"
            className="text-xs font-mono bg-surface border border-border text-primary px-3 py-1.5 rounded hover:bg-elevated transition-colors"
          >
            Export .md
          </Link>
          <button 
            className="text-xs font-mono bg-accent text-bg-base px-3 py-1.5 rounded hover:shadow-[0_0_10px_rgba(91,141,239,0.3)] transition-all"
            onClick={() => {
              const url = \`\${window.location.origin}/audit/\${id}/share.md\`;
              navigator.clipboard.writeText(url);
              alert('Markdown URL copied to clipboard! Paste it to Claude/Cursor.');
            }}
          >
            Copy for Cursor →
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {findings.length === 0 ? (
          <div className="text-center py-12 border border-border border-dashed rounded-md bg-surface/50">
            <span className="text-pass font-mono text-lg">● ALL CLEAR</span>
            <p className="text-secondary text-sm mt-2">No structural performance issues detected in the provided code.</p>
          </div>
        ) : (
          findings.map((f, i) => (
            <FindingCard key={i} finding={f} />
          ))
        )}
      </div>
    </div>
  );
}
