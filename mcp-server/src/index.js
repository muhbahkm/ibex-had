import { assertRuntimeConfig, config } from './config.js';
import { closeDatabase } from './db.js';
import { createHttpApp } from './server.js';

assertRuntimeConfig();

const app = createHttpApp();

async function shutdown(signal) {
  app.log.info({ signal }, 'Shutting down IBEX HAD MCP');
  try {
    await app.close();
    await closeDatabase();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.port, host: '0.0.0.0' });
