import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '../../src/config/config';
import { NullProvider } from '../../src/llm/null.provider';
import { PersonaRepository } from '../../src/repositories/persona.repository';
import { SessionStoreRepository } from '../../src/repositories/session-store.repository';
import { createJobProcessor } from '../../src/web/services/job-processor';
import type { Job } from '../../src/web/services/queue.service';
import type { WebContext } from '../../src/web/context';
import { silentLogger } from '../helpers/test-deps';

const LEAD = JSON.stringify({
  name: 'Jane',
  education: ['MBA @ Harvard University'],
  jobs: ['CTO @ Google'],
  skills: ['AI'],
});

describe('createJobProcessor (integration)', () => {
  let root: string;
  let ctx: WebContext;
  let sessionStore: SessionStoreRepository;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-'));
    sessionStore = new SessionStoreRepository(path.join(root, 'sessions'), silentLogger);
    ctx = {
      config: defaultConfig,
      logger: silentLogger,
      llm: new NullProvider(),
      sessionStore,
      personaRepo: new PersonaRepository(path.join(root, 'personas'), silentLogger),
    } as WebContext;
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function seedJob(personaId?: string): { job: Job; outputDir: string } {
    const dirs = sessionStore.ensure('s1');
    fs.writeFileSync(path.join(dirs.inputDir, 'f.json'), LEAD);
    return {
      job: {
        id: 'j1',
        sessionId: 's1',
        fileName: 'f.json',
        personaId,
        status: 'queued',
        progress: 0,
        logs: [],
        startTime: '',
      },
      outputDir: dirs.outputDir,
    };
  }

  it('should process the session file and write a result (no persona)', async () => {
    const { job, outputDir } = seedJob();
    await createJobProcessor(ctx)(job);
    expect(job.status).toBe('completed');
    expect(job.progress).toBe(100);
    const result = JSON.parse(fs.readFileSync(path.join(outputDir, 'f_result.json'), 'utf8'));
    expect(result.profile_name).toBe('Jane');
    expect(result.persona_fit).toBeUndefined();
  });

  it('should apply a configured persona', async () => {
    ctx.personaRepo.save('cto', { name: 'CTO', description: 'd', skills_must_have: ['AI'] });
    const { job, outputDir } = seedJob('cto');
    await createJobProcessor(ctx)(job);
    const result = JSON.parse(fs.readFileSync(path.join(outputDir, 'f_result.json'), 'utf8'));
    expect(result.persona_fit.persona_name).toBe('CTO');
  });

  it('should fall back to default scoring when the persona is missing', async () => {
    const { job, outputDir } = seedJob('ghost');
    await createJobProcessor(ctx)(job);
    const result = JSON.parse(fs.readFileSync(path.join(outputDir, 'f_result.json'), 'utf8'));
    expect(result.persona_fit).toBeUndefined();
    expect(job.status).toBe('completed');
  });
});
