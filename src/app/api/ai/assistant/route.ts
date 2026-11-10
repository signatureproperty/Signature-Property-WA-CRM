import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadAiConfig } from '@/lib/ai/config'
import { answerCrmAssistantQuery } from '@/lib/ai/crm-assistant'
import { AiError, type ChatMessage } from '@/lib/ai/types'
import { getT } from '@/lib/i18n/translate'

const t = getT('Api')

const MAX_TURNS = 20

/**
 * POST /api/ai/assistant  (viewer+)
 *
 * Internal CRM AI Chat endpoint: answers team questions using live
 * account-scoped CRM records (property listings, contacts, deals,
 * conversations, and recent messages) via the configured AI provider.
 * Strictly read-only and RLS-scoped to the caller's account.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('viewer')

    const limit = checkRateLimit(`ai-assistant:${userId}`, RATE_LIMITS.aiDraft)
    if (!limit.success) return rateLimitResponse(limit)

    const accountLimit = checkRateLimit(
      `ai-assistant-acct:${accountId}`,
      RATE_LIMITS.aiDraftAccount,
    )
    if (!accountLimit.success) return rateLimitResponse(accountLimit)

    const body = await request.json().catch(() => null)
    const rawMessages = Array.isArray(body?.messages) ? body.messages : null
    if (!rawMessages) {
      return NextResponse.json({ error: t('ai.messagesRequired') }, { status: 400 })
    }

    const messages: ChatMessage[] = rawMessages
      .filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof m === 'object' &&
          ((m as ChatMessage).role === 'user' ||
            (m as ChatMessage).role === 'assistant') &&
          typeof (m as ChatMessage).content === 'string' &&
          (m as ChatMessage).content.trim().length > 0,
      )
      .slice(-MAX_TURNS)

    if (messages.length === 0) {
      return NextResponse.json(
        { error: t('ai.sendMessageToTest') },
        { status: 400 },
      )
    }

    const config = await loadAiConfig(supabase, accountId, {
      requireActive: false,
    }).catch((err) => {
      console.error('[ai/assistant] loadAiConfig error:', err)
      throw new AiError(t('ai.storedKeyUndecryptable'), {
        code: 'key_decrypt_failed',
        status: 400,
      })
    })

    if (!config) {
      return NextResponse.json(
        {
          error: t('ai.noAgentConfigured'),
          code: 'ai_not_configured',
        },
        { status: 400 },
      )
    }

    const { reply, snapshot } = await answerCrmAssistantQuery({
      db: supabase,
      accountId,
      config,
      messages,
    })

    return NextResponse.json({
      reply,
      stats: {
        listings: snapshot.listings.total,
        contacts: snapshot.contacts.total,
        deals: snapshot.deals.total,
        conversations: snapshot.conversations.total,
      },
    })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      )
    }
    return toErrorResponse(err)
  }
}

