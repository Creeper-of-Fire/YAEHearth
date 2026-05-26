import OpenAI from 'openai'
import {useLogStore} from '@/features/shell/log-store'

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
        })

        const raw = resp.choices[0]?.message?.content ?? ''
        const text = this.parseResponse(raw)
        const usage = extractUsage(resp.usage as unknown as Record<string, unknown>)
        log.info(`对话响应: ${text} (缓存命中: ${usage?.cacheHitTokens ?? '?'}/${usage?.promptTokens ?? '?'})`)
        return {text, usage}
    }

    parseResponse(raw: string): string
    {
        return stripThinkTags(raw) || '（沉默）'
    }
}

/* ------------------------------------------------------------------ */
/* EditOperation — 通用字段编辑操作                                      */
/* ------------------------------------------------------------------ */

export type EditOp =
    | { op: 'set-string'; entity: string; path: string; value: any }
    | { op: 'adjust-number'; entity: string; path: string; delta: number }
    | { op: 'push-to-list'; entity: string; path: string; value: any }

/* ------------------------------------------------------------------ */
/* EditorRequest — 通用内容编辑                                          */
/* ------------------------------------------------------------------ */

export class EditorRequest
{
    private _messages: ChatMsg[] = []

    withMessages(msgs: ChatMsg[]): this
    {
        this._messages = msgs
        return this
    }

    async execute(): Promise<{ operations: EditOp[]; usage: UsageSnapshot | null }>
    {
        const log = useLogStore()
        log.info(`编辑字段 (model=${import.meta.env.VITE_MODEL})`)
        log.debug('编辑提示词:\n' + this._messages.map((m, i) => `[${i}] ${m.role}: ${m.content}`).join('\n'))

        try
        {
            const resp = await client.chat.completions.create({
                model: import.meta.env.VITE_MODEL,
                messages: this._messages as OpenAI.ChatCompletionMessageParam[],
                temperature: 0.3,
            })

            const raw = stripThinkTags(resp.choices[0]?.message?.content ?? '')
            const usage = extractUsage(resp.usage as unknown as Record<string, unknown>)
            const operations = this.parseResponse(raw)
            log.info(`编辑响应: ${raw} (${operations.length} ops, 缓存命中: ${usage?.cacheHitTokens ?? '?'}/${usage?.promptTokens ?? '?'})`)
            return {operations, usage}
        } catch (e)
        {
            log.warn(`字段编辑失败: ${e}`)
            return {operations: [], usage: null}
        }
    }

    parseResponse(raw: string): EditOp[]
    {
        // 尝试提取 JSON 数组
        let json = raw
        const arrStart = raw.indexOf('[')
        const arrEnd = raw.lastIndexOf(']') + 1
        if (arrStart >= 0 && arrEnd > arrStart)
        {
            json = raw.slice(arrStart, arrEnd)
        }

        try
        {
            const data = JSON.parse(json)
            if (!Array.isArray(data)) return []
            return data.filter((item: any): item is EditOp =>
            {
                if (!item || typeof item !== 'object') return false
                if (!item.op || typeof item.path !== 'string' || typeof item.entity !== 'string') return false
                if (item.op === 'set-string') return 'value' in item
                if (item.op === 'adjust-number') return typeof item.delta === 'number'
                if (item.op === 'push-to-list') return 'value' in item
                return false
            })
        } catch
        {
            useLogStore().warn(`编辑操作解析失败: ${raw}`)
            return []
        }
    }
}
