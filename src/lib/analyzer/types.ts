export type Severity = 'critical' | 'warning' | 'info';

export interface Finding {
  ruleId: string;
  severity: Severity;
  title: string;
  description: string;
  location?: string;
  fix: {
    explanation: string;
    code: string;
  };
}

export interface RuleResult {
  ruleId: string;
  findings: Finding[];
}

export interface Field {
  name: string;
  type: string;
  isId: boolean;
  isUnique: boolean;
  isRelation: boolean;
  relationName?: string;
  relationTo?: string; // The model this field links to
  onDelete?: string; // e.g., "Cascade"
  isArray?: boolean;
}

export interface Model {
  name: string;
  fields: Field[];
  indexes: string[][]; // Array of index fields, e.g., [['authorId'], ['postId', 'userId']]
}

export type ModelMap = Record<string, Model>;

// AST type from Babel parser
import * as t from '@babel/types';
import { ParseResult } from '@babel/parser';

export type QueryAST = ParseResult<t.File>;

export type Rule = (schema: ModelMap, ast: QueryAST, rawCode: string) => RuleResult;