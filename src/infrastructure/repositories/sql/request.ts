import "server-only";

import {
  getPool,
  sql,
  txStorage,
  withRetryOnRequest,
  type SqlRequest,
  type TxContext,
} from "./pool";

function txRequest(ctx: TxContext): SqlRequest {
  const request = withRetryOnRequest(new sql.Request(ctx.transaction));
  const origQuery = request.query.bind(request);
  const origBatch = request.batch.bind(request);

  request.query = ((command: Parameters<typeof request.query>[0]) => {
    const run = ctx.chain.then(() => origQuery(command));
    ctx.chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }) as typeof request.query;

  request.batch = ((command: Parameters<typeof request.batch>[0]) => {
    const run = ctx.chain.then(() => origBatch(command));
    ctx.chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }) as typeof request.batch;

  return request;
}

export async function sqlRequest(): Promise<SqlRequest> {
  const ctx = txStorage.getStore();
  if (ctx) return txRequest(ctx);
  const pool = await getPool();
  return withRetryOnRequest(pool.request());
}
