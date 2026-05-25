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

### 字段结构
frontmatter 是嵌套 YAML 结构，按类别分层组织。字段名使用中文。
通过点号路径定位深层字段（如 "属性.体力" 表示 {"属性": {"体力": ...}}）。

### 操作格式
只返回 JSON 数组，不包含任何其他文字。每项必须包含 entity 字段指定要编辑的角色 id。格式：
  - 设置值：{"op": "set", "entity": "角色id", "path": "状态.心情", "value": "愉快"}
  - 数值增减：{"op": "adjust", "entity": "角色id", "path": "属性.体力", "delta": -5}
  - 追加元素：{"op": "push", "entity": "角色id", "path": "日志.事件", "value": "触发了一段对话"}

### 创建规律
- path 按 "类别.子类别.字段名" 的规律组织
- 遇到尚未存在的路径时，按路径结构自动创建中间节点——数值字段从 0 开始累加，字符串字段用 set 直接写入
- 只修改确实需要变化的字段，与对话无关的字段不要动`

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

/** 递归展开嵌套 frontmatter 为 YAML 风格的缩进字符串 */
function formatFrontmatter(obj: Record<string, any>, indent: number = 0): string
{
    const pad = '  '.repeat(indent)
    const lines: string[] = []
    for (const [k, v] of Object.entries(obj))
    {
        if (k === 'id' || k === 'name') continue
        if (v && typeof v === 'object' && !Array.isArray(v))
        {
            lines.push(`${pad}${k}:`)
            lines.push(formatFrontmatter(v, indent + 1))
        } else
        {
            lines.push(`${pad}${k}: ${v}`)
        }
    }
    return lines.join('\n')
}

export function buildDialogueDynamic(
    target: ContentEntity,
    allCharacters: ContentEntity[]
): Array<{ role: 'system' | 'user'; content: string }>
{
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []

    const allStates = allCharacters.map(c =>
    {
        const meta = formatFrontmatter(c.frontmatter)
        return `### ${c.frontmatter.name ?? c.id}\n${meta}`
    }).join('\n\n')

    if (allStates)
    {
        messages.push({
            role: 'user',
            content: `## 当前状态\n${allStates}`,
        })
    }

    const name = target.frontmatter.name ?? target.id
    messages.push({
        role: 'user',
        content: `你正在扮演「${name}」进行对话。`,
    })

    return messages
}

/* ------------------------------------------------------------------ */
/* 动态部分 — 字段编辑                                                 */

/* ------------------------------------------------------------------ */

export function buildEditorDynamic(
    allCharacters: ContentEntity[],
    newDialogue: string,
): Array<{ role: 'system' | 'user'; content: string }>
{
    const characterList = allCharacters.map(c =>
    {
        const name = c.frontmatter.name ?? c.id
        return `- ${name} (id: ${c.id})`
    }).join('\n')

    return [
        {
            role: 'user',
            content: [
                '## 可编辑的角色',
                characterList,
                '',
                `刚刚的对话：「${newDialogue}」`,
                '',
                `**${buildModeIndicator('edit')}**`,
            ].join('\n'),
        },
    ]
}
