<script lang="ts" setup>
import {computed} from 'vue'
import {useGameStore} from '@/features/game/store'
import {usePanelParams} from '@/features/shell/usePanelParams'
import {usePanelStore} from '@/features/shell/panel-store'
import MarkdownView from '@/shared/ui/MarkdownView.vue'
import FieldTree from '@/shared/ui/FieldTree.vue'

const store = useGameStore()
const {navigate} = usePanelParams()
const panelStore = usePanelStore()

const sceneFields = computed(() =>
    Object.entries(store.activeScene?.frontmatter ?? {})
        .filter(([k]) => k !== 'id' && k !== 'characters'),
)

const charDisplayFields = (char: typeof store.characters[number]) =>
    Object.entries(char.frontmatter).filter(([k]) => k !== 'id' && k !== 'name')

function startDialogue(charId: string)
{
  navigate('dialogue', {characterId: charId})
  panelStore.navigate('right', 'char-attrs', {characterId: charId})
}
</script>

<template>
  <div class="scene-view">
    <div class="scene-header">
      <div
          v-for="[key, val] in sceneFields"
          :key="key"
          class="scene-field"
          :class="`scene-${key}`"
      >{{ val }}</div>
      <MarkdownView :source="store.activeScene?.body ?? ''" class="scene-body"/>
    </div>

    <div class="scene-interactions">
      <div class="interactions-title">角色互动</div>
      <div class="char-grid">
        <div
            v-for="char in store.characters"
            :key="char.id"
            class="char-card"
        >
          <div class="char-card-name">{{ char.frontmatter.name ?? char.id }}</div>
          <FieldTree :fields="charDisplayFields(char)" class="char-card-fields"/>
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
  display: flex;
  flex-direction: column;
}

.scene-header {
  padding: 16px 24px;
  border-bottom: 1px solid #434347;
}

.scene-field {
  color: #dddddd;
}

.scene-location {
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 4px;
}

.scene-timeOfDay {
  font-size: 13px;
  color: #999999;
  margin-bottom: 8px;
}

.scene-body {
  font-size: 14px;
  color: #888888;
  font-style: italic;
  line-height: 1.5;
  margin-top: 6px;
  white-space: pre-wrap;
}

.scene-interactions {
  padding: 16px 24px;
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
  margin-bottom: 4px;
}

.char-card-fields {
  margin-bottom: 8px;
  font-size: 12px;
}
</style>
