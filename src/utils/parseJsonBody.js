import { AppError } from './AppError';

const MAX_JSON_BODY_BYTES = 16 * 1024;

/** Read JSON with a hard byte limit before handing it to Zod. */
export async function parseJsonBody(request, schema) {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new AppError('Request body is too large', 413);
  }

  if (!request.body) throw new AppError('Invalid JSON format', 400);
  const reader = request.body.getReader();
  const chunks = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_JSON_BODY_BYTES) {
        await reader.cancel();
        throw new AppError('Request body is too large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError('Invalid JSON format', 400);
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(
      `Validation Error: ${result.error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join(', ')}`,
      400,
    );
  }
  return result.data;
}
