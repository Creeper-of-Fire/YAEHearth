import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SceneState } from '@/types/game'
import { defaultScene } from '@/types/game'
import { generateDialogue, analyzeMood } from '@/services/agent'
import { StaticContext, buildDialogueDynamic, buildMoodDynamic, SYSTEM_PROMPT } from '@/services/prompts'
import { useLogStore } from '@/stores/log'

export const useGameStore = defineStore('game', () => {
  const scene = ref<SceneState>(defaultScene())
  const busy = ref(false)
  const ctx = new StaticContext()

  const characters = computed(() => scene.value.characters)
  const selectedCharacter = computed(() => {
    if (!scene.value.selectedId) return null
    return scene.value.characters.find(c => c.id === scene.value.selectedId) ?? null
  })
  const displayMessages = computed(() => ctx.displayMessages.value)

  function ensureCharacterCard(charId: string | null) {
    if (!charId) return
    if (ctx.loadedCardIds.includes(charId)) return
    const char = scene.value.characters.find(c => c.id === charId)
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

  function initScene() {
    ctx.reset()
    ctx.append({ type: 'system', text: SYSTEM_PROMPT })
    ctx.append({
      type: 'scene',
      view: computed(() =>
        `## 场景设定\n地点：${scene.value.location}\n时间：${scene.value.timeOfDay}\n氛围：${scene.value.atmosphere}`,
      ),
    })
  }

  function selectCharacter(charId: string) {
    scene.value.selectedId = charId
    const char = scene.value.characters.find(c => c.id === charId)
    if (char) {
      useLogStore().info(`对话目标: ${char.name}`)
    }
  }

  async function sendMessage(text: string) {
    if (busy.value) return
    busy.value = true
    const log = useLogStore()
    const target = scene.value.characters.find(c => c.id === scene.value.selectedId)
    const speakerName = target?.name ?? '???'

    // 按需加载角色静态卡
    ensureCharacterCard(scene.value.selectedId)

    // 玩家消息（pending，UI 立即显示）
    ctx.append({ type: 'player', text, name: '玩家' })
    log.info(`玩家: ${text.slice(0, 30)}`)

    try {
      // Step 1: 生成对话
      const staticMsgs = ctx.build()
      const dynamicMsgs = buildDialogueDynamic(scene.value, text)
      let aiText = await generateDialogue(staticMsgs, dynamicMsgs)
      if (!aiText) aiText = '（沉默）'

      // Step 2: AI 回复（pending）
      ctx.append({ type: 'assistant', text: aiText, name: speakerName })

      // Step 3: commit（player + assistant 进入静态前缀）
      ctx.commit()

      // Step 4: 情绪分析
      const updatedStaticMsgs = ctx.build()
      const recentMessages = ctx.getRecentDialogue(6)
      const moodDynMsgs = buildMoodDynamic(scene.value, aiText, recentMessages)
      const moodResult = await analyzeMood(updatedStaticMsgs, moodDynMsgs)

      // Step 5: 应用情绪变化
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

  function resetScene() {
    scene.value = defaultScene()
    initScene()
    useLogStore().info('场景已重置')
  }

  // 初始化
  initScene()

  return {
    scene,
    busy,
    characters,
    selectedCharacter,
    displayMessages,
    selectCharacter,
    sendMessage,
    resetScene,
  }
})
