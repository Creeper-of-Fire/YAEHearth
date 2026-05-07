import {computed, type ComputedRef, shallowRef, triggerRef} from 'vue'
import type {Character} from '@/types/game'

/* ------------------------------------------------------------------ */
/* 工作模式                                                            */
/* ------------------------------------------------------------------ */

export type WorkMode = 'dialogue' | 'mood'

const WORK_MODE_LABELS: Record<WorkMode, string> = {
    dialogue: '对话演绎',
    mood: '情绪分析',
}

export function buildModeIndicator(mode: WorkMode): string
{
    return `[工作模式: ${WORK_MODE_LABELS[mode]}]`
}

/* ------------------------------------------------------------------ */
/* 系统提示 — 多模式统一（缓存核心）                                    */
/* ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `你是一个角色扮演引擎，能够以多种工作模式运行。

# 工作模式

在非对话模式下，每轮交互会通过 [工作模式: xxx] 标记指定当前激活的模式。严格遵循该模式的规则和输出格式。

## 对话演绎

如果用户未提及工作模式，则默认为对话演绎模式。
在对话演绎模式下，你根据场景和角色设定，自然地演绎角色对话。

规则：
- 只输出角色说的话，不加任何格式、标签、前缀、方括号、引号
- 保持角色的性格和说话方式
- 对话自然、生动，有角色个性
- 不替玩家说话
- 不使用 markdown 格式
- 其他角色有合理理由时可在对话中自然提及

## 情绪分析

在情绪分析模式下，你评估目标角色在对话中的心理状态变化。

规则：
- 只返回 JSON，不包含任何其他文字
- 格式：{"mood": "2-4个中文词描述心情", "affection_delta": 整数}
- mood：用2-4个中文词描述角色当前心情
- affection_delta：好感度变化量，范围 -1 到 1（-1 降低、0 不变、1 升高）`

/* ------------------------------------------------------------------ */
/* ContextEntry — 判别联合                                             */
/* ------------------------------------------------------------------ */

export type ContextEntry =
    | { type: 'system'; text: string }
    | { type: 'scene'; view: ComputedRef<string> }
    | { type: 'char-card'; view: ComputedRef<string>; charId: string; name: ComputedRef<string> }
    | { type: 'player'; text: string; name: string }
    | { type: 'assistant'; text: string; name: string }

/* ------------------------------------------------------------------ */
/* StaticContext — 响应式核心                                          */

/* ------------------------------------------------------------------ */

export interface DisplayMessage
{
    type: 'scene' | 'char-card' | 'player' | 'assistant'
    text: string
    name?: string
}

type ApiMessage = { role: 'system' | 'user' | 'assistant'; content: string; name?: string }

export class StaticContext
{
    // shallowRef 防止 ComputedRef 被深度解包
    entries = shallowRef<ContextEntry[]>([])
    readonly displayMessages = computed<DisplayMessage[]>(() =>
        this.entries.value
            .filter(e => e.type !== 'system')
            .map(e =>
            {
                switch (e.type)
                {
                    case 'scene':
                        return {type: 'scene', text: e.view.value}
                    case 'char-card':
                        return {type: 'char-card', text: e.view.value, name: e.name.value}
                    case 'player':
                        return {type: 'player', text: e.text, name: e.name}
                    case 'assistant':
                        return {type: 'assistant', text: e.text, name: e.name}
                }
            }),
    )
    private committedCount = 0

    get loadedCardIds(): string[]
    {
        return this.entries.value
            .filter((e): e is Extract<ContextEntry, { type: 'char-card' }> => e.type === 'char-card')
            .map(e => e.charId)
    }

    append(entry: ContextEntry): void
    {
        this.entries.value.push(entry)
        triggerRef(this.entries)
    }

    commit(): void
    {
        this.committedCount = this.entries.value.length
    }

    build(): ApiMessage[]
    {
        return this.entries.value.slice(0, this.committedCount).map(resolveForApi)
    }

    reset(): void
    {
        this.entries.value = []
        this.committedCount = 0
    }

    getRecentDialogue(count: number): Array<{ name: string; text: string }>
    {
        return this.entries.value
            .filter(
                (e): e is Extract<ContextEntry, { type: 'player' }> | Extract<ContextEntry, { type: 'assistant' }> =>
                    e.type === 'player' || e.type === 'assistant',
            )
            .slice(-count)
            .map(e => ({name: e.name, text: e.text}))
    }
}

/* ------------------------------------------------------------------ */
/* resolveForApi                                                       */

/* ------------------------------------------------------------------ */

function resolveForApi(e: ContextEntry): ApiMessage
{
    switch (e.type)
    {
        case 'system':
            return {role: 'system', content: e.text}
        case 'scene':
            return {role: 'system', content: e.view.value}
        case 'char-card':
            return {role: 'system', content: e.view.value}
        case 'player':
            return {role: 'user', content: e.text, name: e.name}
        case 'assistant':
            return {role: 'assistant', content: e.text, name: e.name}
    }
}

/* ------------------------------------------------------------------ */
/* 动态部分 — 对话                                                     */

/* ------------------------------------------------------------------ */

export function buildDialogueDynamic(
    target: Character,
    allCharacters: Character[]
): Array<{ role: 'system' | 'user'; content: string }>
{
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []

    const others = allCharacters
        .filter(c => c.id !== target.id)
        .map(c => `- ${c.name}（${c.role}）：心情 ${c.mood}`)
        .join('\n')

    if (others)
    {
        messages.push({
            role: 'user',
            content: `## 在场其他角色当前状态\n${others}`,
        })
    }

    messages.push(
        {
            role: 'user',
            content: `你正在扮演「${target.name}」进行对话。`,
        },
        {
            role: 'user',
            content: `## 当前状态：${target.name}\n心情：${target.mood}\n好感度：${target.affection}/5`,
        },
    )

    return messages
}

/* ------------------------------------------------------------------ */
/* 动态部分 — 情绪分析                                                 */

/* ------------------------------------------------------------------ */

export function buildMoodDynamic(
    target: Character,
    newDialogue: string,
): Array<{ role: 'system' | 'user'; content: string }>
{
    return [
        {
            role: 'user',
            content: `${target.name}刚刚说：「${newDialogue}」\n\n**${buildModeIndicator('mood')}**`,
        },
    ]
}
