import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AuditReport, Finding } from '@/lib/analyzer';

export async function GET(request: Request, { params }: { params: { auditId: string } }) {
  const { auditId } = params;

  // Fetch from supabase
  let report: AuditReport | null = null;
  let schema = 'schema.prisma';
  
  if (auditId.startsWith('local-dev-')) {
    return new NextResponse('Audit not found or expired (ephemeral local dev audit).', { status: 404 });
  }

  const { data, error } = await supabase
    .from('audits')
    .select('report, schema_input')
    .eq('id', auditId)
    .single();

  if (error || !data) {
    return new NextResponse('Audit not found.', { status: 404 });
  }

  report = data.report as AuditReport;
  
  let markdown = `=== QueryPerf Audit: ${auditId} ===\n`;
  markdown += `Generated: ${report.generatedAt}\n`;
  markdown += `Schema: prisma/schema.prisma\n`;
  markdown += `Rules Run: ${report.metrics.rulesRun.join(', ')}\n\n`;

  let i = 1;
  for (const finding of report.findings) {
    markdown += `--- FINDING ${i} of ${report.findings.length} ---\n`;
    markdown += `Severity: ${finding.severity.toUpperCase()}\n`;
    markdown += `Rule: ${finding.ruleId}\n`;
    if (finding.location) {
      markdown += `Location: ${finding.location}\n`;
    }
    markdown += `Issue: ${finding.title} - ${finding.description}\n\n`;
    
    markdown += `Fix:\n${finding.fix.explanation}\n\n`;
    markdown += `[FIXED CODE BLOCK]\n\`\`\`\n${finding.fix.code}\n\`\`\`\n\n`;
    i++;
  }

  markdown += `--- END OF AUDIT ---\n`;
  markdown += `Paste this entire block into your AI assistant and say:\n`;
  markdown += `"Apply all fixes from this QueryPerf audit to my codebase."\n`;

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}
