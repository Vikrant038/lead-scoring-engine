import request from 'supertest';
import { buildContext, createApp } from '../../src/web/server';
import { defaultConfig } from '../../src/config/config';
import { silentLogger } from '../helpers/test-deps';
import { NullProvider } from '../../src/llm/null.provider';

describe('server entry points', () => {
  it('buildContext constructs a valid WebContext', () => {
    const llm = new NullProvider();
    const ctx = buildContext(defaultConfig, silentLogger, llm);
    expect(ctx.configService).toBeTruthy();
    expect(ctx.llm).toBeTruthy();
    expect(ctx.sessionStore).toBeTruthy();
    expect(ctx.personaRepo).toBeTruthy();
    expect(ctx.emailGenerator).toBeTruthy();
    expect(ctx.queue).toBeTruthy();
  });

  it('createApp configures express and handles 404 for HTML and JSON', async () => {
    const llm = new NullProvider();
    const ctx = buildContext(defaultConfig, silentLogger, llm);
    const app = createApp(ctx, 'test-secret');

    // 1. JSON 404
    const resJson = await request(app)
      .get('/non-existent-api-path')
      .set('Accept', 'application/json');
    expect(resJson.status).toBe(404);
    expect(resJson.body).toEqual({
      success: false,
      error: { message: 'Not found', code: 'NOT_FOUND' },
    });

    // 2. HTML 404 (with stubs for res.locals values)
    const resHtml = await request(app).get('/non-existent-html-path').set('Accept', 'text/html');
    expect(resHtml.status).toBe(404);
    expect(resHtml.text).toContain('404');
  });
});
