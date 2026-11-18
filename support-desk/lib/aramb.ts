import 'server-only';
import { Aramb } from '@aramb-ai/sdk';
import { requireEnv } from './env';

let client: Aramb | null = null;

/**
 * The one SDK client of this server. The builder key is read here, on the
 * server only (`server-only` makes importing this from a client component a
 * build error), and never sent to the browser.
 */
export function aramb(): Aramb {
  if (!client) {
    client = new Aramb({
      apiKey: requireEnv(process.env, 'ARAMB_KEY'),
      baseUrl: process.env.ARAMB_BASE_URL || undefined,
    });
  }
  return client;
}
