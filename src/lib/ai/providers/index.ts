// Shared types and provider registry

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  /** Token-by-token async generator */
  streamChat(messages: ChatMessage[], options?: StreamOptions): AsyncIterable<string>;
  /** Returns false if the provider has errored recently */
  isHealthy(): boolean;
  /** Called by router after a successful response */
  recordSuccess(): void;
  /** Called by router after a failure */
  recordFailure(reason: string): void;
}

/** Minimal shared health-tracking mixin — extend in each provider */
export class BaseProvider {
  protected _lastErrorAt: number | null = null;
  protected _cooldownMs = 60_000; // 1 min cooldown after failure

  isHealthy(): boolean {
    if (this._lastErrorAt === null) return true;
    return Date.now() - this._lastErrorAt > this._cooldownMs;
  }

  recordSuccess(): void {
    this._lastErrorAt = null;
  }

  recordFailure(_reason: string): void {
    this._lastErrorAt = Date.now();
  }
}

// Lazy-load all providers so missing API keys don't crash the import
let _registry: AIProvider[] | null = null;

export async function getProviderRegistry(): Promise<AIProvider[]> {
  if (_registry) return _registry;

  const [{ ClaudeProvider }, { OpenAIProvider }, { GeminiProvider }, { DeepSeekProvider }] =
    await Promise.all([
      import("./claude"),
      import("./openai"),
      import("./gemini"),
      import("./deepseek"),
    ]);

  _registry = [
    new ClaudeProvider(),
    new OpenAIProvider(),
    new GeminiProvider(),
    new DeepSeekProvider(),
  ];

  return _registry;
}

/** Parse AI_PROVIDER_PRIORITY env var, e.g. "claude,openai,gemini,deepseek" */
export function getPriorityList(): string[] {
  const raw = process.env.AI_PROVIDER_PRIORITY || "claude,openai,gemini,deepseek";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
