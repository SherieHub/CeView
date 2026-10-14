import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The content `source` contract, compared across stacks.
 *
 * Spring's ContentSource enum (and FastAPI's closed `Literal["groq"]` response model)
 * admit exactly one value: the model produced the captions. Unavailability is an
 * error, never a source. The frontend type must not be wider: every extra value it
 * accepts is a UI branch (e.g. the "Showing stubbed content" banner) for a response
 * the backend can no longer send — dead code that tests used to keep alive by
 * fabricating that response.
 */
const repo = path.resolve(__dirname, '../../..');

function javaEnumValues(): string[] {
  const src = readFileSync(
    path.join(repo, 'backend/spring-boot/src/main/java/com/ceview/module3/dto/ContentDtos.java'),
    'utf8',
  );
  const body = src.match(/enum ContentSource\s*\{([^}]*)\}/);
  if (!body) throw new Error('ContentSource enum not found in ContentDtos.java');
  return [...body[1].matchAll(/@JsonProperty\("([^"]+)"\)/g)].map((m) => m[1]).sort();
}

function frontendUnionValues(): string[] {
  const src = readFileSync(path.join(repo, 'frontend/types.ts'), 'utf8');
  const decl = src.match(/export type ContentSource\s*=\s*([^;]+);/);
  if (!decl) throw new Error('ContentSource type not found in frontend/types.ts');
  return [...decl[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('content source contract', () => {
  it('reads a non-empty value set from the backend', () => {
    expect(javaEnumValues()).toEqual(['groq']);
  });

  it('the frontend accepts exactly the sources the backend can send', () => {
    expect(frontendUnionValues()).toEqual(javaEnumValues());
  });
});
