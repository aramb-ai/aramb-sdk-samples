import type { NextConfig } from 'next';
import { devLoginEnabled } from './lib/env';

// Refuse to start (dev, build or start) with the dev login enabled outside
// development/test. Next has loaded `.env*` and set NODE_ENV by now.
devLoginEnabled(process.env);

const nextConfig: NextConfig = {
  // The SDK opens WebSockets with `ws`; keep both as plain Node requires on the server.
  serverExternalPackages: ['@aramb-ai/sdk', 'ws'],
  // Don't write an AGENTS.md into the sample on `next dev`.
  agentRules: false,
};

export default nextConfig;
