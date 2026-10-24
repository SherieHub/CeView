import { test } from '@playwright/test';
import { provisionOperator } from './support/operator';
import { api } from './support/api';
test('probe generate', async () => {
  test.setTimeout(300000);
  const op = await provisionOperator('explore-gen', { demandWindow: true });
  const t0 = Date.now();
  const r = await api(op.token).post('/api/content/generate', {
    market: 'korea', businessName: op.businessName, description: 'Family-run dive shop in Moalboal', categories: ['Coastal & Island'], trend: 'surging', demandAlertId: op.window!.demandAlertId,
  }, 200000);
  console.log('generate', r.status, Date.now() - t0, 'ms');
  console.log(JSON.stringify(r.body).slice(0, 1800));
});
