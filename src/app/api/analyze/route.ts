import { NextResponse } from 'next/server';
import { runAnalyzer } from '@/lib/analyzer';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (!body.schema || !body.queries) {
      return NextResponse.json(
        { error: 'EMPTY_INPUT', message: 'Both schema and queries are required' },
        { status: 400 }
      );
    }

    let report;
    try {
      report = runAnalyzer({
        schema: body.schema,
        queries: body.queries,
        metricsConfig: body.metricsConfig
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: 'ANALYSIS_FAILED', message: err.message || 'Internal error during rule execution' },
        { status: 400 }
      );
    }

    // Save to Supabase (only if env vars are present, otherwise just return the ephemeral report)
    let auditId = 'local-dev-' + Date.now();
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data, error } = await supabase
        .from('audits')
        .insert({
          schema_input: body.schema,
          query_input: body.queries,
          report: report,
          metrics_config: body.metricsConfig || {}
        })
        .select('id')
        .single();
        
      if (error) {
        console.error('Supabase Error:', error);
        // Fallback to ephemeral if DB fails, so we don't break the UI
      } else if (data) {
        auditId = data.id;
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      auditId,
      findings: report.findings,
      metrics: report.metrics,
      generatedAt: report.generatedAt,
      shareUrl: `${appUrl}/audit/${auditId}`,
      shareMdUrl: `${appUrl}/audit/${auditId}/share.md`
    });
    
  } catch (error) {
    console.error('Analyze route error:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Unexpected server error' },
      { status: 500 }
    );
  }
}