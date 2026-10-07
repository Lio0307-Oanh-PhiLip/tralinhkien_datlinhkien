import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _postgresPool: Pool | undefined;
}

const isTransientDbError = (err: any): boolean => {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = String(err.code || '');
  return (
    msg.includes('connection terminated unexpectedly') ||
    msg.includes('connection closed') ||
    msg.includes('connection was closed') ||
    msg.includes('econnreset') ||
    msg.includes('epipe') ||
    msg.includes('etimedout') ||
    msg.includes('client was closed') ||
    msg.includes('socket closed') ||
    msg.includes('terminating connection') ||
    code === '57P01' || // admin shutdown
    code === '57P02' || // crash shutdown
    code === '57P03' || // cannot connect now
    code === '08006' || // connection failure
    code === '08001' || // unable to establish
    code === '08004'    // rejected
  );
};

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SQL_URL;
    const poolConfig = connectionString
      ? {
          connectionString,
          max: 10,
          connectionTimeoutMillis: 15000,
          idleTimeoutMillis: 10000,
          allowExitOnIdle: false,
          ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        }
      : {
          host: process.env.SQL_HOST || process.env.PGHOST || '127.0.0.1',
          user: process.env.SQL_USER || process.env.PGUSER || 'postgres',
          password: process.env.SQL_PASSWORD || process.env.PGPASSWORD || '',
          database: process.env.SQL_DB_NAME || process.env.PGDATABASE || 'postgres',
          port: Number(process.env.SQL_PORT || process.env.PGPORT) || 5432,
          max: 10,
          connectionTimeoutMillis: 15000,
          idleTimeoutMillis: 10000,
          allowExitOnIdle: false,
          ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        };

    const newPool = new Pool(poolConfig);

    newPool.on('error', (err: any) => {
      const msg = err?.message || String(err);
      if (isTransientDbError(err)) {
        // Expected idle disconnect handled by node-postgres pool
        console.warn('PostgreSQL idle client closed cleanly:', msg);
      } else {
        console.error('PostgreSQL pool unexpected error:', msg);
      }
    });

    // Wrap pool.query with auto-retry logic on transient disconnects (e.g. Cloud SQL scale-to-zero wakeups)
    const originalQuery = newPool.query.bind(newPool);
    (newPool as any).query = async function (this: any, ...args: any[]) {
      // If a callback is provided as the last argument, delegate directly to originalQuery
      if (typeof args[args.length - 1] === 'function') {
        return (originalQuery as Function)(...args);
      }

      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        try {
          attempts++;
          return await (originalQuery as Function)(...args);
        } catch (err: any) {
          if (isTransientDbError(err) && attempts < maxAttempts) {
            const delay = attempts * 250;
            console.warn(
              `[Cloud SQL] Transient connection drop (${err?.message || err}). Reconnecting & retrying query (attempt ${attempts}/${maxAttempts}) in ${delay}ms...`
            );
            await new Promise((res) => setTimeout(res, delay));
            continue;
          }
          throw err;
        }
      }
    };

    global._postgresPool = newPool;
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

