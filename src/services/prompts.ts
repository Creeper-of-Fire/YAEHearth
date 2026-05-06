import type { Character, SceneState } from '@/types/game'

/* ------------------------------------------------------------------ */
/* Step 1: 对话生成 — 纯文本，不要求 JSON                              */
/* ------------------------------------------------------------------ */

const DIALOGUE_SYSTEM = `你正在扮演「{location}」中的角色「{targetName}」。

## 场景
时间：{timeOfDay}
氛围：{atmosphere}

## 你扮演的角色
姓名：{targetName}
身份：{targetRole}
外貌：{targetDesc}
性格：{targetPersonality}
当前心情：{targetMood}

## 在场的其他角色
{otherCharacters}

## 规则
- 只输出{targetName}说的话，不要加任何格式、标签、前缀、方括号、引号
- 保持角色的性格和说话方式
- 对话要自然、生动，有角色个性
- 不要替玩家说话
- 不要使用 markdown 格式
- 如果其他角色有合理的插话理由，可以在对话中自然提及他们，但主要回复者是{targetName}`

function formatOtherCharacter(c: Character): string {
  return `- ${c.name}（${c.role}）：${c.description}，性格：${c.personality}，心情：${c.mood}`
}

export function buildDialoguePrompt(state: SceneState): string {
  const target = state.characters.find(c => c.id === state.selectedId)
  if (!target) return ''

  const others = state.characters
    .filter(c => c.id !== target.id)
    .map(formatOtherCharacter)
    .join('\n')

  return DIALOGUE_SYSTEM
    .replace(/{location}/g, state.location)
    .replace(/{timeOfDay}/g, state.timeOfDay)
    .replace(/{atmosphere}/g, state.atmosphere)
    .replace(/{targetName}/g, target.name)
    .replace(/{targetRole}/g, target.role)
    .replace(/{targetDesc}/g, target.description)
    .replace(/{targetPersonality}/g, target.personality)
    .replace(/{targetMood}/g, target.mood)
    .replace(/{otherCharacters}/g, others || '无')
}

/* ------------------------------------------------------------------ */
/* Step 2: 情绪更新 — 简短 JSON                                       */
/* ------------------------------------------------------------------ */

const MOOD_SYSTEM = `你是一个情绪分析器。根据以下对话，评估目标角色的心情和好感度变化。
只返回 JSON，不要包含任何其他文字：
{"mood": "2-4个中文词描述心情", "affection_delta": -1到1之间的整数}`

export function buildMoodMessages(
  state: SceneState,
  newDialogue: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const target = state.characters.find(c => c.id === state.selectedId)
  const targetName = target?.name ?? '???'
  const recent = state.dialogueHistory.slice(-6)

  return [
    {
      role: 'user',
      content: `角色：${targetName}（${target?.role ?? ''}），当前心情：${target?.mood ?? '平静'}，好感度：${target?.affection ?? 0}/5\n\n最近对话：\n${recent.map(m => `${m.speaker || '旁白'}: ${m.text}`).join('\n')}\n\n${targetName}刚刚说：「${newDialogue}」`,
    },
  ]
}

export { MOOD_SYSTEM }

/* ------------------------------------------------------------------ */
/* 对话历史的 OpenAI chat 格式                                         */
/* ------------------------------------------------------------------ */

export function buildChatMessages(
  state: SceneState,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return state.dialogueHistory.map(msg => ({
    role: msg.speaker === '玩家' ? 'user' as const : 'assistant' as const,
    content: msg.text,
  }))
}
