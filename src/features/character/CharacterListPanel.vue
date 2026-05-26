<script lang="ts" setup>
import {computed} from 'vue'
import {useGameStore} from '@/features/game/store'
import {usePanelStore} from '@/features/shell/panel-store'

const store = useGameStore()
const panelStore = usePanelStore()

const menuOptions = computed(() =>
    store.characters.map(c => ({
      label: c.frontmatter.name ?? c.id,
      key: c.id,
    })),
)

function onSelect(key: string)
{
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
}

.panel-title {
  color: #777777;
  font-size: 12px;
  margin-bottom: 8px;
}
</style>
