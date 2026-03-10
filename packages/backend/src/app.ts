import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { registerRoutes } from './routes/index.js';
import { config } from './config.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistDir = path.resolve(currentDir, '../../frontend/dist');

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

  // Serve built frontend when available (container/production runtime).
  if (existsSync(frontendDistDir)) {
    await app.register(fastifyStatic, {
      root: frontendDistDir,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api') && !request.url.includes('.')) {
        return reply.sendFile('index.html');
      }

      return reply.status(404).send({
        success: false,
        error: 'Not Found',
      });
    });
  }

  return app;
}
