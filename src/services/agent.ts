import OpenAI from 'openai'
import type { AgentResponse, SceneState } from '@/types/game'
import {
  buildChatMessages,
  buildDialoguePrompt,
  buildMoodMessages,
  MOOD_SYSTEM,
} from '@/services/prompts'
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

export async function generateResponse(state: SceneState): Promise<AgentResponse> {
  const log = useLogStore()
  const target = state.characters.find(c => c.id === state.selectedId)
  const speakerName = target?.name ?? '???'

  // Step 1: 生成对话 — 纯文本
  log.info(`Step 1: 生成对话 (model=${import.meta.env.VITE_MODEL})`)
  try {
    const dialoguePrompt = buildDialoguePrompt(state)
    const chatMessages = buildChatMessages(state)
    const resp = await client.chat.completions.create({
      model: import.meta.env.VITE_MODEL,
      messages: [
        { role: 'system', content: dialoguePrompt },
        ...chatMessages,
      ],
      temperature: 0.8,
      max_tokens: 512,
    })
    let text = stripThinkTags(resp.choices[0]?.message?.content?.trim() ?? '')
    log.info(`LLM 对话响应: ${text.slice(0, 80)}`)

    if (!text) {
      return { speaker: speakerName, text: '（沉默）', mood: null, affectionDelta: 0 }
    }

    // Step 2: 更新情绪 — 简短 JSON
    log.info('Step 2: 更新情绪')
    let mood: string | null = null
    let affectionDelta = 0
    try {
      const moodResp = await client.chat.completions.create({
        model: import.meta.env.VITE_MODEL,
        messages: [
          { role: 'system', content: MOOD_SYSTEM },
          ...buildMoodMessages(state, text),
        ],
        temperature: 0.3,
        max_tokens: 100,
      })
      const moodRaw = stripThinkTags(moodResp.choices[0]?.message?.content?.trim() ?? '')
      log.info(`情绪响应: ${moodRaw.slice(0, 60)}`)
      const parsed = parseMood(moodRaw)
      mood = parsed.mood
      affectionDelta = parsed.affectionDelta
    } catch (e) {
      log.warn(`情绪更新失败: ${e}`)
    }

    return { speaker: speakerName, text, mood, affectionDelta }
  } catch (e) {
    log.error(`Agent 调用失败: ${e}`)
    return { speaker: speakerName, text: '（沉默）', mood: null, affectionDelta: 0 }
  }
}
