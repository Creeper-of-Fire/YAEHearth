import {computed, type ComputedRef, shallowRef, triggerRef} from 'vue'
import type {ContentEntity} from '@/content/types'

/* ------------------------------------------------------------------ */
/* 工作模式                                                            */
/* ------------------------------------------------------------------ */

export type WorkMode = 'dialogue' | 'edit'

const WORK_MODE_LABELS: Record<WorkMode, string> = {
    dialogue: '对话演绎',
    edit: '字段编辑',
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

## 字段编辑

在字段编辑模式下，你根据对话内容判断角色的哪些 frontmatter 字段需要更新。

规则：
- 只返回 JSON 数组，不包含任何其他文字
- 每项格式取决于字段类型：
  - 字符串字段：{"op": "set", "field": "字段名", "value": "新值"}
  - 数字字段：{"op": "adjust", "field": "字段名", "delta": 变化量}
- 只修改确实需要变化的字段`

/* ------------------------------------------------------------------ */
/* 工作区系统提示词                                                     */
/* ------------------------------------------------------------------ */

export async function fetchWorkspacePrompt(startDir?: string): Promise<string>
{
    try
    {
        const params = startDir ? `?startDir=${encodeURIComponent(startDir)}` : ''
        const res = await fetch(`/__content/system_prompt${params}`)
        if (!res.ok) return ''
        const data = await res.json()
        return data.text ?? ''
    }
    catch
    {
        return ''
    }
}

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
    target: ContentEntity,
    allCharacters: ContentEntity[]
): Array<{ role: 'system' | 'user'; content: string }>
{
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []

    function describe(e: ContentEntity): string
    {
        const meta = Object.entries(e.frontmatter)
            .filter(([k]) => k !== 'id')
            .map(([k, v]) => `${k}: ${v}`)
            .join('，')
        return `${e.frontmatter.name ?? e.id}${meta ? `（${meta}）` : ''}`
    }

    const others = allCharacters
        .filter(c => c.id !== target.id)
        .map(c => `- ${describe(c)}`)
        .join('\n')

    if (others)
    {
        messages.push({
            role: 'user',
            content: `## 在场其他角色当前状态\n${others}`,
        })
    }

    const name = target.frontmatter.name ?? target.id
    const selfMeta = Object.entries(target.frontmatter)
        .filter(([k]) => k !== 'id' && k !== 'name')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')

    messages.push(
        {
            role: 'user',
            content: `你正在扮演「${name}」进行对话。`,
        },
        {
            role: 'user',
            content: `## 当前状态：${name}\n${selfMeta}`,
        },
    )

    return messages
}

/* ------------------------------------------------------------------ */
/* 动态部分 — 字段编辑                                                 */

/* ------------------------------------------------------------------ */

export function buildEditorDynamic(
    target: ContentEntity,
    newDialogue: string,
): Array<{ role: 'system' | 'user'; content: string }>
{
    const name = target.frontmatter.name ?? target.id
    const currentFields = Object.entries(target.frontmatter)
        .filter(([k]) => k !== 'id')
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n')

    return [
        {
            role: 'user',
            content: [
                `## 需要编辑的角色：${name}`,
                `刚刚的对话：「${newDialogue}」`,
                '',
                '当前字段值：',
                currentFields,
                '',
                `**${buildModeIndicator('edit')}**`,
            ].join('\n'),
        },
    ]
}
