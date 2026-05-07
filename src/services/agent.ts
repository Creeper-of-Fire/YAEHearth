import OpenAI from 'openai'
import {useLogStore} from '@/stores/log'

const client = new OpenAI({
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
    baseURL: import.meta.env.VITE_DEEPSEEK_API_BASE,
    dangerouslyAllowBrowser: true,
})

/* ------------------------------------------------------------------ */
/* 共享工具                                                            */
/* ------------------------------------------------------------------ */

function stripThinkTags(text: string): string
{
    return text
        .replace(/<think[^>]*>[\s\S]*?<\/think\s*>/g, '')
        .replace(/<thought>[\s\S]*?<\/thought>/g, '')
        .trim()
}

export type ChatMsg = { role: string; content: string; name?: string }

/* ------------------------------------------------------------------ */
/* DeepSeek usage 类型                                                 */
/* ------------------------------------------------------------------ */

interface DeepSeekUsage
{
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_cache_hit_tokens: number
    prompt_cache_miss_tokens: number
}

export interface UsageSnapshot
{
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cacheHitTokens: number
    cacheMissTokens: number
}

function extractUsage(raw: Record<string, unknown> | undefined): UsageSnapshot | null
{
    if (!raw) return null
    const u = raw as unknown as DeepSeekUsage
    return {
        promptTokens: u.prompt_tokens ?? 0,
        completionTokens: u.completion_tokens ?? 0,
        totalTokens: u.total_tokens ?? 0,
        cacheHitTokens: u.prompt_cache_hit_tokens ?? 0,
        cacheMissTokens: u.prompt_cache_miss_tokens ?? 0,
    }
}

/* ------------------------------------------------------------------ */
/* DialogueRequest                                                     */
/* ------------------------------------------------------------------ */

export class DialogueRequest
{
    private _messages: ChatMsg[] = []

    withMessages(msgs: ChatMsg[]): this
    {
        this._messages = msgs
        return this
    }

    async execute(): Promise<{ text: string; usage: UsageSnapshot | null }>
    {
        const log = useLogStore()
        log.info(`生成对话 (model=${import.meta.env.VITE_MODEL}, messages=${this._messages.length})`)
        log.debug('对话提示词:\n' + this._messages.map((m, i) => `[${i}] ${m.role}: ${m.content}`).join('\n'))

        const resp = await client.chat.completions.create({
            model: import.meta.env.VITE_MODEL,
            messages: this._messages as OpenAI.ChatCompletionMessageParam[],
            temperature: 0.8,
            max_tokens: 512,
        })

        const raw = resp.choices[0]?.message?.content?.trim() ?? ''
        const text = this.parseResponse(raw)
        const usage = extractUsage(resp.usage as unknown as Record<string, unknown>)
        log.info(`对话响应: ${text.slice(0, 80)} (缓存命中: ${usage?.cacheHitTokens ?? '?'}/${usage?.promptTokens ?? '?'})`)
        return {text, usage}
    }

    parseResponse(raw: string): string
    {
        return stripThinkTags(raw) || '（沉默）'
    }
}

/* ------------------------------------------------------------------ */
/* MoodRequest                                                         */
/* ------------------------------------------------------------------ */

export class MoodRequest
{
    private _messages: ChatMsg[] = []

    withMessages(msgs: ChatMsg[]): this
    {
        this._messages = msgs
        return this
    }

    async execute(): Promise<{ mood: string | null; affectionDelta: number; usage: UsageSnapshot | null }>
    {
        const log = useLogStore()
        log.info(`分析情绪 (model=${import.meta.env.VITE_MODEL})`)
        log.debug('情绪提示词:\n' + this._messages.map((m, i) => `[${i}] ${m.role}: ${m.content}`).join('\n'))

        try
        {
            const resp = await client.chat.completions.create({
                model: import.meta.env.VITE_MODEL,
                messages: this._messages as OpenAI.ChatCompletionMessageParam[],
                temperature: 0.3,
                max_tokens: 100,
            })

            const raw = stripThinkTags(resp.choices[0]?.message?.content?.trim() ?? '')
            const usage = extractUsage(resp.usage as unknown as Record<string, unknown>)
            const parsed = this.parseResponse(raw)
            log.info(`情绪响应: ${raw.slice(0, 60)} (缓存命中: ${usage?.cacheHitTokens ?? '?'}/${usage?.promptTokens ?? '?'})`)
            return {...parsed, usage}
        } catch (e)
        {
            log.warn(`情绪更新失败: ${e}`)
            return {mood: null, affectionDelta: 0, usage: null}
        }
    }

    parseResponse(raw: string): { mood: string | null; affectionDelta: number }
    {
        try
        {
            const data = JSON.parse(raw)
            return {
                mood: (data.mood as string) ?? null,
                affectionDelta: Number(data.affection_delta ?? 0),
            }
        } catch
        {
            // fall through
        }

        const start = raw.indexOf('{')
        const end = raw.lastIndexOf('}') + 1
        if (start >= 0 && end > start)
        {
            try
            {
                const data = JSON.parse(raw.slice(start, end))
                return {
                    mood: (data.mood as string) ?? null,
                    affectionDelta: Number(data.affection_delta ?? 0),
                }
            } catch
            {
                // give up
            }
        }

        useLogStore().warn(`情绪解析失败: ${raw.slice(0, 60)}`)
        return {mood: null, affectionDelta: 0}
    }
}
