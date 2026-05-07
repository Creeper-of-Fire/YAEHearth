import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useLogStore } from '@/stores/log'
import { StaticContext, buildDialogueDynamic, buildMoodDynamic, SYSTEM_PROMPT } from '@/services/prompts'
import { generateDialogue, analyzeMood } from '@/services/agent'
import type { Character } from '@/types/game'

export const useDialogueStore = defineStore('dialogue', () => {
  const gameStore = useGameStore()
  const targetCharacterId = ref<string | null>(null)
  const busy = ref(false)
  const ctx = new StaticContext()

  const displayMessages = computed(() => ctx.displayMessages.value)

  function findTarget(charId: string): Character | undefined {
    return gameStore.scene.characters.find(c => c.id === charId)
  }

  function ensureCharacterCard(charId: string) {
    if (ctx.loadedCardIds.includes(charId)) return
    const char = findTarget(charId)
    if (!char) return
    ctx.append({
      type: 'char-card',
      view: computed(() =>
        `## 角色卡片：${char.name}\n身份：${char.role}\n外貌：${char.description}\n性格：${char.personality}`,
      ),
      charId,
      name: computed(() => char.name),
    })
  }

  function initDialogue(charId: string) {
    targetCharacterId.value = charId
    ctx.reset()
    ctx.append({ type: 'system', text: SYSTEM_PROMPT })
    ctx.append({
      type: 'scene',
      view: computed(() =>
        `## 场景设定\n地点：${gameStore.scene.location}\n时间：${gameStore.scene.timeOfDay}\n氛围：${gameStore.scene.atmosphere}`,
      ),
    })
    const target = findTarget(charId)
    useLogStore().info(`对话目标: ${target?.name ?? '???'}`)
  }

  async function sendMessage(text: string) {
    if (busy.value || !targetCharacterId.value) return
    busy.value = true
    ensureCharacterCard(targetCharacterId.value)
    const log = useLogStore()
    const target = findTarget(targetCharacterId.value)
    const speakerName = target?.name ?? '???'

    ctx.append({ type: 'player', text, name: '玩家' })
    log.info(`玩家: ${text.slice(0, 30)}`)

    try {
      const staticMsgs = ctx.build()
      const dynamicMsgs = buildDialogueDynamic(target!, gameStore.scene.characters, text)
      let aiText = await generateDialogue(staticMsgs, dynamicMsgs)
      if (!aiText) aiText = '（沉默）'

      ctx.append({ type: 'assistant', text: aiText, name: speakerName })
      ctx.commit()

      const updatedStaticMsgs = ctx.build()
      const recentMessages = ctx.getRecentDialogue(6)
      const moodDynMsgs = buildMoodDynamic(target!, aiText, recentMessages)
      const moodResult = await analyzeMood(updatedStaticMsgs, moodDynMsgs)

      if (target) {
        if (moodResult.mood) target.mood = moodResult.mood
        target.affection = Math.max(0, Math.min(5, target.affection + moodResult.affectionDelta))
      }

      log.info(`${speakerName}: ${aiText.slice(0, 40)}`)
    } catch (e) {
      log.error(`Agent 调用失败: ${e}`)
      ctx.append({ type: 'assistant', text: '（沉默）', name: speakerName })
      ctx.commit()
    } finally {
      busy.value = false
    }
  }

  function endConversation() {
    targetCharacterId.value = null
    ctx.reset()
    useLogStore().info('对话已结束')
  }

  return {
    targetCharacterId,
    busy,
    displayMessages,
    initDialogue,
    sendMessage,
    endConversation,
  }
})
