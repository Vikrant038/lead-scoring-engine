import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { defaultConfig } from '../../src/config/config';
import { ConfigService } from '../../src/config/config.service';
import { NullProvider } from '../../src/llm/null.provider';
import { OutreachEmailService } from '../../src/modules/outreach-email.service';
import { createProfiler } from '../../src/batch/run-batch';
import { FileHandlerRepository } from '../../src/repositories/file-handler.repository';
import { PersonaRepository } from '../../src/repositories/persona.repository';
import { SessionStoreRepository } from '../../src/repositories/session-store.repository';
import type { ProfileResult } from '../../src/domain/result.types';
import type { WebContext } from '../../src/web/context';
import {
  configPageController,
  resetConfigController,
  updateConfigController,
} from '../../src/web/controllers/config.controller';
import {
  currentPersonaController,
  deletePersonaController,
  listPersonasController,
  personaEditPageController,
  personasPageController,
  savePersonaController,
  setPersonaController,
  uploadPersonaController,
} from '../../src/web/controllers/persona.controller';
import {
  clearDataController,
  emailSettingsPageController,
  exportEmailsController,
  regenerateEmailController,
  saveEmailSettingsController,
} from '../../src/web/controllers/email.controller';
import { silentLogger } from '../helpers/test-deps';

const PERSONA = { name: 'CTO', description: 'tech leaders', skills_must_have: ['AI'] };
const LEAD = { name: 'Jane', education: ['MBA @ Harvard University'], jobs: ['CTO @ Google'] };

interface MockRes extends Response {
  statusCode: number;
  body: unknown;
  view?: string;
  viewData?: Record<string, unknown>;
  headers: Record<string, string>;
}

