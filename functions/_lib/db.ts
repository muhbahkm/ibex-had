import { neon } from '@neondatabase/serverless';

export const DEFAULT_BUSINESS_ID = '4c424fea-a5fb-485f-b695-535eac647224';

export function getSql(env: Record<string, string | undefined>) {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(connectionString);
}

export function getBusinessId(env: Record<string, string | undefined>) {
  return env.IBEX_BUSINESS_ID || DEFAULT_BUSINESS_ID;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
