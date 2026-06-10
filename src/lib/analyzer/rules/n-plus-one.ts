import { Rule, RuleResult, Finding, ModelMap } from '../types';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export const nPlusOneRule: Rule = (schema: ModelMap, ast, rawCode): RuleResult => {
  const findings: Finding[] = [];

  traverse(ast, {
    CallExpression(path: import('@babel/traverse').NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      
      // Look for prisma.[model].[action]()
      if (
        t.isMemberExpression(callee) &&
        t.isMemberExpression(callee.object) &&
        t.isIdentifier(callee.object.object, { name: 'prisma' }) &&
        t.isIdentifier(callee.property)
      ) {
        const modelName = (callee.object.property as t.Identifier).name;
        const action = callee.property.name;
        
        // Prisma read actions
        const readActions = ['findMany', 'findUnique', 'findFirst', 'count'];
        if (!readActions.includes(action)) return;

        // Check if we are inside a loop
        let isInsideLoop = false;
        let loopNode: t.Node | null = null;
        
        path.findParent((parent) => {
          if (
            t.isForStatement(parent.node) ||
            t.isForOfStatement(parent.node) ||
            t.isForInStatement(parent.node) ||
            t.isWhileStatement(parent.node) ||
            t.isDoWhileStatement(parent.node)
          ) {
            isInsideLoop = true;
            loopNode = parent.node;
            return true;
          }
          
          // Check for .map(), .forEach(), etc.
          if (t.isCallExpression(parent.node) && t.isMemberExpression(parent.node.callee)) {
            const method = parent.node.callee.property;
            if (t.isIdentifier(method) && ['map', 'forEach', 'filter', 'reduce'].includes(method.name)) {
              isInsideLoop = true;
              loopNode = parent.node;
              return true;
            }
          }
          
          return false;
        });

        if (isInsideLoop) {
          const loc = path.node.loc?.start.line;
          
          // Try to generate a fix string
          // We don't have perfect context of what the parent query was, but we can make an educated guess.
          // If the model is `post`, we suggest replacing this loop with an `include: { posts: true }` on the parent query.
          const relationSuggestion = modelName.toLowerCase() + 's';
          
          findings.push({
            ruleId: 'n-plus-one',
            severity: 'critical',
            title: 'N+1 Query Detected',
            description: `A \`prisma.${modelName}.${action}()\` call is executed inside a loop. This will result in one database query per iteration, which degrades performance exponentially under load.`,
            location: loc ? `Line ${loc}` : undefined,
            fix: {
              explanation: `Instead of fetching relations in a loop, fetch them all at once using Prisma's \`include\` on the parent query.`,
              code: `// Instead of looping to fetch ${modelName}:\nconst parentRecords = await prisma.parentModel.findMany({\n  include: {\n    ${relationSuggestion}: true\n  }\n});`
            }
          });
        }
      }
    }
  });

  return {
    ruleId: 'n-plus-one',
    findings
  };
};