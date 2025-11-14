import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { server } from '../../../src/mocks/server';
import { http } from 'msw';

describe('MSW Integration Test', () => {
  beforeAll(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('should intercept and mock GET requests', async () => {
    // Use a simple mock handler
    server.use(
      http.get('/api/test', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ message: 'Hello from MSW!' }));
      })
    );

    const response = await fetch('/api/test');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Hello from MSW!');
  });

  it('should intercept and mock POST requests', async () => {
    server.use(
      http.post('/api/test', (req, res, ctx) => {
        return res(ctx.status(201), ctx.json({ received: true }));
      })
    );

    const response = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.received).toBe(true);
  });

  it('should handle error responses', async () => {
    server.use(
      http.get('/api/error', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Internal Server Error' }));
      })
    );

    const response = await fetch('/api/error');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal Server Error');
  });
});
