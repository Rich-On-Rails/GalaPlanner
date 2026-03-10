import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app';
import { storage } from '../services/storage';
import type { FastifyInstance } from 'fastify';

describe('Upload API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
    storage.clear();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });
  });

  describe('POST /api/upload', () => {
    it('rejects request without file', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        success: false,
        error: 'No file uploaded',
      });
    });

    it('accepts CSV file and parses services', async () => {
      const boundary = '----TestBoundary';
      const csvContent =
        'Locomotive,Type,Origin,Destination,Depart,Arrive,Day\n4472 Flying Scotsman,steam,Pickering,Grosmont,09:00,09:45,2024-10-05';

      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test.csv"',
        'Content-Type: text/csv',
        '',
        csvContent,
        `--${boundary}--`,
      ].join('\r\n');

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });

      expect(response.statusCode).toBe(200);

      const result = response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.fileName).toBe('test.csv');
      expect(result.data.id).toBeDefined();
      expect(result.data.uploadedAt).toBeDefined();
      expect(result.data.services).toHaveLength(1);
      expect(result.data.stations).toHaveLength(2);
      expect(result.data.locomotives).toHaveLength(1);
      expect(result.data.services[0].departTime).toBe('09:00');
      expect(result.data.services[0].arriveTime).toBe('09:45');
      expect(result.data.locomotives[0].name).toBe('4472 Flying Scotsman');
      expect(result.data.locomotives[0].type).toBe('steam');
    });

    it('rejects invalid file types', async () => {
      const boundary = '----TestBoundary';

      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'Some text content',
        `--${boundary}--`,
      ].join('\r\n');

      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().success).toBe(false);
      expect(response.json().error).toContain('Invalid file type');
    });
  });

  describe('GET /api/uploads/:id', () => {
    it('returns 404 for non-existent upload', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/uploads/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        success: false,
        error: 'Upload not found',
      });
    });
  });
});
