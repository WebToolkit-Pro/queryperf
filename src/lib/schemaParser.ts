import { ModelMap, Field } from './analyzer/types';

export function parsePrismaSchema(schema: string): ModelMap {
  const modelMap: ModelMap = {};
  
  // Extract models block by block
  const modelBlocks = schema.matchAll(/model\s+(\w+)\s+{([\s\S]*?)}/g);
  
  for (const match of Array.from(modelBlocks)) {
    const [_, modelName, body] = match;
    const fields: Field[] = [];
    const indexes: string[][] = [];
    
    const lines = body.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return;
      
      // Parse table-level indexes @@index([authorId]) or @@index([authorId, postId])
      if (trimmed.startsWith('@@index')) {
        const indexMatch = trimmed.match(/\[(.*?)\]/);
        if (indexMatch) {
          const fieldsInIndex = indexMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
          indexes.push(fieldsInIndex);
        }
        return;
      }
      
      // Ignore other table level attributes for now
      if (trimmed.startsWith('@@')) return;
      
      // Parse field
      // e.g., authorId String @map("author_id")
      // e.g., posts Post[]
      // e.g., author User @relation(fields: [authorId], references: [id], onDelete: Cascade)
      const fieldMatch = trimmed.match(/^(\w+)\s+([A-Za-z0-9_]+)(\[\])?\s*(.*)/);
      
      if (fieldMatch) {
        const name = fieldMatch[1];
        const type = fieldMatch[2];
        const isArray = !!fieldMatch[3];
        const attributes = fieldMatch[4] || '';
        
        const isId = attributes.includes('@id');
        const isUnique = attributes.includes('@unique');
        
        const relationMatch = attributes.match(/@relation\((.*?)\)/);
        let isRelation = false;
        let relationName: string | undefined;
        let relationTo: string | undefined;
        let onDelete: string | undefined;
        
        // If type is title cased (conventionally), it's likely a relation model type, but we verify later or assume.
        // We can just rely on Prisma convention: primitive types are lowercased (String, Int, Boolean, DateTime, Json, Bytes)
        // Models are typically PascalCase.
        const isPrimitive = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'BigInt'].includes(type);
        
        if (!isPrimitive) {
            isRelation = true;
            relationTo = type;
        }

        if (relationMatch) {
          isRelation = true;
          const relationArgs = relationMatch[1];
          
          // parse onDelete: Cascade
          const onDeleteMatch = relationArgs.match(/onDelete:\s*(\w+)/);
          if (onDeleteMatch) {
            onDelete = onDeleteMatch[1];
          }
          
          // Name could be first arg if quoted, e.g., @relation("PostAuthor", fields: ...)
          const nameMatch = relationArgs.match(/^"([^"]+)"/);
          if (nameMatch) {
            relationName = nameMatch[1];
          }
        }
        
        fields.push({
          name,
          type,
          isId,
          isUnique,
          isRelation,
          relationName,
          relationTo,
          onDelete,
          isArray
        });
        
        // Field-level @id or @unique counts as an index for missing-index rule
        if (isId || isUnique) {
          indexes.push([name]);
        }
      }
    });
    
    modelMap[modelName] = {
      name: modelName,
      fields,
      indexes
    };
  }
  
  return modelMap;
}