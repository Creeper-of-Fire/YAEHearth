<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { usePanelParams } from '@/viewer/usePanelParams'
import { usePanelStore } from '@/stores/panel'
import AttributePanel from '@/components/AttributePanel.vue'

const { params, navigate } = usePanelParams()
const panelStore = usePanelStore()
const store = useGameStore()

const characterId = computed(() => params.value.characterId)
const character = computed(() =>
  store.characters.find(c => c.id === characterId.value) ?? null,
)

function startDialogue() {
  navigate('dialogue', { characterId: characterId.value })
  panelStore.navigate('right', 'char-attrs', { characterId: characterId.value })
}
</script>

<template>
  <div class="char-detail">
    <div class="detail-header">
      <div class="detail-title">角色详情</div>
    </div>
    <div class="detail-body">
      <template v-if="character">
        <AttributePanel :character="character" />
        <div class="spacer" />
        <n-button type="primary" @click="startDialogue">
          开始对话
        </n-button>
      </template>
      <template v-else>
        <div class="not-found">角色未找到</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.char-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 16px 24px;
  border-bottom: 1px solid #434347;
}

.detail-title {
  font-size: 18px;
  font-weight: bold;
  color: #dddddd;
}

.detail-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.spacer {
  height: 24px;
}

.not-found {
  color: #666666;
  font-style: italic;
}
</style>