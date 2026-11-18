import { isArambError } from '@aramb-ai/sdk';

/** What the browser gets for any failure: a stable code, a readable message, the gateway request id when there is one. */
export interface ClientError {
  code: string;
  message: string;
  requestId?: string;
}

const MESSAGES: Readonly<Record<string, string>> = {
  bad_request: 'The request was not accepted. Please check what you sent and try again.',
  unauthorized: 'This app could not authenticate with aramb. Please contact the app owner.',
  forbidden: 'This app is not allowed to do that. Please contact the app owner.',
  not_found: 'That item was not found.',
  conflict: 'This account is being removed. Try again in a few minutes.',
  rate_limited: 'Too many requests right now. Please wait a moment and try again.',
  upstream_unavailable: 'The service is temporarily unavailable. Please try again shortly.',
  agent_not_published: 'This agent is not available yet. Please contact the app owner.',
  usage_upstream_unauthorized: 'Usage data could not be read. Please contact the app owner.',
  usage_upstream_unavailable: 'Usage data is temporarily unavailable. Please try again shortly.',
  out_of_credits: 'This service is out of credits. Please contact the company admin.',
  connection_failed: 'Could not connect to the agent. Please try again.',
  network_error: 'A network error interrupted the request. Please try again.',
  session_closed: 'The conversation was closed before the reply finished. Reload to see the latest messages.',
  bad_response: 'The service sent an unexpected answer. Please try again.',
  invalid_options: 'The request was not valid. Please contact the app owner.',
  unverified_email: 'Your Google account email is not verified, so it cannot be used to sign in.',
};

export const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/** Every code with its own message (the rest get {@link GENERIC_MESSAGE}). */
export const KNOWN_CODES: readonly string[] = Object.keys(MESSAGES);

export function messageFor(code: string): string {
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC_MESSAGE;
}

/**
 * Turn anything thrown on the server into a {@link ClientError}. An SDK error
 * keeps its code and request id; anything else is logged here with `context`
 * and reaches the browser only as a generic `internal` error (no stack, no
 * internal message).
 */
export function toClientError(err: unknown, context: string): ClientError {
  if (isArambError(err)) {
    const out: ClientError = { code: err.code, message: messageFor(err.code) };
    if (err.requestId) out.requestId = err.requestId;
    if (!Object.hasOwn(MESSAGES, err.code)) {
      console.error(`[${context}] aramb error with unmapped code`, err.code, err.requestId, err.message);
    }
    return out;
  }
  console.error(`[${context}] unexpected error`, err);
  return { code: 'internal', message: GENERIC_MESSAGE };
}

/** HTTP status for a {@link ClientError} returned from a route handler. */
export function statusFor(code: string): number {
  switch (code) {
    case 'bad_request':
    case 'invalid_options':
      return 400;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'rate_limited':
      return 429;
    case 'out_of_credits':
      return 402;
    case 'upstream_unavailable':
    case 'usage_upstream_unavailable':
    case 'connection_failed':
    case 'network_error':
      return 503;
    default:
      return 500;
  }
}