function mockRes(): MockRes {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    view: undefined as string | undefined,
    viewData: undefined as Record<string, unknown> | undefined,
    headers: {} as Record<string, string>,
    locals: { csrfToken: 'tok' },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    render(view: string, data: Record<string, unknown>) {
      this.view = view;
      this.viewData = data;
      return this;
    },
    attachment(name: string) {
      this.headers.contentDisposition = name;
      return this;
    },
    type(value: string) {
      this.headers.contentType = value;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as MockRes;
}

function req(overrides: Partial<Request> & { session?: Record<string, unknown> }): Request {
  return { session: {}, sessionID: 's1', params: {}, query: {}, body: {}, ...overrides } as Request;
}

describe('web controllers (unit)', () => {
  let root: string;
  let ctx: WebContext;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-'));
    const llm = new NullProvider();
    ctx = {
      configService: new ConfigService(defaultConfig),
      logger: silentLogger,
      llm,
      sessionStore: new SessionStoreRepository(path.join(root, 'sessions'), silentLogger),
      personaRepo: new PersonaRepository(path.join(root, 'personas'), silentLogger),
      emailGenerator: new OutreachEmailService(llm, silentLogger),
    } as WebContext;
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  describe('config', () => {
    it('renders the editor with current config JSON', () => {
      const res = mockRes();
      configPageController(ctx)(req({}), res, jest.fn());
      expect(res.view).toBe('config-editor');
      expect(String(res.viewData?.configJson)).toContain('scoring');
    });

    it('updates config on valid payload and reflects it immediately', () => {
      const next = jest.fn();
      const res = mockRes();
      const edited = { ...defaultConfig, processing: { batchDelayMs: 0, pollIntervalMs: 5000 } };
      updateConfigController(ctx)(req({ body: edited }), res, next);
      expect((res.body as { success: boolean }).success).toBe(true);
      expect(ctx.configService.get().processing.pollIntervalMs).toBe(5000);
    });

    it('forwards InvalidConfigError on a bad payload', () => {
      const next = jest.fn();
      updateConfigController(ctx)(req({ body: { nope: 1 } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_CONFIG' }));
    });

    it('resets config to defaults', () => {
      ctx.configService.update({
        ...defaultConfig,
        processing: { batchDelayMs: 9, pollIntervalMs: 9 },
      });
      const res = mockRes();
      resetConfigController(ctx)(req({}), res, jest.fn());
      expect((res.body as { config: typeof defaultConfig }).config.processing.batchDelayMs).toBe(
        defaultConfig.processing.batchDelayMs,
      );
    });
  });

  describe('personas', () => {
    function uploadFile(name: string, buffer: Buffer) {
      return req({ file: { originalname: name, buffer } as Express.Multer.File });
    }

    it('renders the personas page and the JSON list', () => {
      ctx.personaRepo.save('cto', PERSONA);
      const page = mockRes();
      personasPageController(ctx)(req({ session: { selectedPersona: 'cto' } }), page, jest.fn());
      expect(page.viewData?.selectedPersona).toBe('cto');
      const list = mockRes();
      listPersonasController(ctx)(req({}), list, jest.fn());
      expect((list.body as { personas: unknown[] }).personas).toHaveLength(1);
    });

    it('renders the edit page for an existing persona and 404s a missing one', () => {
      ctx.personaRepo.save('cto', PERSONA);
      const ok = mockRes();
      personaEditPageController(ctx)(req({ params: { id: 'cto' } }), ok, jest.fn());
      expect(ok.view).toBe('persona-edit');
      const next = jest.fn();
      personaEditPageController(ctx)(req({ params: { id: 'ghost' } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('saves a valid persona and forwards a validation error otherwise', () => {
      const ok = mockRes();
      savePersonaController(ctx)(req({ params: { id: 'cto' }, body: PERSONA }), ok, jest.fn());
      expect((ok.body as { success: boolean }).success).toBe(true);
      const next = jest.fn();
      savePersonaController(ctx)(
        req({ params: { id: 'bad' }, body: { name: '' } }),
        mockRes(),
        next,
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    });

    it('uploads a persona, rejects no-file and invalid JSON', () => {
      const ok = mockRes();
      uploadPersonaController(ctx)(
        uploadFile('cto.json', Buffer.from(JSON.stringify(PERSONA))),
        ok,
        jest.fn(),
      );
      expect((ok.body as { id: string }).id).toBe('cto');

      const noFile = jest.fn();
      uploadPersonaController(ctx)(req({}), mockRes(), noFile);
      expect(noFile).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_FAILED' }));

      const badJson = jest.fn();
      uploadPersonaController(ctx)(uploadFile('x.json', Buffer.from('{nope')), mockRes(), badJson);
      expect(badJson).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    });

    it('deletes a persona and 404s a missing one', () => {
      ctx.personaRepo.save('cto', PERSONA);
      const ok = mockRes();
      deletePersonaController(ctx)(req({ params: { id: 'cto' } }), ok, jest.fn());
      expect((ok.body as { success: boolean }).success).toBe(true);
      const next = jest.fn();
      deletePersonaController(ctx)(req({ params: { id: 'ghost' } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('sets the active persona and reports the current one', () => {
      const session: Record<string, unknown> = {};
      const ok = mockRes();
      setPersonaController()(req({ session, body: { personaId: 'cto' } }), ok, jest.fn());
      expect(session.selectedPersona).toBe('cto');

      const next = jest.fn();
      setPersonaController()(req({ session: {}, body: { personaId: 42 } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_FAILED' }));

      const cur = mockRes();
      currentPersonaController()(req({ session: { selectedPersona: 'cto' } }), cur, jest.fn());
      expect((cur.body as { personaId: string }).personaId).toBe('cto');
      const def = mockRes();
      currentPersonaController()(req({ session: {} }), def, jest.fn());
      expect((def.body as { personaId: string }).personaId).toBe('default-icp');
    });
  });

  describe('email + data', () => {
    async function seedResult(): Promise<ProfileResult> {
      const dirs = ctx.sessionStore.ensure('s1');
      fs.writeFileSync(path.join(dirs.inputDir, 'f.json'), JSON.stringify(LEAD));
      const fh = new FileHandlerRepository(dirs, ctx.logger);
      const [profile] = fh.readSingleFile('f.json');
      const result = await createProfiler(ctx.configService.get(), ctx.logger, ctx.llm).profile(
        profile,
      );
      fh.writeProfileResult(result);
      return result;
    }

    it('renders settings with defaults, then with saved values', () => {
      const def = mockRes();
      emailSettingsPageController()(req({ session: {} }), def, jest.fn());
      expect(def.viewData?.isDefault).toBe(true);
      const set = mockRes();
      const settings = { senderName: 'A', company: 'B', tone: 'warm' };
      emailSettingsPageController()(req({ session: { emailSettings: settings } }), set, jest.fn());
      expect(set.viewData?.isDefault).toBe(false);
    });

    it('saves valid email settings and forwards invalid ones', () => {
      const session: Record<string, unknown> = {};
      const ok = mockRes();
      saveEmailSettingsController(ctx)(
        req({ session, body: { senderName: 'A', company: 'B', tone: 'warm' } }),
        ok,
        jest.fn(),
      );
      expect(session.emailSettings).toEqual({ senderName: 'A', company: 'B', tone: 'warm' });
      const next = jest.fn();
      saveEmailSettingsController(ctx)(
        req({ session: {}, body: { senderName: '' } }),
        mockRes(),
        next,
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    });

    it('regenerates an email (null when AI is unavailable) honouring the tone query', async () => {
      const result = await seedResult();
      const res = mockRes();
      await regenerateEmailController(ctx)(
        req({
          params: { recordId: result._recordId },
          query: { tone: 'casual' },
          session: { userId: 's1' },
        }),
        res,
        jest.fn(),
      );
      expect((res.body as { success: boolean; email: unknown }).success).toBe(true);
      expect((res.body as { email: unknown }).email).toBeNull();

      // No tone query → falls back to the session/default tone (covers the other branch).
      const noTone = mockRes();
      await regenerateEmailController(ctx)(
        req({ params: { recordId: result._recordId }, query: {}, session: { userId: 's1' } }),
        noTone,
        jest.fn(),
      );
      expect((noTone.body as { success: boolean }).success).toBe(true);
    });

    it('404s regenerate when the result is missing', async () => {
      const next = jest.fn();
      await regenerateEmailController(ctx)(
        req({ params: { recordId: 'nope' }, query: {}, session: { userId: 's1' } }),
        mockRes(),
        next,
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('404s regenerate when the source profile can no longer be found', async () => {
      const dirs = ctx.sessionStore.ensure('s1');
      const orphan: ProfileResult = {
        _recordId: 'orphan',
        profile_name: 'Ghost',
        status: 'PROCESSED',
        bucket: 'HIGH',
        timestamp: new Date().toISOString(),
      };
      new FileHandlerRepository(dirs, ctx.logger).writeProfileResult(orphan);
      const next = jest.fn();
      await regenerateEmailController(ctx)(
        req({ params: { recordId: 'orphan' }, query: {}, session: { userId: 's1' } }),
        mockRes(),
        next,
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });

    it('exports drafts when present and a placeholder when absent', () => {
      const dirs = ctx.sessionStore.ensure('s1');
      const fh = new FileHandlerRepository(dirs, ctx.logger);
      const empty = mockRes();
      exportEmailsController(ctx)(req({ session: { userId: 's1' } }), empty, jest.fn());
      expect(empty.body).toContain('No email drafts available');

      fh.writeProfileResult({
        _recordId: 'r1',
        _sourceFile: 'f.json',
        profile_name: 'Jane',
        status: 'PROCESSED',
        bucket: 'HIGH',
        outreach_email: { subject: 'Hi', body: 'Body' },
        timestamp: new Date().toISOString(),
      });
      const filled = mockRes();
      exportEmailsController(ctx)(req({ session: { userId: 's1' } }), filled, jest.fn());
      expect(filled.body).toContain('Subject: Hi');
      expect(filled.headers.contentDisposition).toBe('outreach-emails.txt');
    });

    it('clears the session data silo and resets selections', () => {
      const dirs = ctx.sessionStore.ensure('s1');
      expect(fs.existsSync(dirs.base)).toBe(true);
      const session: Record<string, unknown> = {
        userId: 's1',
        selectedPersona: 'cto',
        emailSettings: {},
      };
      const res = mockRes();
      clearDataController(ctx)(req({ session }), res, jest.fn());
      expect(fs.existsSync(dirs.base)).toBe(false);
      expect(session.selectedPersona).toBeUndefined();
    });
  });
});
