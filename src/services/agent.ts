import OpenAI from 'openai'
import { useLogStore } from '@/stores/log'

const client = new OpenAI({
  apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
  baseURL: import.meta.env.VITE_DEEPSEEK_API_BASE,
  dangerouslyAllowBrowser: true,
})

function stripThinkTags(text: string): string {
  return text
    .replace(/<think[^>]*>[\s\S]*?<\/think\s*>/g, '')
    .replace(/<thought>[\s\S]*?<\/thought>/g, '')
    .trim()
}

function parseMood(raw: string): { mood: string | null; affectionDelta: number } {
  const cleaned = stripThinkTags(raw)

  try {
    const data = JSON.parse(cleaned)
    return {
      mood: (data.mood as string) ?? null,
      affectionDelta: Number(data.affection_delta ?? 0),
    }
  } catch {
    // try extracting JSON substring
  }

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}') + 1
  if (start >= 0 && end > start) {
    try {
      const data = JSON.parse(cleaned.slice(start, end))
      return {
        mood: (data.mood as string) ?? null,
        affectionDelta: Number(data.affection_delta ?? 0),
      }
    } catch {
      // give up
    }
  }

  useLogStore().warn(`情绪解析失败: ${raw.slice(0, 60)}`)
  return { mood: null, affectionDelta: 0 }
}

type ChatMsg = { role: string; content: string; name?: string }

export async function generateDialogue(
  staticMessages: ChatMsg[],
  dynamicMessages: ChatMsg[],
): Promise<string> {
  const log = useLogStore()
  const messages = [...staticMessages, ...dynamicMessages]
  log.info(`Step 1: 生成对话 (model=${import.meta.env.VITE_MODEL}, messages=${messages.length})`)
  log.debug('对话全量提示词:\n' + messages.map((m, i) => `[${i}] ${m.role}: ${m.content}`).join('\n'))

  const resp = await client.chat.completions.create({
    model: import.meta.env.VITE_MODEL,
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    temperature: 0.8,
    max_tokens: 512,
  })

  const text = stripThinkTags(resp.choices[0]?.message?.content?.trim() ?? '')
  log.info(`LLM 对话响应: ${text.slice(0, 80)}`)
  return text
}

export async function analyzeMood(
  staticMessages: ChatMsg[],
  moodMessages: ChatMsg[],
): Promise<{ mood: string | null; affectionDelta: number }> {
  const log = useLogStore()
  const messages = [...staticMessages, ...moodMessages]
  log.info(`Step 2: 更新情绪 (messages=${messages.length})`)
  log.debug('情绪全量提示词:\n' + messages.map((m, i) => `[${i}] ${m.role}: ${m.content}`).join('\n'))

  try {
    const resp = await client.chat.completions.create({
      model: import.meta.env.VITE_MODEL,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      temperature: 0.3,
      max_tokens: 100,
    })

    const raw = stripThinkTags(resp.choices[0]?.message?.content?.trim() ?? '')
    log.info(`情绪响应: ${raw.slice(0, 60)}`)
    return parseMood(raw)
  } catch (e) {
    log.warn(`情绪更新失败: ${e}`)
    return { mood: null, affectionDelta: 0 }
  }
}
