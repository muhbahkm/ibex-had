function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

export function ok(data, summary = 'تمت العملية بنجاح.') {
  const payload = { ok: true, ...data };
  return {
    content: [{ type: 'text', text: `${summary}\n${jsonText(payload)}` }],
    structuredContent: payload
  };
}

export function fail(code, message, details = undefined) {
  const payload = {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details })
    }
  };

  return {
    isError: true,
    content: [{ type: 'text', text: jsonText(payload) }],
    structuredContent: payload
  };
}

export function dbError(error) {
  const code = error?.code || 'database_error';

  if (code === '42883') {
    return fail(
      'database_contract_missing',
      'دالة التشغيل الذرية المطلوبة غير موجودة في قاعدة البيانات بعد. لم يتم إجراء أي كتابة مالية.',
      { postgres_code: code }
    );
  }

  if (code === '23505') {
    return fail(
      'duplicate_request',
      'رفضت قاعدة البيانات الطلب لأنه مكرر أو لأن request_key سبق استخدامه.',
      { postgres_code: code }
    );
  }

  return fail('database_error', 'فشل تنفيذ الطلب في PostgreSQL.', {
    postgres_code: code,
    message: error?.message || 'Unknown database error'
  });
}
