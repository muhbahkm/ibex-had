import { createMcpFastifyApp } from '@modelcontextprotocol/fastify';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { config, OPERATORS } from './config.js';
import {
  findCounterparties,
  getCustomerStatement,
  getPayables,
  getReceivables,
  getReportingContract,
  getSupplierStatement,
  healthSnapshot
} from './read-service.js';
import { invokeWriteOperation } from './write-service.js';
import { dbError, fail, ok } from './results.js';

const currencySchema = z.enum(['YER', 'SAR', 'USD']);
const operatorSchema = z.enum(Object.keys(OPERATORS));
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const moneySchema = z.string().regex(/^\d+(?:\.\d+)?$/, 'Use a non-negative decimal string');
const positiveMoneySchema = z.string().regex(/^(?:0*[1-9]\d*)(?:\.\d+)?$|^0*\.\d*[1-9]\d*$/, 'Use a positive decimal string');
const requestKeySchema = z.string().min(12).max(160);
const uuidSchema = z.string().uuid();

function registerReadTools(server) {
  server.registerTool(
    'system_health',
    {
      description: 'تحقق من اتصال PostgreSQL وجاهزية طبقة التقارير v2 وعقود الكتابة دون تعديل أي بيانات.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        return ok({ health: await healthSnapshot() }, 'تم فحص طبقة IBEX HAD.');
      } catch (error) {
        return dbError(error);
      }
    }
  );

  server.registerTool(
    'find_counterparty',
    {
      description: 'ابحث عن عميل أو مورد في طبقة أدوار الأطراف v2 قبل تنفيذ أي حركة مالية.',
      inputSchema: z.object({
        query: z.string().min(2).max(120),
        limit: z.number().int().min(1).max(25).default(10)
      })
    },
    async ({ query, limit }) => {
      try {
        return ok({ matches: await findCounterparties(query, limit) }, 'تم البحث عن الطرف.');
      } catch (error) {
        return dbError(error);
      }
    }
  );

  const statementInput = z.object({
    party_id: uuidSchema,
    currency: currencySchema.optional(),
    period_from: dateSchema.optional(),
    period_to: dateSchema.optional()
  });

  server.registerTool(
    'get_customer_statement',
    {
      description: 'اقرأ كشف حساب عميل من طبقة التقارير المعيارية v2 فقط، مع التحقق من VERIFIED وdifference=0.',
      inputSchema: statementInput
    },
    async ({ party_id, currency, period_from, period_to }) => {
      try {
        const statement = await getCustomerStatement({
          partyId: party_id,
          currency,
          periodFrom: period_from,
          periodTo: period_to
        });
        return ok({ statement }, statement.official_statement_allowed ? 'الكشف VERIFIED.' : 'الكشف يحتاج مراجعة.');
      } catch (error) {
        return dbError(error);
      }
    }
  );

  server.registerTool(
    'get_supplier_statement',
    {
      description: 'اقرأ كشف حساب مورد من طبقة التقارير المعيارية v2 فقط، مع التحقق من VERIFIED وdifference=0.',
      inputSchema: statementInput
    },
    async ({ party_id, currency, period_from, period_to }) => {
      try {
        const statement = await getSupplierStatement({
          partyId: party_id,
          currency,
          periodFrom: period_from,
          periodTo: period_to
        });
        return ok({ statement }, statement.official_statement_allowed ? 'الكشف VERIFIED.' : 'الكشف يحتاج مراجعة.');
      } catch (error) {
        return dbError(error);
      }
    }
  );

  const summaryInput = z.object({
    currency: currencySchema.optional(),
    limit: z.number().int().min(1).max(500).default(100)
  });

  server.registerTool(
    'get_receivables',
    {
      description: 'اعرض من لنا عليهم باستخدام ibex_had_receivables_summary_v2 دون تجميع يدوي للحركات.',
      inputSchema: summaryInput
    },
    async ({ currency, limit }) => {
      try {
        return ok({ receivables: await getReceivables({ currency, limit }) }, 'تمت قراءة الذمم المدينة.');
      } catch (error) {
        return dbError(error);
      }
    }
  );

  server.registerTool(
    'get_payables',
    {
      description: 'اعرض من علينا لهم باستخدام ibex_had_payables_summary_v2 دون تجميع يدوي للحركات.',
      inputSchema: summaryInput
    },
    async ({ currency, limit }) => {
      try {
        return ok({ payables: await getPayables({ currency, limit }) }, 'تمت قراءة الذمم الدائنة.');
      } catch (error) {
        return dbError(error);
      }
    }
  );

  server.registerTool(
    'get_reporting_contract',
    {
      description: 'اقرأ عقد التقارير الحاكم من ibex_had_reporting_contracts.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        return ok({ contracts: await getReportingContract() }, 'تمت قراءة عقد التقارير.');
      } catch (error) {
        return dbError(error);
      }
    }
  );
}

function writeGuardResult(result) {
  if (result?.blocked) return fail(result.code, result.message);
  return ok({ write: result }, 'نجحت الكتابة الذرية وتولت قاعدة البيانات التحقق من العملية.');
}

