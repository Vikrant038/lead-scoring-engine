import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { defaultConfig } from '../../src/config/config';
import { ConfigService } from '../../src/config/config.service';
import { NullProvider } from '../../src/llm/null.provider';
import { OutreachEmailService } from '../../src/modules/outreach-email.service';
import { PersonaRepository } from '../../src/repositories/persona.repository';
import { SessionStoreRepository } from '../../src/repositories/session-store.repository';
import { QueueService } from '../../src/web/services/queue.service';
import { createJobProcessor } from '../../src/web/services/job-processor';
import { buildContext, createApp } from '../../src/web/server';
import type { WebContext } from '../../src/web/context';
import { silentLogger } from '../helpers/test-deps';
import { migrate } from '../../src/db/migrate';
import { BcryptAuthService } from '../../src/lib/auth/bcrypt-auth.service';

const LEAD = JSON.stringify({
  name: 'Jane',
  education: ['MBA @ Harvard University'],
  jobs: ['CTO @ Google'],
});

// Seed a known test user into SQLite before integration tests that need auth.
const TEST_EMAIL = 'testuser@example.com';
const TEST_PASSWORD = 'test-password-123';

async function seedTestUser(): Promise<void> {
  migrate();
  const svc = new BcryptAuthService();
  try {
    await svc.register(TEST_EMAIL, TEST_PASSWORD);
  } catch {
    // Already exists from a previous test run — that's fine.
  }
}

function buildTestApp(): { app: Express; root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'web-'));
  const config = {
    ...defaultConfig,
    paths: { ...defaultConfig.paths, personasDir: path.join(root, 'personas') },
  };
  const sessionStore = new SessionStoreRepository(path.join(root, 'sessions'), silentLogger);
  const personaRepo = new PersonaRepository(config.paths.personasDir, silentLogger);
  const llm = new NullProvider();
  const ctx = {
    configService: new ConfigService(config),
    logger: silentLogger,
    llm,
    sessionStore,
    personaRepo,
    emailGenerator: new OutreachEmailService(llm, silentLogger),
  } as WebContext;
  ctx.queue = new QueueService(createJobProcessor(ctx), silentLogger);
  return { app: createApp(ctx, 'test-secret'), root };
}

/**
 * Get a CSRF token from the login page (public route — no auth needed).
 */
async function getLoginCsrf(agent: request.SuperAgentTest): Promise<string> {
  const res = await agent.get('/auth/login');
  return /name="csrf-token" content="([^"]+)"/.exec(res.text)?.[1] ?? '';
}

/**
 * Login the agent as the test user and return the post-login CSRF token.
 */
async function loginAgent(agent: request.SuperAgentTest): Promise<string> {
  const token = await getLoginCsrf(agent);
  await agent
    .post('/auth/login')
    .set('X-CSRF-Token', token)
    .send(
      `_csrf=${encodeURIComponent(token)}&email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`,
    );
  // After login, get a fresh CSRF token from a protected page
  const home = await agent.get('/');
  return /name="csrf-token" content="([^"]+)"/.exec(home.text)?.[1] ?? '';
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

  beforeAll(async () => {
    await seedTestUser();
  });

  beforeEach(() => {
    ({ app, root } = buildTestApp());
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should render the login page with a CSRF token', async () => {
    const res = await request(app).get('/auth/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('name="csrf-token"');
    expect(res.headers['x-content-type-options']).toBe('nosniff'); // helmet
  });

  it('should redirect unauthenticated requests to /auth/login', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');
  });

  it('should render the upload page after login with a CSRF token and dropzone', async () => {
    const agent = request.agent(app);
    await loginAgent(agent);
    const res = await agent.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('name="csrf-token"');
    expect(res.text).toContain('id="dropzone"');
  });

  it('should echo a provided correlation id and generate one otherwise', async () => {
    const provided = await request(app).get('/auth/login').set('x-correlation-id', 'trace-123');
    expect(provided.headers['x-correlation-id']).toBe('trace-123');
    const generated = await request(app).get('/auth/login');
    expect(generated.headers['x-correlation-id']).toMatch(/[0-9a-f-]{36}/);
  });

  it('should serve a 404 page for unknown HTML routes', async () => {
    // Unauthenticated requests redirect to login (302), not 404.
    // After logging in, a truly unknown page returns 404.
    const agent = request.agent(app);
    await loginAgent(agent);
    const page = await agent.get('/totally-does-not-exist').set('Accept', 'text/html');
    expect(page.status).toBe(404);
  });

  it('should reject an upload without a CSRF token (GUARDRAILS 2.5)', async () => {
    const agent = request.agent(app);
    await loginAgent(agent);
    const res = await agent.post('/api/upload').attach('file', Buffer.from(LEAD), 'lead.json');
    expect(res.status).toBe(403);
  });

  it('should process an upload end-to-end and expose it in history + download', async () => {
    const agent = request.agent(app);
    const token = await loginAgent(agent);

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
    const token = await loginAgent(agent);

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
    const token = await loginAgent(agent);
    const res = await agent
      .post('/api/upload')
      .set('X-CSRF-Token', token)
      .attach('wrongField', Buffer.from(LEAD), 'lead.json');
    expect(res.status).toBe(400);
  });

  it('should 404 a missing or no-file upload', async () => {
    const agent = request.agent(app);
    const token = await loginAgent(agent);
    expect((await agent.get('/api/job/does-not-exist')).status).toBe(404);
    const noFile = await agent.post('/api/upload').set('X-CSRF-Token', token);
    expect(noFile.status).toBe(422); // ValidationError: no file
  });

  it('should list and sort multiple results in history', async () => {
    const agent = request.agent(app);
    const token = await loginAgent(agent);
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
    await loginAgent(agent);
    expect((await agent.get('/api/download/nope')).status).toBe(404);
  });

  it('should isolate sessions from each other (F-16)', async () => {
    // Alice and Bob register separate accounts for true isolation
    const svc = new BcryptAuthService();
    await svc.register('alice-iso@example.com', 'alice-pass-123').catch(() => {
      /* already exists */
    });
    await svc.register('bob-iso@example.com', 'bob-pass-123').catch(() => {
      /* already exists */
    });

    const alice = request.agent(app);
    const bob = request.agent(app);

    // Alice logs in
    const aliceCsrf1 = await getLoginCsrf(alice);
    await alice
      .post('/auth/login')
      .set('X-CSRF-Token', aliceCsrf1)
      .send(
        `_csrf=${encodeURIComponent(aliceCsrf1)}&email=alice-iso%40example.com&password=alice-pass-123`,
      );
    const aliceHome = await alice.get('/');
    const aliceToken = /name="csrf-token" content="([^"]+)"/.exec(aliceHome.text)?.[1] ?? '';

    const upload = await alice
      .post('/api/upload')
      .set('X-CSRF-Token', aliceToken)
      .attach('file', Buffer.from(LEAD), 'lead.json');
    const jobId = upload.body.jobId as string;
    await waitForJob(alice, jobId);

    // Bob logs in separately
    const bobCsrf1 = await getLoginCsrf(bob);
    await bob
      .post('/auth/login')
      .set('X-CSRF-Token', bobCsrf1)
      .send(
        `_csrf=${encodeURIComponent(bobCsrf1)}&email=bob-iso%40example.com&password=bob-pass-123`,
      );

    // Bob sees an empty queue/history and cannot read Alice's job or results
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
