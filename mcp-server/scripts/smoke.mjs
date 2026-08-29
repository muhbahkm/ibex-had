import { createHttpApp, createIbexMcpServer } from '../src/server.js';

const server = createIbexMcpServer();
if (!server) throw new Error('MCP server factory did not return a server.');

const app = createHttpApp();
await app.ready();
await app.close();

console.log('IBEX HAD MCP smoke test passed.');
