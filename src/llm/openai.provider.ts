/**
 * OpenAI provider (chat completions REST API).
 */
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

export class OpenAIProvider extends OpenAiCompatibleProvider {
  protected readonly endpointUrl = 'https://api.openai.com/v1/chat/completions';
  protected get providerName(): string {
    return 'OpenAI';
  }
}
