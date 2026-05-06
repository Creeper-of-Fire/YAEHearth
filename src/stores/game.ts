import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AgentResponse, Message, SceneState } from '@/types/game'
import { defaultScene } from '@/types/game'
import { generateResponse } from '@/services/agent'
import { useLogStore } from '@/stores/log'

export const useGameStore = defineStore('game', () => {
  const scene = ref<SceneState>(defaultScene())
  const busy = ref(false)

  const characters = computed(() => scene.value.characters)
  const selectedCharacter = computed(() => {
    if (!scene.value.selectedId) return null
    return scene.value.characters.find(c => c.id === scene.value.selectedId) ?? null
  })
  const dialogueHistory = computed(() => scene.value.dialogueHistory)
  const sceneDescription = computed(() => scene.value.atmosphere)

  function selectCharacter(charId: string) {
    scene.value.selectedId = charId
    const char = scene.value.characters.find(c => c.id === charId)
    if (char) {
      useLogStore().info(`对话目标: ${char.name}`)
    }
  }

  async function sendMessage(text: string) {
    const msg: Message = { speaker: '玩家', text, timestamp: Date.now() / 1000 }
    scene.value.dialogueHistory.push(msg)
    useLogStore().info(`玩家: ${text.slice(0, 30)}`)
    await triggerAgent()
  }

  function resetScene() {
    scene.value = defaultScene()
    useLogStore().info('场景已重置')
  }

  async function triggerAgent() {
    if (busy.value) return
    busy.value = true
    try {
      const response = await generateResponse(scene.value)
      applyResponse(response)
    } catch {
      useLogStore().error('Agent 调用失败')
      applyResponse({ speaker: '???', text: '（沉默）', affectionDelta: 0 })
    } finally {
      busy.value = false
    }
  }

  function applyResponse(resp: AgentResponse) {
    const msg: Message = {
      speaker: resp.speaker,
      text: resp.text,
      timestamp: Date.now() / 1000,
    }
    scene.value.dialogueHistory.push(msg)

    const char = scene.value.characters.find(c => c.id === scene.value.selectedId)
    if (char) {
      if (resp.mood) char.mood = resp.mood
      char.affection = Math.max(0, Math.min(5, char.affection + resp.affectionDelta))
    }

    useLogStore().info(`${resp.speaker}: ${resp.text.slice(0, 40)}`)
  }

  return {
    scene,
    busy,
    characters,
    selectedCharacter,
    dialogueHistory,
    sceneDescription,
    selectCharacter,
    sendMessage,
    resetScene,
  }
})
