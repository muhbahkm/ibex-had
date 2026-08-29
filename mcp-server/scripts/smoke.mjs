import { createHttpApp, createIbexMcpServer } from '../src/server.js';

const server = createIbexMcpServer();
if (!server) throw new Error('MCP server factory did not return a server.');

const app = createHttpApp();
await app.ready();

const health = await app.inject({ method: 'GET', url: '/healthz' });
if (health.statusCode !== 200) {
  throw new Error(`Health endpoint failed with ${health.statusCode}`);
}

const tools = await app.inject({
  method: 'POST',
  url: '/mcp',
  headers: {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream'
  },
  payload: {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  }
});

if (tools.statusCode !== 200) {
  throw new Error(`MCP tools/list failed with ${tools.statusCode}: ${tools.body}`);
}

if (!tools.body.includes('get_customer_statement') || !tools.body.includes('record_receipt')) {
  throw new Error(`Expected IBEX HAD tools were not advertised: ${tools.body}`);
}

await app.close();
console.log('IBEX HAD MCP Streamable HTTP smoke test passed.');
