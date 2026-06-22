import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { defaultConfig } from '../../src/config/config';
import { NullProvider } from '../../src/llm/null.provider';
import { PersonaRepository } from '../../src/repositories/persona.repository';
import { SessionStoreRepository } from '../../src/repositories/session-store.repository';
import { QueueService } from '../../src/web/services/queue.service';
import { createJobProcessor } from '../../src/web/services/job-processor';
import { buildContext, createApp } from '../../src/web/server';
import type { WebContext } from '../../src/web/context';
import { silentLogger } from '../helpers/test-deps';

const LEAD = JSON.stringify({
  name: 'Jane',
  education: ['MBA @ Harvard University'],
  jobs: ['CTO @ Google'],
});

function buildTestApp(): { app: Express; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'web-'));
  const config = {
    ...defaultConfig,
    paths: { ...defaultConfig.paths, personasDir: path.join(root, 'personas') },
  };
  const sessionStore = new SessionStoreRepository(path.join(root, 'sessions'), silentLogger);
  const personaRepo = new PersonaRepository(config.paths.personasDir, silentLogger);
  const ctx = {
    config,
    logger: silentLogger,
    llm: new NullProvider(),
    sessionStore,
    personaRepo,
  } as WebContext;
  ctx.queue = new QueueService(createJobProcessor(ctx), silentLogger);
  return { app: createApp(ctx, 'test-secret'), root };
}

async function csrf(agent: request.SuperAgentTest): Promise<string> {
  const res = await agent.get('/');
  return /name="csrf-token" content="([^"]+)"/.exec(res.text)?.[1] ?? '';
}

async function waitForJob(
  agent: request.SuperAgentTest,
  jobId: string,
): Promise<Record<string, unknown>> {
  for (let i = 0; i < 50; i += 1) {
    const res = await agent.get(`/api/job/${jobId}`);
    if (res.body.status === 'completed' || res.body.status === 'error') {
      return res.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('job did not finish in time');
}

describe('web core (supertest)', () => {
  let app: Express;
  let root: string;

  beforeEach(() => {
    ({ app, root } = buildTestApp());
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should render the upload page with a CSRF token and dropzone', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('name="csrf-token"');
    expect(res.text).toContain('id="dropzone"');
    expect(res.headers['x-content-type-options']).toBe('nosniff'); // helmet
  });

  it('should echo a provided correlation id and generate one otherwise', async () => {
    const provided = await request(app).get('/').set('x-correlation-id', 'trace-123');
    expect(provided.headers['x-correlation-id']).toBe('trace-123');
    const generated = await request(app).get('/');
    expect(generated.headers['x-correlation-id']).toMatch(/[0-9a-f-]{36}/);
  });

  it('should reject an upload without a CSRF token (GUARDRAILS 2.5)', async () => {
    const agent = request.agent(app);
    await agent.get('/'); // mint session + token
    const res = await agent.post('/api/upload').attach('file', Buffer.from(LEAD), 'lead.json');
    expect(res.status).toBe(403);
  });

  it('should process an upload end-to-end and expose it in history + download', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);

    const upload = await agent
      .post('/api/upload')
      .set('X-CSRF-Token', token)
      .attach('file', Buffer.from(LEAD), 'lead.json');
    expect(upload.status).toBe(200);
    const jobId = upload.body.jobId as string;

    const job = await waitForJob(agent, jobId);
    expect(job.status).toBe('completed');
    expect(job.progress).toBe(100);

    const queue = await agent.get('/api/queue');
    expect(queue.body.jobs).toHaveLength(1);

    const history = await agent.get('/history');
    expect(history.text).toContain('Jane');
    const recordId = decodeURIComponent(/\/api\/download\/([^"]+)"/.exec(history.text)?.[1] ?? '');

    const download = await agent.get(`/api/download/${encodeURIComponent(recordId)}`);
    expect(download.status).toBe(200);
    expect(JSON.parse(download.text).profile_name).toBe('Jane');
  });

  it('should reject non-JSON (415) and structurally-invalid JSON (422) and malformed JSON (500)', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);

    const wrongType = await agent
      .post('/api/upload')
      .set('X-CSRF-Token', token)
      .attach('file', Buffer.from('hello'), 'notes.txt');
    expect(wrongType.status).toBe(415);

    const invalidShape = await agent
      .post('/api/upload')
      .set('X-CSRF-Token', token)
      .attach('file', Buffer.from(JSON.stringify({ notName: 1 })), 'bad.json');
    expect(invalidShape.status).toBe(422);

    const malformed = await agent
      .post('/api/upload')
      .set('X-CSRF-Token', token)
      .attach('file', Buffer.from('{not valid json'), 'broken.json');
    expect(malformed.status).toBe(500);
  });

  it('should return 400 for an unexpected upload field (multer error)', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const res = await agent
      .post('/api/upload')
      .set('X-CSRF-Token', token)
      .attach('wrongField', Buffer.from(LEAD), 'lead.json');
    expect(res.status).toBe(400);
  });

  it('should 404 a missing or no-file upload', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    expect((await agent.get('/api/job/does-not-exist')).status).toBe(404);
    const noFile = await agent.post('/api/upload').set('X-CSRF-Token', token);
    expect(noFile.status).toBe(422); // ValidationError: no file
  });

  it('should list and sort multiple results in history', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const batch = JSON.stringify([
      { name: 'Aaa', education: ['x'], jobs: ['y @ Z'] },
      { name: 'Bbb', education: ['x'], jobs: ['y @ Z'] },
    ]);
    const upload = await agent
      .post('/api/upload')
      .set('X-CSRF-Token', token)
      .attach('file', Buffer.from(batch), 'multi.json');
    await waitForJob(agent, upload.body.jobId as string);

    const history = await agent.get('/history');
    expect(history.text).toContain('Aaa');
    expect(history.text).toContain('Bbb');
  });

  it('should 404 a download for a non-existent record', async () => {
    const agent = request.agent(app);
    await agent.get('/');
    expect((await agent.get('/api/download/nope')).status).toBe(404);
  });

  it('should isolate sessions from each other (F-16)', async () => {
    const alice = request.agent(app);
    const bob = request.agent(app);
    const token = await csrf(alice);
    const upload = await alice
      .post('/api/upload')
      .set('X-CSRF-Token', token)
      .attach('file', Buffer.from(LEAD), 'lead.json');
    const jobId = upload.body.jobId as string;
    await waitForJob(alice, jobId);

    // Bob sees an empty queue/history and cannot read Alice's job or results
    await bob.get('/'); // establish Bob's session
    expect((await bob.get('/api/queue')).body.jobs).toHaveLength(0);
    expect((await bob.get(`/api/job/${jobId}`)).status).toBe(404);
    expect((await bob.get('/history')).text).not.toContain('Jane');
  });

  it('buildContext should wire a queue', () => {
    const ctx = buildContext(defaultConfig, silentLogger, new NullProvider());
    expect(ctx.queue).toBeDefined();
    expect(ctx.personaRepo).toBeDefined();
  });
});
