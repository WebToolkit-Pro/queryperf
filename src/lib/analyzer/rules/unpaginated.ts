import { Rule, RuleResult, Finding, ModelMap } from '../types';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export const unpaginatedRule: Rule = (schema: ModelMap, ast): RuleResult => {
  const findings: Finding[] = [];

  traverse(ast, {
    CallExpression(path: import('@babel/traverse').NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      if (
        t.isMemberExpression(callee) &&
        t.isMemberExpression(callee.object) &&
        t.isIdentifier(callee.object.object, { name: 'prisma' }) &&
        t.isIdentifier(callee.property, { name: 'findMany' })
      ) {
        const modelName = (callee.object.property as t.Identifier).name;
        
        const args = path.node.arguments;
        let hasTake = false;
        let hasSkip = false;

        if (args.length > 0 && t.isObjectExpression(args[0])) {
          args[0].properties.forEach(prop => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              if (prop.key.name === 'take') hasTake = true;
              if (prop.key.name === 'skip') hasSkip = true;
            }
          });
        }

        if (!hasTake && !hasSkip) {
          const loc = path.node.loc?.start.line;
          findings.push({
            ruleId: 'unpaginated',
            severity: 'warning',
            title: `Unpaginated findMany on ${modelName}`,
            description: `A \`findMany\` call on \`${modelName}\` lacks \`take\` or \`skip\` limits. If this table grows large, this query will load all records into memory, potentially causing OOM errors or timeouts.`,
            location: loc ? `Line ${loc}` : undefined,
            fix: {
              explanation: `Add a \`take\` parameter to strictly cap the number of returned rows.`,
              code: `await prisma.${modelName}.findMany({\n  take: 100, // Safe upper limit\n  // ... other options\n});`
            }
          });
        }
      }
    }
  });

  return {
    ruleId: 'unpaginated',
    findings
  };
};
