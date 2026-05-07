<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { usePanelParams } from '@/viewer/usePanelParams'
import { usePanelStore } from '@/stores/panel'
import { useDialogueStore } from '@/stores/dialogue'
import AttributePanel from './AttributePanel.vue'

const { params, navigate } = usePanelParams()
const panelStore = usePanelStore()
const store = useGameStore()
const dialogueStore = useDialogueStore()

const characterId = computed(() => params.value.characterId)
const character = computed(() =>
  store.characters.find(c => c.id === characterId.value) ?? null,
)
const isInDialogue = computed(
  () => dialogueStore.targetCharacterId === characterId.value && dialogueStore.targetCharacterId !== null,
)

function goBack() {
  panelStore.navigate('center', 'scene')
  navigate('char-list')
}

function endConversation() {
  dialogueStore.endConversation()
  panelStore.navigate('center', 'scene')
  navigate('char-list')
}
</script>

<template>
  <div class="character-attributes">
    <template v-if="character">
      <AttributePanel :character="character" />

      <div class="spacer" />

      <div class="actions">
        <n-button v-if="isInDialogue" type="warning" ghost size="small" @click="endConversation">
          结束对话
        </n-button>
        <n-button v-else size="small" @click="goBack">
          返回列表
        </n-button>
      </div>
    </template>
    <template v-else>
      <div class="no-selection">角色未找到</div>
    </template>
  </div>
</template>

<style scoped>
.character-attributes {
  padding: 16px;
  height: 100%;
}

.spacer {
  height: 16px;
}

.actions {
  display: flex;
  gap: 8px;
}

.no-selection {
  color: #666666;
  font-style: italic;
}
</style>