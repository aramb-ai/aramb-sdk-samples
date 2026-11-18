import { describe, expect, it } from 'vitest';
import { devLoginEnabled, requireEnv } from '../lib/env';

describe('devLoginEnabled', () => {
  it.each(['production', 'staging', undefined, ''])('refuses ALLOW_DEV_LOGIN=1 with NODE_ENV=%s', (nodeEnv) => {
    expect(() => devLoginEnabled({ ALLOW_DEV_LOGIN: '1', NODE_ENV: nodeEnv })).toThrow(/ALLOW_DEV_LOGIN=1 is only allowed/);
  });

  it.each(['development', 'test'])('offers the dev login with ALLOW_DEV_LOGIN=1 and NODE_ENV=%s', (nodeEnv) => {
    expect(devLoginEnabled({ ALLOW_DEV_LOGIN: '1', NODE_ENV: nodeEnv })).toBe(true);
  });

  it.each([undefined, '0', '', 'true'])('never offers it when ALLOW_DEV_LOGIN=%s', (flag) => {
    for (const nodeEnv of ['development', 'test', 'production', undefined]) {
      expect(devLoginEnabled({ ALLOW_DEV_LOGIN: flag, NODE_ENV: nodeEnv })).toBe(false);
    }
  });
});

describe('requireEnv', () => {
  it('names the missing variable', () => {
    expect(() => requireEnv({}, 'ARAMB_KEY')).toThrow('ARAMB_KEY is not set');
  });

  it('returns a set variable', () => {
    expect(requireEnv({ SUPPORT_AGENT_ID: 'agent-1' }, 'SUPPORT_AGENT_ID')).toBe('agent-1');
  });
});
