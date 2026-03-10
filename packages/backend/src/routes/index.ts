import { FastifyInstance } from 'fastify';
import { uploadRoutes } from './upload';
import { planRoutes } from './plan';

export function registerRoutes(app: FastifyInstance) {
  app.register(uploadRoutes);
  app.register(planRoutes);

  // Health check endpoint
  app.get('/api/health', async () => ({ status: 'ok' }));
}
