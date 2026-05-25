<script lang="ts" setup>
import {useGameStore} from '@/stores/game'
import {usePanelStore} from '@/stores/panel'
import AttributePanel from './AttributePanel.vue'

const store = useGameStore()
const panelStore = usePanelStore()

function goToDetail()
{
  panelStore.navigate('center', 'player-detail')
}
</script>

<template>
  <div class="player-panel" @click="goToDetail">
    <AttributePanel v-if="store.player" :entity="store.player"/>
    <div class="click-hint">点击查看详情</div>
  </div>
</template>

<style scoped>
.player-panel {
  padding: 16px;
  cursor: pointer;
  height: 100%;
  transition: background 0.15s;
}

.player-panel:hover {
  background: #1e1e20;
}

.click-hint {
  margin-top: 16px;
  color: #555555;
  font-size: 12px;
  text-align: center;
}
</style>
