/**
 * Structural contract: domain types live in types.ts, never in fixture modules.
 * Fixtures may import types; components may not import types FROM fixtures.
 * See docs/superpowers/plans/2026-08-29-frontend-backend-connection/01-foundation.md Task 1.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const REQUIRED_TYPES = [
  'Market', 'ChartDataPoint', 'Airline', 'DemandAlert',
  'CampaignInput', 'CampaignHistoryEntry', 'PrescriptiveReport',
  'FunnelDiagnostic', 'Recommendation',
  'PublishedPost', 'OmcsAuditResult', 'CaptionMetadata',
  'PlatformCaptions', 'ContentResponse',
];

describe('domain types live in types.ts', () => {
  const typesSrc = readFileSync(resolve(root, 'types.ts'), 'utf8');

  it.each(REQUIRED_TYPES)('types.ts declares %s', (name) => {
    expect(typesSrc).toMatch(new RegExp(`export (interface|type) ${name}\\b`));
  });

  it('no file outside services/fixtures imports a type from a fixture module', () => {
    const offenders: string[] = [];
    for (const file of walk(root)) {
      if (file.includes(join('services', 'fixtures'))) continue;
      const src = readFileSync(file, 'utf8');
      // Flags a type-only import whose module specifier path runs through a
      // "fixtures" directory (e.g. a relative services/fixtures/* module).
      if (/import\s+type\s+[^;]*from\s+['"][^'"]*fixtures\/[^'"]+['"]/.test(src)) {
        offenders.push(file.slice(root.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
