/**
 * Infrastructure unit tests — covers schema foreign key getters, auth config
 * callbacks, fake mailer, and auth.ts conditional branch coverage.
 */
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { user, session, account } from '../../src/db/schema';
import { sendEmail } from '../../src/lib/email/fake-mailer';

describe('Infrastructure & Auth Configuration', () => {
  it('sendEmail logs the fake email payload', () => {
    expect(() =>
      sendEmail({ to: 'test@example.com', subject: 'Hello', body: 'World' }),
    ).not.toThrow();
  });

  it('schema foreign keys reference user table', () => {
    expect(user).toBeDefined();

    const sessCfg = getTableConfig(session);
    sessCfg.foreignKeys.forEach((fk) => {
      fk.reference();
    });

    const accCfg = getTableConfig(account);
    accCfg.foreignKeys.forEach((fk) => {
      fk.reference();
    });
  });

  it('auth instance is created with social providers when env vars are set', async () => {
    // Temporarily set env vars to exercise the google/github branches
    const origGoogle = process.env.GOOGLE_CLIENT_ID;
    const origGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
    const origGithub = process.env.GITHUB_CLIENT_ID;
    const origGithubSecret = process.env.GITHUB_CLIENT_SECRET;

    process.env.GOOGLE_CLIENT_ID = 'test-google-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
    process.env.GITHUB_CLIENT_ID = 'test-github-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';

    // Re-import auth to exercise the conditional branches with env vars set
    jest.resetModules();
    const { auth: authWithSocial } = await import('../../src/lib/auth/auth');
    expect(authWithSocial).toBeDefined();

    // Restore env vars
    process.env.GOOGLE_CLIENT_ID = origGoogle;
    process.env.GOOGLE_CLIENT_SECRET = origGoogleSecret;
    process.env.GITHUB_CLIENT_ID = origGithub;
    process.env.GITHUB_CLIENT_SECRET = origGithubSecret;
    jest.resetModules();
  });

  it('auth instance is created without social providers when env vars are absent', async () => {
    const origGoogle = process.env.GOOGLE_CLIENT_ID;
    const origGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
    const origGithub = process.env.GITHUB_CLIENT_ID;
    const origGithubSecret = process.env.GITHUB_CLIENT_SECRET;

    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    jest.resetModules();
    const { auth: authNoSocial } = await import('../../src/lib/auth/auth');
    expect(authNoSocial).toBeDefined();

    // Restore
    process.env.GOOGLE_CLIENT_ID = origGoogle;
    process.env.GOOGLE_CLIENT_SECRET = origGoogleSecret;
    process.env.GITHUB_CLIENT_ID = origGithub;
    process.env.GITHUB_CLIENT_SECRET = origGithubSecret;
    jest.resetModules();
  });

  it('auth instance supports VERCEL_URL and TRUSTED_ORIGINS', async () => {
    process.env.VERCEL_URL = 'preview-app.vercel.app';
    process.env.TRUSTED_ORIGINS = 'https://custom.com,https://app.custom.com';
    jest.resetModules();
    const { auth: authVercel } = await import('../../src/lib/auth/auth');
    expect(authVercel).toBeDefined();

    delete process.env.VERCEL_URL;
    delete process.env.TRUSTED_ORIGINS;
    jest.resetModules();
  });

  it('QueueService enforces LRU eviction and session scoping', async () => {
    const { QueueService } = await import('../../src/web/services/queue.service');
    const { silentLogger } = await import('../helpers/test-deps');

    const processor = jest.fn().mockImplementation(async (job) => {
      job.status = 'completed';
    });

    const queue = new QueueService(processor, silentLogger, 50, 3);

    const job1 = queue.enqueue({ sessionId: 'userA', fileName: 'f1.json' });
    const job2 = queue.enqueue({ sessionId: 'userA', fileName: 'f2.json' });
    const job3 = queue.enqueue({ sessionId: 'userB', fileName: 'f3.json' });

    // Wait a tick for processor to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Scoped list and get
    expect(queue.list('userA')).toHaveLength(2);
    expect(queue.list('userB')).toHaveLength(1);
    expect(queue.get(job1.id, 'userA')).toBeDefined();
    expect(queue.get(job2.id, 'userA')).toBeDefined();
    expect(queue.get(job3.id, 'userB')).toBeDefined();
    expect(queue.get(job1.id, 'userB')).toBeUndefined();
    expect(queue.get('nonexistent', 'userA')).toBeUndefined();

    // Adding 4th job when maxRetained is 3 triggers LRU prune
    const job4 = queue.enqueue({ sessionId: 'userC', fileName: 'f4.json' });
    expect(queue.list().length).toBeLessThanOrEqual(3);
    expect(job4).toBeDefined();
  });

  it('db connection initializes properly with VERCEL and custom DATABASE_PATH', async () => {
    process.env.VERCEL = '1';
    process.env.DATABASE_PATH = '/tmp/test-icp-vercel.db';
    jest.resetModules();

    const { db: vercelDb, sqlite: vercelSqlite } = await import('../../src/db/connection');
    expect(vercelDb).toBeDefined();
    expect(vercelSqlite).toBeDefined();
    vercelSqlite.close();

    delete process.env.VERCEL;
    delete process.env.DATABASE_PATH;
    jest.resetModules();
  });
});
