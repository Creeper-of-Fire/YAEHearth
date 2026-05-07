<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import { usePanelParams } from '@/viewer/usePanelParams'
import { usePanelStore } from '@/stores/panel'

const store = useGameStore()
const { navigate } = usePanelParams()
const panelStore = usePanelStore()

function startDialogue(charId: string) {
  navigate('dialogue', { characterId: charId })
  panelStore.navigate('right', 'char-attrs', { characterId: charId })
}
</script>

<template>
  <div class="scene-view">
    <div class="scene-header">
      <div class="scene-location">{{ store.scene.location }}</div>
      <div class="scene-time">{{ store.scene.timeOfDay }}</div>
      <div class="scene-atmosphere">{{ store.scene.atmosphere }}</div>
    </div>

    <div class="scene-interactions">
      <div class="interactions-title">角色互动</div>
      <div class="char-grid">
        <div
          v-for="char in store.characters"
          :key="char.id"
          class="char-card"
        >
          <div class="char-card-name">{{ char.name }}</div>
          <div class="char-card-role">{{ char.role }}</div>
          <div class="char-card-mood">{{ char.mood }}</div>
          <n-button size="small" type="primary" @click="startDialogue(char.id)">
            开始对话
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.scene-header {
  padding: 16px 24px;
  border-bottom: 1px solid #434347;
}

.scene-location {
  font-size: 22px;
  font-weight: bold;
  color: #dddddd;
  margin-bottom: 4px;
}

.scene-time {
  font-size: 13px;
  color: #999999;
  margin-bottom: 8px;
}

.scene-atmosphere {
  font-size: 14px;
  color: #888888;
  font-style: italic;
  line-height: 1.5;
}

.scene-interactions {
  flex: 1;
  padding: 16px 24px;
  overflow-y: auto;
}

.interactions-title {
  color: #777777;
  font-size: 13px;
  margin-bottom: 12px;
}

.char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.char-card {
  background: #1e1e20;
  border: 1px solid #434347;
  border-radius: 6px;
  padding: 12px;
  transition: border-color 0.15s;
}

.char-card:hover {
  border-color: #6699cc;
}

.char-card-name {
  font-size: 16px;
  font-weight: bold;
  color: #dddddd;
  margin-bottom: 2px;
}

.char-card-role {
  font-size: 12px;
  color: #999999;
  margin-bottom: 4px;
}

.char-card-mood {
  font-size: 12px;
  color: #777777;
  margin-bottom: 8px;
}
</style>