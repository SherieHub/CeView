// Fails unless Java 21+ is active (honors JAVA_HOME).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const bin = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
const out = `${r.stderr ?? ''}${r.stdout ?? ''}`;
const m = out.match(/version "(\d+)(?:\.(\d+))?/);
const major = m ? (m[1] === '1' ? Number(m[2]) : Number(m[1])) : 0;
if (r.error || major < 21) {
  console.error(`✖ Spring Boot checks need Java 21+, found ${major || 'none'}.`);
  console.error('  Set JAVA_HOME to a JDK 21 install (e.g. C:/Program Files/Eclipse Adoptium/jdk-21...) and retry.');
  process.exit(1);
}
