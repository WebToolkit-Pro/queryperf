import { Rule, RuleResult, Finding, ModelMap } from '../types';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export const selectStarRule: Rule = (schema: ModelMap, ast): RuleResult => {
  const findings: Finding[] = [];

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
        const action = callee.property.name;
        
        if (['findMany', 'findUnique', 'findFirst'].includes(action)) {
          const schemaModelName = Object.keys(schema).find(k => k.toLowerCase() === modelName.toLowerCase());
          if (!schemaModelName) return;
          const schemaModel = schema[schemaModelName];
          
          const args = path.node.arguments;
          let hasSelect = false;

          if (args.length > 0 && t.isObjectExpression(args[0])) {
            hasSelect = args[0].properties.some(prop => 
              t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: 'select' })
            );
          }

          if (!hasSelect) {
            // Check if model has heavy fields
            const hasHeavyFields = schemaModel.fields.some(f => ['Bytes', 'Json', 'Text'].includes(f.type) || f.type.toLowerCase().includes('text'));
            
            if (hasHeavyFields) {
              const loc = path.node.loc?.start.line;
              findings.push({
                ruleId: 'select-star',
                severity: 'info',
                title: `Implicit SELECT * on Heavy Model (${modelName})`,
                description: `A \`${action}\` call on \`${modelName}\` does not explicitly select fields. This model contains heavy fields (Bytes, Json, or Text) which will be fetched over the network for every row, consuming excessive memory and bandwidth.`,
                location: loc ? `Line ${loc}` : undefined,
                fix: {
                  explanation: `Explicitly select only the fields you need using the \`select\` property.`,
                  code: `await prisma.${modelName}.${action}({\n  select: {\n    id: true,\n    // only include necessary lightweight fields\n  }\n});`
                }
              });
            }
          }
        }
      }
    }
  });

  return {
    ruleId: 'select-star',
    findings
  };
};