function registerWriteTools(server) {
  const base = {
    request_key: requestKeySchema,
    operator: operatorSchema
  };

  server.registerTool(
    'create_counterparty',
    {
      description: 'أنشئ أو اربط طرفًا ماليًا عبر عقد قاعدة البيانات مع request_key ومنع التكرار.',
      inputSchema: z.object({
        ...base,
        name: z.string().min(2).max(160),
        role: z.enum(['customer', 'supplier', 'both']),
        phone: z.string().max(40).optional(),
        notes: z.string().max(1000).optional()
      })
    },
    async (args) => {
      try {
        return writeGuardResult(await invokeWriteOperation('create_counterparty', args));
      } catch (error) {
        return dbError(error);
      }
    }
  );

  const lineItemSchema = z.object({
    product_id: uuidSchema.optional(),
    product_name: z.string().min(1).max(160),
    quantity: positiveMoneySchema,
    unit_price: moneySchema,
    unit: z.string().max(80).optional(),
    notes: z.string().max(500).optional()
  });

  server.registerTool(
    'record_sale',
    {
      description: 'سجل فاتورة بيع كعملية محاسبية ذرية. لا يكتب الـMCP في الجداول مباشرة؛ يستدعي عقد PostgreSQL المسؤول عن الفاتورة والبنود والسداد والذمة والتدقيق.',
      inputSchema: z.object({
        ...base,
        customer_id: uuidSchema,
        currency: currencySchema,
        payment_status: z.enum(['cash', 'credit', 'partial']),
        paid_amount: moneySchema.default('0'),
        financial_account_id: uuidSchema.optional(),
        transaction_date: dateSchema.optional(),
        reference: z.string().max(160).optional(),
        notes: z.string().max(1000).optional(),
        items: z.array(lineItemSchema).min(1).max(100)
      })
    },
    async (args) => {
      try {
        return writeGuardResult(await invokeWriteOperation('record_sale', args));
      } catch (error) {
        return dbError(error);
      }
    }
  );

  server.registerTool(
    'record_purchase',
    {
      description: 'سجل فاتورة شراء كعملية محاسبية ذرية مع البنود والسداد والذمة والتدقيق.',
      inputSchema: z.object({
        ...base,
        supplier_id: uuidSchema,
        currency: currencySchema,
        payment_status: z.enum(['cash', 'credit', 'partial']),
        paid_amount: moneySchema.default('0'),
        financial_account_id: uuidSchema.optional(),
        transaction_date: dateSchema.optional(),
        reference: z.string().max(160).optional(),
        notes: z.string().max(1000).optional(),
        items: z.array(lineItemSchema).min(1).max(100)
      })
    },
    async (args) => {
      try {
        return writeGuardResult(await invokeWriteOperation('record_purchase', args));
      } catch (error) {
        return dbError(error);
      }
    }
  );

  server.registerTool(
    'record_expense',
    {
      description: 'سجل مصروفًا تشغيليًا عبر عقد قاعدة البيانات دون اختراع نوع حركة جديد داخل MCP.',
      inputSchema: z.object({
        ...base,
        amount: positiveMoneySchema,
        currency: currencySchema,
        financial_account_id: uuidSchema,
        description: z.string().min(2).max(1000),
        category: z.string().max(160).optional(),
        counterparty_id: uuidSchema.optional(),
        transaction_date: dateSchema.optional(),
        reference: z.string().max(160).optional()
      })
    },
    async (args) => {
      try {
        return writeGuardResult(await invokeWriteOperation('record_expense', args));
      } catch (error) {
        return dbError(error);
      }
    }
  );

  server.registerTool(
    'record_receipt',
    {
      description: 'سجل سند قبض من عميل مع الحساب المالي الصحيح وrequest_key، كعملية ذرية قابلة للتدقيق.',
      inputSchema: z.object({
        ...base,
        customer_id: uuidSchema,
        amount: positiveMoneySchema,
        currency: currencySchema,
        financial_account_id: uuidSchema,
        transaction_date: dateSchema.optional(),
        reference: z.string().max(160).optional(),
        notes: z.string().max(1000).optional()
      })
    },
    async (args) => {
      try {
        return writeGuardResult(await invokeWriteOperation('record_receipt', args));
      } catch (error) {
        return dbError(error);
      }
    }
  );

  server.registerTool(
    'record_payment',
    {
      description: 'سجل سند صرف لمورد مع الحساب المالي الصحيح وrequest_key، كعملية ذرية قابلة للتدقيق.',
      inputSchema: z.object({
        ...base,
        supplier_id: uuidSchema,
        amount: positiveMoneySchema,
        currency: currencySchema,
        financial_account_id: uuidSchema,
        transaction_date: dateSchema.optional(),
        reference: z.string().max(160).optional(),
        notes: z.string().max(1000).optional()
      })
    },
    async (args) => {
      try {
        return writeGuardResult(await invokeWriteOperation('record_payment', args));
      } catch (error) {
        return dbError(error);
      }
    }
  );
}

export function createIbexMcpServer() {
  const server = new McpServer({
    name: 'ibex-had-accounting',
    version: '0.1.0'
  });

  registerReadTools(server);
  registerWriteTools(server);
  return server;
}

function bearerAuthorized(header) {
  if (!config.bearerToken) return config.nodeEnv !== 'production';
  return header === `Bearer ${config.bearerToken}`;
}

export function createHttpApp() {
  const handler = createMcpHandler(() => createIbexMcpServer());
  const nodeHandler = toNodeHandler(handler);

  const app = createMcpFastifyApp({
    host: '0.0.0.0',
    allowedHosts: config.allowedHosts
  });

  app.get('/healthz', async () => ({
    ok: true,
    service: 'ibex-had-accounting-mcp',
    version: '0.1.0'
  }));

  app.all('/mcp', async (request, reply) => {
    if (!bearerAuthorized(request.headers.authorization)) {
      reply.code(401).header('WWW-Authenticate', 'Bearer realm="IBEX HAD MCP"');
      return { error: 'unauthorized' };
    }

    await nodeHandler(request.raw, reply.raw, request.body);
    return reply;
  });

  return app;
}
