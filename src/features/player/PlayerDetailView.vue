<script lang="ts" setup>
import {useGameStore} from '@/features/game/store'
import AttributePanel from '@/shared/ui/AttributePanel.vue'

const store = useGameStore()
</script>

<template>
  <div class="player-detail">
    <div class="detail-header">
      <div class="detail-title">玩家详情</div>
    </div>
    <div class="detail-body">
      <AttributePanel v-if="store.player" :entity="store.player"/>
    </div>
  </div>
</template>

<style scoped>
.player-detail {
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
</style>
