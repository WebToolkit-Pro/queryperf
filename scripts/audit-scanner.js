const fs = require('fs');
const path = require('path');
const glob = require('glob');

async function run() {
  const schemaPath = process.env.INPUT_SCHEMA_PATH || './prisma/schema.prisma';
  const queryGlob = process.env.INPUT_QUERY_GLOB || 'src/**/*.ts';
  const apiUrl = process.env.QUERYPERF_API_URL || 'https://queryperf.vercel.app';

  if (!fs.existsSync(schemaPath)) {
    console.log(`Schema file not found at ${schemaPath}, skipping audit.`);
    return;
  }

  const schema = fs.readFileSync(path.resolve(schemaPath), 'utf8');
  
  // Using glob.sync which is available in glob v10 if imported correctly, but package.json has "glob": "^10.3.10"
  // Wait, glob v10 sync is glob.sync.
  const files = glob.sync(queryGlob);
  if (files.length === 0) {
    console.log(`No query files found matching ${queryGlob}, skipping audit.`);
    return;
  }

  const queries = files.map(f => `// File: ${f}\n` + fs.readFileSync(f, 'utf8')).join('\n\n');

  console.log(`Sending ${files.length} files to QueryPerf API...`);

  const res = await fetch(`${apiUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schema, queries })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`QueryPerf API Error: ${res.status} ${errorData.message || ''}`);
  }

  const report = await res.json();
  const findings = report.findings || [];

  if (findings.length === 0) {
    console.log('✅ QueryPerf: All Clear! No performance issues found.');
    return;
  }

  const criticalCount = report.metrics.critical || 0;
  const warningCount = report.metrics.warning || 0;

  let md = `## ⚠️ QueryPerf Database Audit\n\n`;
  md += `Found **${findings.length} issues** in this PR that will cause performance problems under load.\n\n---\n\n`;

  for (const f of findings) {
    const icon = f.severity === 'critical' ? '🔴' : (f.severity === 'warning' ? '🟡' : '🔵');
    md += `### ${icon} ${f.severity.toUpperCase()} — ${f.title}\n`;
    if (f.location) md += `\`${f.location}\`\n`;
    md += `${f.description}\n\n`;
    md += `**Fix:**\n\`\`\`ts\n${f.fix.code}\n\`\`\`\n\n---\n\n`;
  }

  md += `[View full audit on QueryPerf →](${report.shareUrl})\n`;
  md += `[Copy shareable fix for Cursor →](${report.shareMdUrl})\n`;

  // Write to GitHub Step Summary if running in Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }

  console.log(`QueryPerf found ${findings.length} issues (${criticalCount} Critical, ${warningCount} Warning).`);
  console.log(md);

  // If there are critical issues, fail the workflow
  if (criticalCount > 0) {
    process.exit(1);
  }
}

run().catch(err => { 
  console.error(err); 
  process.exit(1); 
});