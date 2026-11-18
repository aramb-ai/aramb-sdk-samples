/**
 * Startup rules for configuration. Used by `next.config.ts` (so `next dev`,
 * `next build` and `next start` refuse a bad combination before serving
 * anything) and by the auth setup (so the dev login is only registered when
 * allowed).
 */
type Env = Readonly<Record<string, string | undefined>>;

const DEV_LOGIN_ENVS = new Set(['development', 'test']);

/**
 * `true` when the email-only dev login may be offered: `ALLOW_DEV_LOGIN=1` and
 * `NODE_ENV` is `development` or `test`. The flag with any other `NODE_ENV`
 * (unset, `production`, `staging`, …) throws: it must never reach a deployment.
 */
export function devLoginEnabled(env: Env): boolean {
  if (env.ALLOW_DEV_LOGIN !== '1') return false;
  if (!DEV_LOGIN_ENVS.has(env.NODE_ENV ?? '')) {
    throw new Error(
      `ALLOW_DEV_LOGIN=1 is only allowed when NODE_ENV is development or test (NODE_ENV is ${
        env.NODE_ENV ? `"${env.NODE_ENV}"` : 'unset'
      }). Unset ALLOW_DEV_LOGIN or set it to 0.`,
    );
  }
  return true;
}

/** Read a required variable or throw with its name. */
export function requireEnv(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set. See .env.example.`);
  return value;
}
