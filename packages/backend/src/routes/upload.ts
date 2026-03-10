import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UploadResponse } from '@gala-planner/shared';
import { storage } from '../services/storage.js';
import { parseFile } from '../parsers/index.js';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/api/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    let data;
    try {
      data = await request.file();
    } catch {
      return reply.status(400).send({
        success: false,
        error: 'No file uploaded',
      } satisfies UploadResponse);
    }

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: 'No file uploaded',
      } satisfies UploadResponse);
    }

    try {

      // Validate file type
      const mimeType = data.mimetype;
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid file type: ${mimeType}. Allowed: PDF, XLSX, CSV`,
        } satisfies UploadResponse);
      }

      // Read file buffer
      const buffer = await data.toBuffer();

      // Parse the file
      const parseResult = await parseFile(buffer, data.filename, mimeType);

      // Store file and parse result
      storage.storeFile(parseResult.id, buffer);
      storage.storeParseResult(parseResult);

      request.log.info(
        { id: parseResult.id, fileName: data.filename, services: parseResult.services.length },
        'File parsed successfully'
      );

      return reply.status(200).send({
        success: true,
        data: parseResult,
      } satisfies UploadResponse);
    } catch (error) {
      request.log.error(error, 'Upload failed');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error during upload',
      } satisfies UploadResponse);
    }
  });

  // Get a specific parse result
  app.get('/api/uploads/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const result = storage.getParseResult(id);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: 'Upload not found',
      } satisfies UploadResponse);
    }

    return reply.status(200).send({
      success: true,
      data: result,
    } satisfies UploadResponse);
  });
}
