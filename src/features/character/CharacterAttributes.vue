<script lang="ts" setup>
import {computed} from 'vue'
import {useGameStore} from '@/features/game/store'
import {usePanelParams} from '@/features/shell/usePanelParams'
import {usePanelStore} from '@/features/shell/panel-store'
import AttributePanel from '@/shared/ui/AttributePanel.vue'

const {params, navigate} = usePanelParams()
const panelStore = usePanelStore()
const store = useGameStore()

const characterId = computed(() => params.value.characterId)
const character = computed(() =>
    store.characters.find(c => c.id === characterId.value) ?? null,
)

function goToDetail()
{
  if (!characterId.value) return
  panelStore.showOverlay('char-detail', {entityId: characterId.value})
}
</script>

<template>
  <div class="character-attributes">
    <template v-if="character">
      <div class="attrs-header">
        <div class="attrs-title">{{ character.frontmatter.name ?? character.id }}</div>
        <n-button text size="small" @click.stop="navigate('char-list')" class="back-link">
          ← 列表
        </n-button>
      </div>
      <div @click="goToDetail" class="attrs-body">
        <AttributePanel :entity="character"/>
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
}

.attrs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.attrs-title {
  font-size: 15px;
  font-weight: bold;
  color: #dddddd;
}

.back-link {
  color: #6699cc;
  font-size: 12px;
}

.attrs-body {
  cursor: pointer;
  transition: background 0.15s;
}

.attrs-body:hover {
  background: #1e1e20;
}

.no-selection {
  color: #666666;
  font-style: italic;
}
</style>
