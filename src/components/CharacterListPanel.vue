<script lang="ts" setup>
import {computed} from 'vue'
import {useGameStore} from '@/stores/game'
import {usePanelStore} from '@/stores/panel'

const store = useGameStore()
const panelStore = usePanelStore()

const menuOptions = computed(() =>
    store.characters.map(c => ({
      label: `${c.frontmatter.name ?? c.id}（${c.frontmatter.role ?? ''}）`,
      key: c.id,
    })),
)

function onSelect(key: string)
{
  panelStore.navigate('center', 'char-detail', {characterId: key})
  panelStore.navigate('right', 'char-attrs', {characterId: key})
}
</script>

<template>
  <div class="character-list-panel">
    <div class="panel-title">在场角色</div>
    <n-menu
        :options="menuOptions"
        @update:value="onSelect"
    />
  </div>
</template>

<style scoped>
.character-list-panel {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-title {
  color: #777777;
  font-size: 12px;
  margin-bottom: 8px;
}
</style>
