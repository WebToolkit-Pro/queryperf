import { Rule, RuleResult, Finding, ModelMap } from '../types';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export const missingIndexRule: Rule = (schema: ModelMap, ast): RuleResult => {
  const findings: Finding[] = [];
  const queryFields: Record<string, Set<string>> = {};

  // Find where and orderBy clauses
  traverse(ast, {
    CallExpression(path: import('@babel/traverse').NodePath<t.CallExpression>) {
      const callee = path.node.callee;
      if (
        t.isMemberExpression(callee) &&
        t.isMemberExpression(callee.object) &&
        t.isIdentifier(callee.object.object, { name: 'prisma' }) &&
        t.isIdentifier(callee.property)
      ) {
        const modelName = (callee.object.property as t.Identifier).name;
        
        // Prisma models are usually lowercase in client, uppercase in schema
        // Let's find the matching schema model (case insensitive)
        const schemaModelName = Object.keys(schema).find(k => k.toLowerCase() === modelName.toLowerCase());
        if (!schemaModelName) return;

        const args = path.node.arguments;
        if (args.length > 0 && t.isObjectExpression(args[0])) {
          const props = args[0].properties;
          props.forEach(prop => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              if (['where', 'orderBy', 'cursor'].includes(prop.key.name)) {
                if (t.isObjectExpression(prop.value)) {
                  prop.value.properties.forEach(innerProp => {
                    if (t.isObjectProperty(innerProp) && t.isIdentifier(innerProp.key)) {
                      const fieldName = innerProp.key.name;
                      if (!queryFields[schemaModelName]) {
                        queryFields[schemaModelName] = new Set();
                      }
                      queryFields[schemaModelName].add(fieldName);
                    }
                  });
                }
              }
            }
          });
        }
      }
    }
  });

  // Cross reference with schema indexes
  for (const [model, fields] of Object.entries(queryFields)) {
    const schemaModel = schema[model];
    if (!schemaModel) continue;

    for (const field of Array.from(fields)) {
      // Check if field is indexed
      let isIndexed = false;
      for (const idx of schemaModel.indexes) {
        if (idx.includes(field)) {
          isIndexed = true;
          break;
        }
      }

      if (!isIndexed) {
        findings.push({
          ruleId: 'missing-index',
          severity: 'warning',
          title: `Missing Index on ${model}.${field}`,
          description: `The field \`${field}\` is used in a query condition (\`where\`, \`orderBy\`, or \`cursor\`) but lacks an index in the database. This will cause full table scans as data grows.`,
          fix: {
            explanation: `Add an index to your Prisma schema for the \`${field}\` field to optimize lookups.`,
            code: `// In your schema.prisma:\nmodel ${model} {\n  // ... existing fields ...\n\n  @@index([${field}])\n}`
          }
        });
      }
    }
  }

  return {
    ruleId: 'missing-index',
    findings
  };
};