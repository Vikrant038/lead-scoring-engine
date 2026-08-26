/**
 * In-memory sequential job queue (F-10). Jobs are processed one at a time by an injected
 * processor; a bounded backlog protects against overload (PERF-04).
 */
import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../lib/errors/domain-errors';
import type { EmailSettings } from '../../domain/result.types';
import type { Logger } from '../../lib/logger/logger';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface Job {
  id: string;
  sessionId: string;
  fileName: string;
  personaId?: string;
  /** Snapshot of the session's email settings taken at enqueue time (FR-14-009). */
  emailSettings?: EmailSettings;
  status: JobStatus;
  progress: number;
  logs: string[];
  startTime: string;
  endTime?: string;
}

export interface NewJob {
  sessionId: string;
  fileName: string;
  personaId?: string;
  emailSettings?: EmailSettings;
}

export type JobProcessor = (job: Job) => Promise<void>;

export class QueueService {
  private readonly items: Job[] = [];
  private processing = false;

  constructor(
    private readonly processor: JobProcessor,
    private readonly logger: Logger,
    private readonly maxPending = 50,
    private readonly maxRetained = 100,
  ) {}

  enqueue(newJob: NewJob): Job {
    const pending = this.items.filter((job) => job.status === 'queued').length;
    if (pending >= this.maxPending) {
      throw new ValidationError('queue', 'the processing queue is full, try again shortly');
    }
    const job: Job = {
      id: randomUUID(),
      sessionId: newJob.sessionId,
      fileName: newJob.fileName,
      personaId: newJob.personaId,
      emailSettings: newJob.emailSettings,
      status: 'queued',
      progress: 0,
      logs: [],
      startTime: new Date().toISOString(),
    };
    this.items.push(job);
    this.pruneOldJobs();
    void this.run();
    return job;
  }

  get(id: string, sessionId?: string): Job | undefined {
    const job = this.items.find((j) => j.id === id);
    if (!job) return undefined;
    if (sessionId && job.sessionId !== sessionId) return undefined;
    return job;
  }

  list(sessionId?: string): Job[] {
    if (sessionId) {
      return this.items.filter((job) => job.sessionId === sessionId);
    }
    return this.items;
  }

  private pruneOldJobs(): void {
    if (this.items.length <= this.maxRetained) {
      return;
    }
    // Evict oldest completed or errored jobs
    const finishedIndices: number[] = [];
    this.items.forEach((job, idx) => {
      if (job.status === 'completed' || job.status === 'error') {
        finishedIndices.push(idx);
      }
    });
    while (this.items.length > this.maxRetained && finishedIndices.length > 0) {
      const idxToRemove = finishedIndices.shift();
      if (idxToRemove !== undefined) {
        this.items.splice(idxToRemove, 1);
        // Adjust remaining indices
        for (let i = 0; i < finishedIndices.length; i++) {
          finishedIndices[i] -= 1;
        }
      }
    }
  }

  private async run(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    let next = this.items.find((job) => job.status === 'queued');
    while (next) {
      try {
        await this.processor(next);
      } catch (error) {
        next.status = 'error';
        next.endTime = new Date().toISOString();
        next.logs.push(`Error: ${(error as Error).message}`);
        this.logger.error({ jobId: next.id, error: (error as Error).message }, 'job failed');
      }
      next = this.items.find((job) => job.status === 'queued');
    }
    this.processing = false;
  }
}
