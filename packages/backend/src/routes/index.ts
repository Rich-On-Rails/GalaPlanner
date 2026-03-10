import { FastifyInstance } from 'fastify';
import { uploadRoutes } from './upload.js';
import { planRoutes } from './plan.js';

export function registerRoutes(app: FastifyInstance) {
  app.register(uploadRoutes);
  app.register(planRoutes);

  // Health check endpoint
  app.get('/api/health', async () => ({ status: 'ok' }));
}
