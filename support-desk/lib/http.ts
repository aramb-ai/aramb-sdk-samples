import 'server-only';
import { NextResponse } from 'next/server';
import { statusFor, toClientError, type ClientError } from './errors';

/** JSON error response in the one shape the browser understands. */
export function errorResponse(error: ClientError, status = statusFor(error.code)): NextResponse {
  return NextResponse.json({ error }, { status });
}

export function unauthenticated(): NextResponse {
  return errorResponse({ code: 'unauthenticated', message: 'Please sign in.' }, 401);
}

export function badRequest(message: string): NextResponse {
  return errorResponse({ code: 'bad_request', message }, 400);
}

export function notFound(): NextResponse {
  return errorResponse({ code: 'not_found', message: 'Not found.' }, 404);
}

/** Map anything thrown by a route handler (logged with `context`). */
export function failure(err: unknown, context: string): NextResponse {
  return errorResponse(toClientError(err, context));
}
