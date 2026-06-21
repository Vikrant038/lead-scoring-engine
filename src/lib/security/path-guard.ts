/**
 * Path-traversal protection (SEC-05/06, GUARDRAILS 6.3).
 * User-supplied identifiers (e.g. recordId) are stripped to a bare filename and all resolved
 * paths are confined to a permitted base directory.
 */
import path from 'node:path';
import { ForbiddenError } from '../errors/domain-errors';

/**
 * Reduce an arbitrary user-supplied id to a safe filename component:
 * strips directory parts, separators and null bytes (SEC-05).
 */
export function sanitiseId(id: string): string {
  return path.basename(id).replace(/[/\\\0]/g, '');
}

/**
 * Build a per-record result filename from a (possibly hostile) recordId.
 * Example: `../../etc/passwd` -> `passwd_result.json`.
 */
export function resultFileName(recordId: string, suffix = '_result.json'): string {
  return `${sanitiseId(recordId)}${suffix}`;
}

/**
 * Resolve `segments` under `baseDir`, guaranteeing the result stays inside `baseDir` (SEC-06).
 * Each segment is first reduced to a bare filename. Throws ForbiddenError on escape attempts.
 */
export function resolveWithin(baseDir: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(baseDir);
  const safeSegments = segments.map((segment) => sanitiseId(segment));
  const target = path.resolve(resolvedBase, ...safeSegments);

  if (target !== resolvedBase && !target.startsWith(resolvedBase + path.sep)) {
    throw new ForbiddenError('access a path outside the permitted directory');
  }

  return target;
}
