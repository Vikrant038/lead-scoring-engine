/**
 * Builds the queue's job processor: profiles every lead in the uploaded file into the session's
 * output directory, updating progress and logs as it goes (F-10, F-16).
 */
import { createProfiler } from '../../batch/run-batch';
import { FileHandlerRepository } from '../../repositories/file-handler.repository';
import type { WebContext } from '../context';
import type { Job, JobProcessor } from './queue.service';

export function createJobProcessor(ctx: WebContext): JobProcessor {
  return async (job: Job): Promise<void> => {
    job.status = 'processing';
    job.logs.push('Processing started');

    const dirs = ctx.sessionStore.ensure(job.sessionId);
    const fileHandler = new FileHandlerRepository(dirs, ctx.logger);
    const profiler = createProfiler(ctx.configService.get(), ctx.logger, ctx.llm);
    const persona = resolvePersona(ctx, job.personaId);

    const profiles = fileHandler.readSingleFile(job.fileName);
    for (let index = 0; index < profiles.length; index += 1) {
      job.progress = Math.round((index / profiles.length) * 100);
      const result = await profiler.profile(profiles[index], {
        persona,
        emailSettings: job.emailSettings,
      });
      result._batchId = job.id;
      result._batchName = job.fileName.replace(/^\d+-/, '');
      fileHandler.writeProfileResult(result);
      job.logs.push(`✓ ${result.profile_name}: ${result.icp_score ?? result.status}`);
    }

    job.progress = 100;
    job.status = 'completed';
    job.endTime = new Date().toISOString();
    job.logs.push(`Completed ${profiles.length} profile(s)`);
  };
}

function resolvePersona(ctx: WebContext, personaId?: string) {
  if (!personaId || personaId === 'default-icp') {
    return undefined;
  }
  try {
    return ctx.personaRepo.get(personaId);
  } catch {
    ctx.logger.warn({ personaId }, 'persona not found; using default ICP scoring');
    return undefined;
  }
}
