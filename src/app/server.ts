import express from 'express';
import { AppContext } from './context';
import { bootstrap } from './bootstrap';
import { createHealthHandler } from './health';
import { createWebhookHandler } from '../google-chat/webhook';
import { SchedulerService } from '../scheduler/scheduler.service';
import { ReportService } from '../report/report.service';
import { getLogger } from '../utils/logger';
import { disconnectPrisma } from '../database/client';

const logger = getLogger('scheduler');

async function main(): Promise<void> {
  const ctx = new AppContext();
  logger.info('Application starting', { env: ctx.env.NODE_ENV });

  await bootstrap(ctx);

  const reports = new ReportService(ctx);
  const scheduler = new SchedulerService(ctx, () => reports.generateDaily());

  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.get('/health', createHealthHandler(ctx));
  app.post('/webhook', createWebhookHandler(ctx));

  const server = app.listen(ctx.env.PORT, () => {
    logger.info('HTTP server listening', { port: ctx.env.PORT });
    scheduler.start();
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('Shutting down', { signal });
    scheduler.stop();
    server.close();
    await disconnectPrisma();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: (err as Error).message });
  process.exit(1);
});
