import { ArambError } from '@aramb-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GENERIC_MESSAGE, KNOWN_CODES, messageFor, statusFor, toClientError } from '../lib/errors';

const CODES = [
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'upstream_unavailable',
  'agent_not_published',
  'usage_upstream_unauthorized',
  'usage_upstream_unavailable',
  'out_of_credits',
  'connection_failed',
  'network_error',
  'session_closed',
  'bad_response',
  'invalid_options',
];

afterEach(() => vi.restoreAllMocks());

describe('messageFor', () => {
  it.each(CODES)('has its own message for %s', (code) => {
    expect(KNOWN_CODES).toContain(code);
    expect(messageFor(code)).not.toBe(GENERIC_MESSAGE);
    expect(messageFor(code).length).toBeGreaterThan(0);
  });

  it('uses the exact wording for conflict and out_of_credits', () => {
    expect(messageFor('conflict')).toBe('This account is being removed. Try again in a few minutes.');
    expect(messageFor('out_of_credits')).toBe('This service is out of credits. Please contact the company admin.');
  });

  it('falls back to the generic message for anything else', () => {
    expect(messageFor('something_new')).toBe(GENERIC_MESSAGE);
    expect(messageFor('toString')).toBe(GENERIC_MESSAGE);
  });
});

describe('toClientError', () => {
  it('keeps the SDK code and request id', () => {
    const err = new ArambError('conflict', 'raw gateway text', { status: 409, requestId: 'req-123' });
    expect(toClientError(err, 'test')).toEqual({
      code: 'conflict',
      message: 'This account is being removed. Try again in a few minutes.',
      requestId: 'req-123',
    });
  });

  it('omits an empty request id', () => {
    expect(toClientError(new ArambError('network_error', 'x'), 'test')).toEqual({
      code: 'network_error',
      message: messageFor('network_error'),
    });
  });

  it('logs an unmapped SDK code and shows the generic message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(toClientError(new ArambError('timeout', 'x', { requestId: 'r' }), 'test')).toEqual({
      code: 'timeout',
      message: GENERIC_MESSAGE,
      requestId: 'r',
    });
    expect(log).toHaveBeenCalled();
  });

  it('never passes a non-SDK error message or stack to the browser, and logs it', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = toClientError(new Error('secret internal detail'), 'test');
    expect(out).toEqual({ code: 'internal', message: GENERIC_MESSAGE });
    expect(JSON.stringify(out)).not.toContain('secret internal detail');
    expect(log).toHaveBeenCalledWith('[test] unexpected error', expect.any(Error));
  });
});

describe('statusFor', () => {
  it('maps codes to HTTP statuses', () => {
    expect(statusFor('not_found')).toBe(404);
    expect(statusFor('conflict')).toBe(409);
    expect(statusFor('bad_request')).toBe(400);
    expect(statusFor('internal')).toBe(500);
  });
});
