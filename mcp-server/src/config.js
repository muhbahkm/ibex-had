const BUSINESS_ID = '4c424fea-a5fb-485f-b695-535eac647224';
const NEON_PROJECT_ID = 'misty-fog-32976945';

export const OPERATORS = Object.freeze({
  'محمد': Object.freeze({
    ibexUserId: 'b5aae5fe-d130-4174-ab28-c5672fd3ee21',
    authUserId: '038ad0c6-f332-4339-ae5a-a8944ac41f9f'
  }),
  'أنس': Object.freeze({
    ibexUserId: '6c79fef6-6ff4-4aaf-b671-189e31262e0f',
    authUserId: '0291b310-da4e-48af-952d-0bed16ed5f9d'
  })
});

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const config = Object.freeze({
  businessId: BUSINESS_ID,
  neonProjectId: NEON_PROJECT_ID,
  databaseUrl: process.env.DATABASE_URL || '',
  bearerToken: process.env.MCP_BEARER_TOKEN || '',
  writeToolsEnabled: bool(process.env.WRITE_TOOLS_ENABLED, false),
  allowedHosts: csv(process.env.MCP_ALLOWED_HOSTS || 'localhost,127.0.0.1'),
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development'
});

export function assertRuntimeConfig() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  if (config.nodeEnv === 'production' && !config.bearerToken) {
    throw new Error('MCP_BEARER_TOKEN is required in production until OAuth is enabled.');
  }

  if (config.nodeEnv === 'production' && config.allowedHosts.length === 0) {
    throw new Error('MCP_ALLOWED_HOSTS must contain at least one public hostname in production.');
  }
}
