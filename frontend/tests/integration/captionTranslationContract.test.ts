import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The caption-translation contract, compared across stacks without running any of
 * them: `optionsEn` rides alongside `options` from fastapi-sbert through Spring to
 * the frontend, and the MOD31_TRANSLATION_* codes mean the same thing everywhere.
 */
const repo = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(repo, p), 'utf8');

describe('caption translation contract', () => {
  it('optionsEn is declared by sbert, Spring and the frontend', () => {
    expect(read('backend/fastapi-sbert/app/services/caption_formatting.py')).toContain('"optionsEn"');
    expect(read('backend/spring-boot/src/main/java/com/ceview/module3/dto/ContentDtos.java')).toMatch(
      /List<String>\s+optionsEn/,
    );
    expect(read('frontend/types.ts')).toMatch(/optionsEn\?:\s*string\[\]/);
  });

  it.each(['MOD31_TRANSLATION_UNAVAILABLE', 'MOD31_TRANSLATION_FAILED', 'MOD31_TRANSLATION_VALIDATION'])(
    '%s exists in both Python and Java',
    (code) => {
      expect(read('backend/fastapi-sbert/app/errors.py')).toContain(`"${code}"`);
      expect(read('backend/spring-boot/src/main/java/com/ceview/module3/Module3ErrorCodes.java')).toContain(
        `"${code}"`,
      );
    },
  );

  it('the endpoints the client calls are the ones Spring serves', () => {
    const controller = read('backend/spring-boot/src/main/java/com/ceview/module3/ContentController.java');
    const client = read('frontend/services/apiClient.ts');
    for (const route of ['/translate', '/localize']) {
      expect(controller).toContain(`@PostMapping("${route}")`);
      expect(client).toContain(`/api/content${route}`);
    }
  });
});
