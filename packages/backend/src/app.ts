import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { registerRoutes } from './routes/index';
import { config } from './config';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: config.corsOrigin,
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.maxFileSize,
    },
  });

  // Register routes
  registerRoutes(app);

  return app;
}
