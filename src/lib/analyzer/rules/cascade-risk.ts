import { Rule, RuleResult, Finding, ModelMap } from '../types';

export const cascadeRiskRule: Rule = (schema: ModelMap, ast): RuleResult => {
  const findings: Finding[] = [];

  // 1. Identify models with heavy cascade risks
  for (const [modelName, model] of Object.entries(schema)) {
    // Count how many relations point to this model with onDelete: Cascade
    const cascadingChildren: string[] = [];
    
    for (const [childName, childModel] of Object.entries(schema)) {
      for (const field of childModel.fields) {
        if (field.isRelation && field.relationTo === modelName && field.onDelete === 'Cascade') {
          cascadingChildren.push(childName);
        }
      }
    }

    if (cascadingChildren.length >= 3) {
      findings.push({
        ruleId: 'cascade-risk',
        severity: 'warning',
        title: `High Cascade Risk on ${modelName}`,
        description: `Deleting a \`${modelName}\` will automatically cascade-delete all related records in ${cascadingChildren.map(c => `\`${c}\``).join(', ')}. Ensure this massive blast radius is intentional.`,
        location: `Schema -> ${modelName} model`,
        fix: {
          explanation: `Consider changing \`onDelete: Cascade\` to \`onDelete: SetNull\` or \`onDelete: Restrict\` for critical relations, or implement soft deletes (\`deletedAt\`).`,
          code: `// Change from:\n@relation(fields: [...], references: [...], onDelete: Cascade)\n\n// To:\n@relation(fields: [...], references: [...], onDelete: Restrict)`
        }
      });
    }
  }

  return {
    ruleId: 'cascade-risk',
    findings
  };
};
