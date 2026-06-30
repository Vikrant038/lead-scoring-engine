/**
 * Shared LLM provider logic: prompt construction, response parsing, and a timeout-guarded POST.
 * Concrete providers (Gemini, OpenAI) implement only `request()` (the raw text completion).
 */
import type { Profile } from '../domain/profile.types';
import type { OutreachEmail } from '../domain/result.types';
import type { Tier } from '../domain/scoring.types';
import type { Logger } from '../lib/logger/logger';
import { profileSchema } from '../schemas/profile.schema';
import type {
  EmailInput,
  ExplanationInput,
  GenerateProfilesInput,
  LLMClient,
  LlmResult,
} from './llm-client.interface';

const TIER_SYSTEM =
  "Classify the prestige tier of the following entity. Reply ONLY with 'tier_1', 'tier_2', 'tier_3', or 'unknown'.";
const EXPLANATION_SYSTEM =
  'You explain lead scores. Given the JSON details, produce a 2-4 sentence explanation in a ' +
  'friendly, professional tone referencing education, companies, skills, and component scores.';
const EMAIL_SYSTEM =
  'You draft outreach emails. Return ONLY a JSON object with string fields "subject" and "body".\n' +
  'Example:\n{\n  "subject": "Connecting on Distributed Systems",\n  "body": "Hi [Name],\\n\\nI came across your profile..."\n}\n' +
  'Important: Do NOT use double quotes (") inside the subject or body. Use single quotes (\') instead.\n' +
  'Adapt the tone as instructed.';

function parseTier(text: string): Tier {
  const lower = text.toLowerCase();
  if (lower.includes('tier_1')) return 'tier_1';
  if (lower.includes('tier_2')) return 'tier_2';
  if (lower.includes('tier_3')) return 'tier_3';
  return 'unknown';
}

/** Strip Markdown code fences an LLM may wrap JSON in. */
function stripFences(text: string): string {
  return text.replace(/```(?:json)?/gi, '').trim();
}

export abstract class BaseLlmProvider implements LLMClient {
  readonly available = true;

  constructor(
    protected readonly apiKey: string,
    protected readonly model: string,
    protected readonly timeoutMs: number,
    protected readonly logger: Logger,
  ) {}

  /** Provider-specific completion: send system+user prompts, return the assistant's raw text. */
  protected abstract request(system: string, user: string): Promise<LlmResult<string>>;

  async classifyUniversity(name: string, searchContext?: string): Promise<LlmResult<Tier>> {
    const context = searchContext ? `\nSearch Context:\n${searchContext}` : '';
    return this.classify(`University: ${name}${context}`);
  }

  async classifyCompany(name: string, searchContext?: string): Promise<LlmResult<Tier>> {
    const context = searchContext ? `\nSearch Context:\n${searchContext}` : '';
    return this.classify(`Company: ${name}${context}`);
  }

  async generateExplanation(input: ExplanationInput): Promise<LlmResult<string>> {
    const result = await this.request(EXPLANATION_SYSTEM, JSON.stringify(input));
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'no response' };
    }
    return { success: true, data: result.data.trim() };
  }

  async generateEmail(input: EmailInput): Promise<LlmResult<OutreachEmail>> {
    const result = await this.request(EMAIL_SYSTEM, JSON.stringify(input));
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'no response' };
    }
    try {
      const rawText = stripFences(result.data);
      const parsed = JSON.parse(rawText) as Partial<OutreachEmail>;
      if (typeof parsed.subject === 'string' && typeof parsed.body === 'string') {
        return { success: true, data: { subject: parsed.subject, body: parsed.body } };
      }
      this.logger.warn({ rawText, parsed }, 'email response missing subject/body');
      return { success: false, error: 'email response missing subject/body' };
    } catch (err) {
      this.logger.warn({ rawText: result.data, err }, 'failed to parse email JSON');
      return { success: false, error: 'failed to parse email JSON' };
    }
  }

  async generateProfiles(input: GenerateProfilesInput): Promise<LlmResult<Profile[]>> {
    const persona = input.personaDescription
      ? ` Roughly half should strongly match this persona: ${input.personaDescription}.`
      : '';
    const system =
      `Generate ${input.count} diverse synthetic lead profiles as a JSON array.${persona} ` +
      'Each profile has: name (string), education (array of "Degree @ University" strings), ' +
      'jobs (array of "Role @ Company" strings), skills (array of strings), and company_details ' +
      '{ name, category }. Vary education and company tiers. Return ONLY the JSON array.';
    const result = await this.request(system, `Generate ${input.count} profiles.`);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'no response' };
    }
    try {
      const raw = JSON.parse(stripFences(result.data));
      if (!Array.isArray(raw)) {
        return { success: false, error: 'expected a JSON array of profiles' };
      }
      const profiles = raw
        .map((entry) => profileSchema.safeParse(entry))
        .filter((parsed): parsed is { success: true; data: Profile } => parsed.success)
        .map((parsed) => parsed.data);
      if (profiles.length === 0) {
        return { success: false, error: 'no valid profiles generated' };
      }
      return { success: true, data: profiles };
    } catch {
      return { success: false, error: 'failed to parse profiles JSON' };
    }
  }

  private async classify(entity: string): Promise<LlmResult<Tier>> {
    const result = await this.request(TIER_SYSTEM, entity);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'no response' };
    }
    return { success: true, data: parseTier(result.data) };
  }

  /** Timeout-guarded JSON POST shared by providers. */
  protected async postJson(
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<LlmResult<unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        let details = '';
        try {
          details = await response.text();
        } catch {
          // ignore error reading response text
        }
        const errMsg = `HTTP ${response.status}${details ? ` - ${details}` : ''}`;
        this.logger.warn({ url, errMsg }, 'LLM API request failed');
        return { success: false, error: errMsg };
      }
      return { success: true, data: await response.json() };
    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error({ url, errMsg }, 'LLM API request encountered an error');
      return { success: false, error: errMsg };
    } finally {
      clearTimeout(timer);
    }
  }
}
