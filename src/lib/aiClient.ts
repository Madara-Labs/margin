// ============================================================================
// Margin AI Client — Support for Google Gemini and Anthropic Claude
// Privacy-first:
// - API keys are stored in localStorage or read from sidecar environment.
// - Never logged to public telemetry or written to book files.
// - Only per-section excerpts are sent, never the full book.
// ============================================================================

export type AiProvider = 'gemini' | 'anthropic';

const GEMINI_STORAGE_KEY = 'margin_gemini_api_key';
const PROVIDER_STORAGE_KEY = 'margin_ai_provider';

const memoryStore: Record<string, string> = {};

function safeGet(key: string): string {
  try {
    const val = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (val !== null && val !== undefined) return val;
  } catch {
    // ignore
  }
  return memoryStore[key] || '';
}

function safeSet(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch {
    // ignore
  }
  memoryStore[key] = val;
}

function safeRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  delete memoryStore[key];
}

export function getStoredGeminiKey(): string {
  return safeGet(GEMINI_STORAGE_KEY);
}

export function setStoredGeminiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) {
    safeSet(GEMINI_STORAGE_KEY, trimmed);
  } else {
    safeRemove(GEMINI_STORAGE_KEY);
  }
}

export function getStoredProvider(): AiProvider {
  const val = safeGet(PROVIDER_STORAGE_KEY);
  return val === 'anthropic' ? 'anthropic' : 'gemini';
}

export function setStoredProvider(provider: AiProvider): void {
  safeSet(PROVIDER_STORAGE_KEY, provider);
}

export interface InstrumentRequestOptions {
  bookId: string;
  sectionId: string;
  method: string;
  sectionExcerpt: string;
  readerInput?: string;
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
}

export interface InstrumentResponse {
  id: string;
  status: 'completed' | 'cached_local' | 'error';
  model: string;
  provider: AiProvider;
  systemPrompt: string;
  userPrompt: string;
  sectionExcerptCharCount: number;
  responseText?: string;
  message?: string;
}

/**
 * Direct client-side Gemini API call for web/standalone use without sidecar
 */
export async function callGeminiDirect(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model = 'gemini-2.5-flash'
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  return parts.map((p: { text?: string }) => p.text || '').join('');
}

/**
 * Dispatches an instrument request via sidecar if reachable, or direct Gemini API fallback
 */
export async function generateInstrument(
  opts: InstrumentRequestOptions
): Promise<InstrumentResponse> {
  const provider = opts.provider || getStoredProvider();
  const apiKey = opts.apiKey || (provider === 'gemini' ? getStoredGeminiKey() : undefined);
  const model = opts.model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'claude-sonnet-4-20250514');

  const systemPrompt =
    'You are the instrument builder for Margin, a reader-first study tool. ' +
    'Never summarize the text for the reader to read instead of the book. ' +
    'Produce structured JSON instruments anchored to section page numbers so the reader\'s attempt comes first.';
  const userPrompt =
    `Book: ${opts.bookId} | Section: ${opts.sectionId} | Method: ${opts.method}\n` +
    `Reader attempt (if any): ${opts.readerInput || '(none yet — generating pre-attempt instrument)'}\n\n` +
    `Section Excerpt:\n${opts.sectionExcerpt.slice(0, 12000)}`;

  const logId = `plog-${Date.now()}`;

  // Try local sidecar first
  try {
    const res = await fetch('/api/llm/instrument', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: opts.bookId,
        sectionId: opts.sectionId,
        method: opts.method,
        sectionExcerpt: opts.sectionExcerpt,
        readerInput: opts.readerInput,
        apiKey,
        provider,
        model,
      }),
    });

    if (res.ok) {
      return (await res.json()) as InstrumentResponse;
    }
  } catch {
    // Sidecar offline, proceed to direct client fallback if Gemini key available
  }

  // Client-side direct fallback for Gemini
  if (provider === 'gemini' && apiKey) {
    try {
      const text = await callGeminiDirect(apiKey, systemPrompt, userPrompt, model);
      return {
        id: logId,
        status: 'completed',
        model,
        provider: 'gemini',
        systemPrompt,
        userPrompt,
        sectionExcerptCharCount: Math.min(opts.sectionExcerpt.length, 12000),
        responseText: text,
      };
    } catch (e: any) {
      return {
        id: logId,
        status: 'error',
        model,
        provider: 'gemini',
        systemPrompt,
        userPrompt,
        sectionExcerptCharCount: Math.min(opts.sectionExcerpt.length, 12000),
        message: e?.message || 'Direct Gemini call failed; using cached local instruments.',
      };
    }
  }

  // Default cached local fallback
  return {
    id: logId,
    status: 'cached_local',
    model,
    provider,
    systemPrompt,
    userPrompt,
    sectionExcerptCharCount: Math.min(opts.sectionExcerpt.length, 12000),
    message: 'No API key configured for Gemini or Anthropic; using verified cached section instruments.',
  };
}
