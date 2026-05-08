import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { INTENT_SYSTEM_PROMPT, ParsedIntent } from '@/lib/prompts'

const FALLBACK: ParsedIntent = {
  capitalUSD: 1000,
  riskProfile: 'medium',
  durationDays: 30,
  summary: 'Balanced capital deployment across LP pools.'
}

export async function POST(req: NextRequest) {
  try {
    const { userMessage } = await req.json()

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { error: 'userMessage required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      console.error('[parse-intent] DEEPSEEK_API_KEY missing — using fallback')
      return NextResponse.json(FALLBACK)
    }

    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    })

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 256,
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed: ParsedIntent = JSON.parse(cleaned)

    if (
      typeof parsed.capitalUSD !== 'number' ||
      !['low', 'medium', 'high'].includes(parsed.riskProfile) ||
      typeof parsed.durationDays !== 'number' ||
      typeof parsed.summary !== 'string'
    ) throw new Error('Invalid shape from DeepSeek')

    return NextResponse.json(parsed)

  } catch (err) {
    console.error('[parse-intent] error:', err)
    return NextResponse.json(FALLBACK)
  }
}
