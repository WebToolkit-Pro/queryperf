import { parse } from '@babel/parser';
import { parsePrismaSchema } from '../schemaParser';
import { nPlusOneRule } from './rules/n-plus-one';
import { missingIndexRule } from './rules/missing-index';
import { selectStarRule } from './rules/select-star';
import { unpaginatedRule } from './rules/unpaginated';
import { cascadeRiskRule } from './rules/cascade-risk';
import { Finding, RuleResult, QueryAST } from './types';
export * from './types'; // Exporting types for convenience

const RULES = {
  'n-plus-one': nPlusOneRule,
  'missing-index': missingIndexRule,
  'select-star': selectStarRule,
  'unpaginated': unpaginatedRule,
  'cascade-risk': cascadeRiskRule,
};

export interface AnalyzerInput {
  schema: string;
  queries: string;
  metricsConfig?: Record<string, boolean>;
}

export interface AuditReport {
  id: string;
  findings: Finding[];
  metrics: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    rulesRun: string[];
  };
  generatedAt: string;
}

export function runAnalyzer(input: AnalyzerInput): Omit<AuditReport, 'id'> {
  // Parse schema
  const schemaModel = parsePrismaSchema(input.schema);

  // Parse TS/JS code
  let ast: QueryAST;
  try {
    ast = parse(input.queries, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch (err) {
    throw new Error('Failed to parse queries code. Please provide valid TypeScript/JavaScript.');
  }

  // Determine rules to run
  const activeRules: string[] = [];
  const defaultConfig: Record<string, boolean> = {
    'n-plus-one': true,
    'missing-index': true,
    'select-star': true,
    'unpaginated': true,
    'cascade-risk': false, // OFF by default
  };

  const config = { ...defaultConfig, ...(input.metricsConfig || {}) };
  
  for (const [ruleId, isEnabled] of Object.entries(config)) {
    if (isEnabled && RULES[ruleId as keyof typeof RULES]) {
      activeRules.push(ruleId);
    }
  }

  // Run rules
  const allFindings: Finding[] = [];
  
  for (const ruleId of activeRules) {
    const ruleFn = RULES[ruleId as keyof typeof RULES];
    const result = ruleFn(schemaModel, ast, input.queries);
    allFindings.push(...result.findings);
  }

  // Sort findings: critical -> warning -> info
  const severityRank = { critical: 0, warning: 1, info: 2 };
  allFindings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    findings: allFindings,
    metrics: {
      total: allFindings.length,
      critical: allFindings.filter(f => f.severity === 'critical').length,
      warning: allFindings.filter(f => f.severity === 'warning').length,
      info: allFindings.filter(f => f.severity === 'info').length,
      rulesRun: activeRules,
    },
    generatedAt: new Date().toISOString(),
  };
}
