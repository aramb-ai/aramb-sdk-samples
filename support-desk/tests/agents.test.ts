import { describe, expect, it } from 'vitest';
import { agentLabelFor } from '../lib/agents';

const env = { SUPPORT_AGENT_ID: 'h_support', BILLING_AGENT_ID: 'h_billing' };

describe('agentLabelFor', () => {
  it('names the desk agents', () => {
    expect(agentLabelFor('h_support', env)).toBe('Support');
    expect(agentLabelFor('h_billing', env)).toBe('Billing');
  });

  it('never shows an unknown agent id', () => {
    expect(agentLabelFor('h_someone_else', env)).toBe('Other agent');
    expect(agentLabelFor('', {})).toBe('Other agent');
  });
});
