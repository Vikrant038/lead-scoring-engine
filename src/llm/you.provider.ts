/**
 * You.com Research API provider (Step 1).
 * Uses the You.com Research API with 'lite' effort for quick classifications and
 * 'deep' effort for grounded AI explanations and outreach email generation.
 * Enforces structured JSON outputs via output_schema.
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

export class YoucomProvider implements LLMClient {
  readonly available = true;

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly logger: Logger,
  ) {}

  private async callResearch(
    query: string,
    researchEffort: 'lite' | 'deep',
    outputSchema?: object,
  ): Promise<LlmResult<string>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const body: {
        query: string;
        research_effort: 'lite' | 'deep';
        output_schema?: object;
      } = {
        query,
        research_effort: researchEffort,
      };
      if (outputSchema) {
        body.output_schema = outputSchema;
      }
      this.logger.debug(
        { query, researchEffort, hasSchema: Boolean(outputSchema) },
        'calling You.com Research API',
      );
      const response = await fetch('https://api.you.com/v1/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      const data = (await response.json()) as {
        output?: { content?: string };
      };
      const content = data.output?.content;
      if (content === undefined || content === null) {
        return { success: false, error: 'empty response from You.com Research API' };
      }
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    } finally {
      clearTimeout(timer);
    }
  }

  async classifyUniversity(name: string, searchContext?: string): Promise<LlmResult<Tier>> {
    const schema = {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['tier_1', 'tier_2', 'tier_3'] },
      },
      required: ['tier'],
    };
    const context = searchContext ? `\nSearch Context:\n${searchContext}` : '';
    const query = `Classify the prestige tier of the university: "${name}". Tier 1 is Ivy League / Oxford / Stanford level. Tier 2 is top national universities. Tier 3 is others. Return a JSON object matching the schema.${context}`;
    const result = await this.callResearch(query, 'lite', schema);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    try {
      const parsed = JSON.parse(result.data);
      return { success: true, data: parsed.tier as Tier };
    } catch {
      return { success: false, error: 'failed to parse JSON response' };
    }
  }

  async classifyCompany(name: string, searchContext?: string): Promise<LlmResult<Tier>> {
    const schema = {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['tier_1', 'tier_2', 'tier_3'] },
      },
      required: ['tier'],
    };
    const context = searchContext ? `\nSearch Context:\n${searchContext}` : '';
    const query = `Classify the prestige tier of the company: "${name}". Tier 1 is FAANG / top global companies. Tier 2 is well-known mid-size or high-growth companies. Tier 3 is others. Return a JSON object matching the schema.${context}`;
    const result = await this.callResearch(query, 'lite', schema);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    try {
      const parsed = JSON.parse(result.data);
      return { success: true, data: parsed.tier as Tier };
    } catch {
      return { success: false, error: 'failed to parse JSON response' };
    }
  }

  async generateExplanation(input: ExplanationInput): Promise<LlmResult<string>> {
    const query = `Explain why the lead "${input.name}" got an ICP score of ${input.finalScore}/100 (bucket: ${input.bucket}, priority: ${input.priority}).
Details:
- Education: ${input.education.join(', ')}
- Companies: ${input.companies.join(', ')}
- Skills: ${input.skills.join(', ')}
- Component Scores: Education ${input.componentScores.education}%, Experience ${input.componentScores.experience}%, Thinking ${input.componentScores.thinking}%
Provide a friendly, professional 2-4 sentence explanation.`;
    return this.callResearch(query, 'deep');
  }

  async generateEmail(input: EmailInput): Promise<LlmResult<OutreachEmail>> {
    const schema = {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['subject', 'body'],
    };
    const query = `Draft a personalized outreach email to "${input.name}" (role: "${input.role}", company: "${input.company}", skills: "${input.skills.join(', ')}").
Our details:
- Sender Name: "${input.senderName}"
- Sender Company: "${input.senderCompany}"
- Tone: "${input.tone}"
Make it highly personalized using any recent public news or context about "${input.company}".`;
    const result = await this.callResearch(query, 'deep', schema);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    try {
      const parsed = JSON.parse(result.data) as OutreachEmail;
      return { success: true, data: parsed };
    } catch {
      return { success: false, error: 'failed to parse JSON response' };
    }
  }

  async generateProfiles(input: GenerateProfilesInput): Promise<LlmResult<Profile[]>> {
    const schema = {
      type: 'object',
      properties: {
        profiles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              education: { type: 'array', items: { type: 'string' } },
              jobs: { type: 'array', items: { type: 'string' } },
              skills: { type: 'array', items: { type: 'string' } },
              company_details: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                },
                required: ['name'],
              },
            },
            required: ['name'],
          },
        },
      },
      required: ['profiles'],
    };
    const persona = input.personaDescription
      ? ` matching the persona: "${input.personaDescription}"`
      : '';
    const query = `Generate ${input.count} diverse synthetic lead profiles${persona}.`;
    const result = await this.callResearch(query, 'lite', schema);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    try {
      const parsed = JSON.parse(result.data) as { profiles: Profile[] };
      const profiles = parsed.profiles
        .map((entry) => profileSchema.safeParse(entry))
        .filter((p): p is { success: true; data: Profile } => p.success)
        .map((p) => p.data);
      return { success: true, data: profiles };
    } catch {
      return { success: false, error: 'failed to parse JSON response' };
    }
  }
}
