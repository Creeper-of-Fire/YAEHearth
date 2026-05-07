import { shallowRef, triggerRef, computed, type ComputedRef } from 'vue'
import type { SceneState } from '@/types/game'

/* ------------------------------------------------------------------ */
/* 静态系统提示                                                        */
/* ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `你是一个角色扮演 AI。你的任务是根据场景和角色设定，自然地演绎角色对话。

## 写作规则
- 只输出角色说的话，不要加任何格式、标签、前缀、方括号、引号
- 保持角色的性格和说话方式
- 对话要自然、生动，有角色个性
- 不要替玩家说话
- 不要使用 markdown 格式
- 如果其他角色有合理的插话理由，可以在对话中自然提及他们`

/* ------------------------------------------------------------------ */
/* ContextEntry — 判别联合                                             */
/* ------------------------------------------------------------------ */

export type ContextEntry =
  | { type: 'system';    text: string }
  | { type: 'scene';     view: ComputedRef<string> }
  | { type: 'char-card'; view: ComputedRef<string>; charId: string; name: ComputedRef<string> }
  | { type: 'player';    text: string; name: string }
  | { type: 'assistant'; text: string; name: string }

/* ------------------------------------------------------------------ */
/* StaticContext — 响应式核心                                          */
/* ------------------------------------------------------------------ */

export interface DisplayMessage {
  type: 'scene' | 'char-card' | 'player' | 'assistant'
  text: string
  name?: string
}

type ApiMessage = { role: 'system' | 'user' | 'assistant'; content: string; name?: string }

export class StaticContext {
  // shallowRef 防止 ComputedRef 被深度解包
  entries = shallowRef<ContextEntry[]>([])
  private committedCount = 0

  readonly displayMessages = computed<DisplayMessage[]>(() =>
    this.entries.value
      .filter(e => e.type !== 'system')
      .map(e => {
        switch (e.type) {
          case 'scene':
            return { type: 'scene', text: e.view.value }
          case 'char-card':
            return { type: 'char-card', text: e.view.value, name: e.name.value }
          case 'player':
            return { type: 'player', text: e.text, name: e.name }
          case 'assistant':
            return { type: 'assistant', text: e.text, name: e.name }
        }
      }),
  )

  append(entry: ContextEntry): void {
    this.entries.value.push(entry)
    triggerRef(this.entries)
  }

  commit(): void {
    this.committedCount = this.entries.value.length
  }

  build(): ApiMessage[] {
    return this.entries.value.slice(0, this.committedCount).map(resolveForApi)
  }

  reset(): void {
    this.entries.value = []
    this.committedCount = 0
  }

  get loadedCardIds(): string[] {
    return this.entries.value
      .filter((e): e is Extract<ContextEntry, { type: 'char-card' }> => e.type === 'char-card')
      .map(e => e.charId)
  }

  getRecentDialogue(count: number): Array<{ name: string; text: string }> {
    return this.entries.value
      .filter(
        (e): e is Extract<ContextEntry, { type: 'player' }> | Extract<ContextEntry, { type: 'assistant' }> =>
          e.type === 'player' || e.type === 'assistant',
      )
      .slice(-count)
      .map(e => ({ name: e.name, text: e.text }))
  }
}

/* ------------------------------------------------------------------ */
/* resolveForApi                                                       */
/* ------------------------------------------------------------------ */

function resolveForApi(e: ContextEntry): ApiMessage {
  switch (e.type) {
    case 'system':
      return { role: 'system', content: e.text }
    case 'scene':
      return { role: 'system', content: e.view.value }
    case 'char-card':
      return { role: 'system', content: e.view.value }
    case 'player':
      return { role: 'user', content: e.text, name: e.name }
    case 'assistant':
      return { role: 'assistant', content: e.text, name: e.name }
  }
}

/* ------------------------------------------------------------------ */
/* 动态部分 — 对话                                                     */
/* ------------------------------------------------------------------ */

export function buildDialogueDynamic(
  state: SceneState,
  playerInput: string,
): Array<{ role: 'system' | 'user'; content: string }> {
  const target = state.characters.find(c => c.id === state.selectedId)
  const targetName = target?.name ?? '???'
  const targetMood = target?.mood ?? '平静'
  const targetAffection = target?.affection ?? 0

  const others = state.characters
    .filter(c => c.id !== state.selectedId)
    .map(c => `- ${c.name}（${c.role}）：心情 ${c.mood}`)
    .join('\n')

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    {
      role: 'system',
      content: `## 当前状态：${targetName}\n心情：${targetMood}\n好感度：${targetAffection}/5`,
    },
    {
      role: 'system',
      content: `你正在扮演「${targetName}」进行对话。`,
    },
  ]

  if (others) {
    messages.push({
      role: 'system',
      content: `## 在场其他角色当前状态\n${others}`,
    })
  }

  messages.push({ role: 'user', content: playerInput })
  return messages
}

/* ------------------------------------------------------------------ */
/* 动态部分 — 情绪分析                                                 */
/* ------------------------------------------------------------------ */

const MOOD_SYSTEM = `你是一个情绪分析器。根据以下对话，评估目标角色的心情和好感度变化。
只返回 JSON，不要包含任何其他文字：
{"mood": "2-4个中文词描述心情", "affection_delta": -1到1之间的整数}`

export { MOOD_SYSTEM }

export function buildMoodDynamic(
  state: SceneState,
  newDialogue: string,
  recentMessages: Array<{ name: string; text: string }>,
): Array<{ role: 'system' | 'user'; content: string }> {
  const target = state.characters.find(c => c.id === state.selectedId)
  const targetName = target?.name ?? '???'

  return [
    {
      role: 'system',
      content: `[模式切换] 忽略之前的角色扮演指令。\n\n${MOOD_SYSTEM}`,
    },
    {
      role: 'user',
      content: `角色：${targetName}（${target?.role ?? ''}），当前心情：${target?.mood ?? '平静'}，好感度：${target?.affection ?? 0}/5\n\n最近对话：\n${recentMessages.map(m => `${m.name}: ${m.text}`).join('\n')}\n\n${targetName}刚刚说：「${newDialogue}」`,
    },
  ]
}
