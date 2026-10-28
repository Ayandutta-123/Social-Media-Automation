import { execSync } from 'child_process';
(async () => {
  execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'pipe', env: process.env });
  const { startApp } = await import('./src/server');
  await startApp();
})();
