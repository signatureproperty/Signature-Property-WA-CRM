import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractSearchTokens,
  stripCrmQueryMarker,
  answerCrmAssistantQuery,
} from './crm-assistant'
import type { AiConfig } from './types'

describe('extractSearchTokens', () => {
  it('filters Urdu and English stopwords while keeping property codes and names', () => {
    expect(
      extractSearchTokens('mujhe Bahria Town mein P-12 ya 5 Marla house ki details batao'),
    ).toEqual(['Bahria', 'Town', 'P-12', '5', 'Marla', 'house'])
  })

  it('preserves numeric phone digits', () => {
    expect(extractSearchTokens('03001234567 ka record dikhao')).toEqual(['03001234567'])
  })
})

describe('stripCrmQueryMarker', () => {
  it('strips CRM_QUERY tool markers cleanly', () => {
    expect(
      stripCrmQueryMarker('Result:\n[[CRM_QUERY:{"table":"listings","search":"Samanabad"}]]'),
    ).toBe('Result:')
  })
})

function mockSupabase(): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    ilike: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: [], count: 0, error: null }),
    then: (resolve: (val: { data: unknown[]; count: number; error: null }) => void) =>
      resolve({ data: [], count: 0, error: null }),
  }
  return {
    from: () => chain,
  } as unknown as SupabaseClient
}

const GOOGLE_CFG: AiConfig = {
  provider: 'google',
  model: 'gemini-3.5-flash-lite',
  baseUrl: null,
  apiKey: 'AQ.test-key',
  systemPrompt: null,
  isActive: true,
  autoReplyEnabled: false,
  autoReplyMaxPerConversation: 3,
  handoffAgentId: null,
  embeddingsApiKey: null,
}

describe('answerCrmAssistantQuery', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('returns direct AI answer grounded in CRM snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Aapke CRM mein total 1377 listings hain.' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await answerCrmAssistantQuery({
      db: mockSupabase(),
      accountId: 'acc-1',
      config: GOOGLE_CFG,
      messages: [{ role: 'user', content: 'kitni listings hain?' }],
    })

    expect(res.reply).toBe('Aapke CRM mein total 1377 listings hain.')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('executes one follow-up CRM_QUERY lookup when requested by the model', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '[[CRM_QUERY:{"table":"listings","search":"Samanabad"}]]',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Samanabad mein P-1 available hai.' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const res = await answerCrmAssistantQuery({
      db: mockSupabase(),
      accountId: 'acc-1',
      config: GOOGLE_CFG,
      messages: [{ role: 'user', content: 'Samanabad wale ghar batao' }],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(res.reply).toBe('Samanabad mein P-1 available hai.')
  })
})

