import postgres from 'postgres';
import { config } from './config.js';

export const sql = postgres(config.databaseUrl, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
  ssl: 'require',
  onnotice: false,
  connection: {
    application_name: 'ibex-had-accounting-mcp-v1'
  }
});

export async function closeDatabase() {
  await sql.end({ timeout: 5 });
}
