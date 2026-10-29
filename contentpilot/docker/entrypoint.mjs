import { spawn } from 'node:child_process';
import fs from 'node:fs';

const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
fs.mkdirSync(uploadDir, { recursive: true });

// .env uses 127.0.0.1, which inside a container is the container itself.
// Database traffic goes to the Postgres container named "postgres".
// Redis, if set, stays on the machine running Docker.
function replaceLoopbackHost(value, host) {
  if (!value) return value;
  return value.replace(
    /(^|@|\/\/)(127\.0\.0\.1|localhost)(?=[:/?#]|$)/gi,
    `$1${host}`,
  );
}

const useEmbeddedPg = /^(1|true|yes|on)$/i.test(process.env.USE_EMBEDDED_PG || '');
const databaseUrl = useEmbeddedPg
  ? process.env.DATABASE_URL
  : replaceLoopbackHost(process.env.DATABASE_URL, 'postgres');
const redisUrl = replaceLoopbackHost(process.env.REDIS_URL, 'host.docker.internal');

if (databaseUrl && databaseUrl !== process.env.DATABASE_URL) {
  console.log('[docker] DATABASE_URL host -> postgres');
}
if (redisUrl && redisUrl !== process.env.REDIS_URL) {
  console.log('[docker] REDIS_URL host -> host.docker.internal');
}

const apiEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
  API_HOST: process.env.API_HOST || '0.0.0.0',
  API_PORT: process.env.API_PORT || '4000',
  UPLOAD_DIR: uploadDir,
  USE_EMBEDDED_PG: process.env.USE_EMBEDDED_PG || 'false',
  ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  ...(redisUrl ? { REDIS_URL: redisUrl } : {}),
};

// Docker sets HOSTNAME to the container id, which makes Next bind the wrong
// interface. Force the web process only.
const webEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
  HOSTNAME: '0.0.0.0',
  PORT: process.env.PORT || '3000',
};

const api = spawn(process.execPath, ['/srv/api/apps/api/dist/index.js'], {
  stdio: 'inherit',
  env: apiEnv,
});

const web = spawn(process.execPath, ['apps/web/server.js'], {
  cwd: '/srv/web',
  stdio: 'inherit',
  env: webEnv,
});

let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of [api, web]) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code ?? 0), 8000).unref();
}

function onChildExit(code, signal) {
  if (stopping) return;
  const status = code ?? (signal ? 1 : 0);
  stop(status);
}

api.on('exit', onChildExit);
web.on('exit', onChildExit);

process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
