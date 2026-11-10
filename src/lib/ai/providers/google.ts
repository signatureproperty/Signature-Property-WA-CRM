import { AiError, type ProviderResult } from '../types'
import { AI_PROVIDER_DEFAULT_MODEL, MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'
import { getT } from '@/lib/i18n/translate'

const t = getT('LibErrors')

const GOOGLE_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
// Gemini 3 reasoning models count internal thinking tokens against `max_tokens`,
// so leave extra headroom above MAX_OUTPUT_TOKENS to avoid truncating replies.
const GOOGLE_MAX_TOKENS = Math.max(MAX_OUTPUT_TOKENS, 2048)

interface GoogleGeminiResponse {
  choices?: { message?: { content?: string } }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

/**
 * Call Google Gemini API (via Google's official OpenAI-compatible Chat Completions endpoint)
 * with the account's own Gemini API Key.
 */
export async function generateGoogle(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  let res: Response
  try {
    res = await fetch(GOOGLE_GEMINI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || AI_PROVIDER_DEFAULT_MODEL.google,
        messages: [
          { role: 'system', content: systemPrompt },
          ...mergeConsecutive(messages),
        ],
        max_tokens: GOOGLE_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('Google Gemini', res)
  }

  const data = (await res.json().catch(() => null)) as GoogleGeminiResponse | null
  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiError(t('ai.emptyResponse', { provider: 'Google Gemini' }), {
      code: 'empty_response',
    })
  }
  const usage = normalizeUsage({
    prompt: data?.usage?.prompt_tokens,
    completion: data?.usage?.completion_tokens,
    total: data?.usage?.total_tokens,
  })

  return { text: text.trim(), usage }
}

