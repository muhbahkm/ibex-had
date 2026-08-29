import { sql } from './db.js';
import { config, OPERATORS } from './config.js';

const FUNCTION_MAP = Object.freeze({
  create_counterparty: 'ibex_had_mcp_create_counterparty',
  record_sale: 'ibex_had_mcp_record_sale',
  record_purchase: 'ibex_had_mcp_record_purchase',
  record_expense: 'ibex_had_mcp_record_expense',
  record_receipt: 'ibex_had_mcp_record_receipt',
  record_payment: 'ibex_had_mcp_record_payment'
});

function buildPayload(operation, args) {
  const operator = OPERATORS[args.operator];
  if (!operator) throw new Error(`Unknown operator: ${args.operator}`);

  return {
    operation,
    request_key: args.request_key,
    business_id: config.businessId,
    source: 'chatgpt_mcp',
    operator: {
      name: args.operator,
      ibex_user_id: operator.ibexUserId,
      auth_user_id: operator.authUserId
    },
    requested_at: new Date().toISOString(),
    data: Object.fromEntries(
      Object.entries(args).filter(([key]) => !['operator', 'request_key'].includes(key))
    )
  };
}

export async function invokeWriteOperation(operation, args) {
  if (!config.writeToolsEnabled) {
    return {
      blocked: true,
      code: 'write_tools_disabled',
      message: 'أدوات الكتابة المالية معطلة في هذه المرحلة. لم يتم تغيير أي بيانات.'
    };
  }

  const functionName = FUNCTION_MAP[operation];
  if (!functionName) throw new Error(`Unsupported operation: ${operation}`);

  const payload = buildPayload(operation, args);
  const payloadJson = JSON.stringify(payload);

  // Function names are selected exclusively from FUNCTION_MAP and never come from user input.
  const rows = await sql.unsafe(
    `select public.${functionName}($1::jsonb) as result`,
    [payloadJson]
  );

  return {
    blocked: false,
    operation,
    request_key: args.request_key,
    result: rows?.[0]?.result ?? null
  };
}
