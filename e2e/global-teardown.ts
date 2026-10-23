import { stopFakeMeta } from './tests/support/fakeMeta';

export default async function globalTeardown() {
  await stopFakeMeta();
}
