<script lang="ts" setup>
import {computed} from 'vue'
import {useGameStore} from '@/features/game/store'
import {usePanelParams} from '@/features/shell/usePanelParams'
import {usePanelStore} from '@/features/shell/panel-store'
import AttributePanel from '@/shared/ui/AttributePanel.vue'

const {params, navigate} = usePanelParams()
const panelStore = usePanelStore()
const store = useGameStore()

const entityId = computed(() => params.value.entityId)
const entity = computed(() =>
{
  if (store.player?.id === entityId.value) return store.player
  return store.characters.find(c => c.id === entityId.value) ?? null
})
const isPlayer = computed(() => store.player?.id === entityId.value)

function goBack()
{
  panelStore.clearOverlay()
}

function startDialogue()
{
  panelStore.clearOverlay()
  navigate('dialogue', {characterId: entityId.value!})
  panelStore.navigate('right', 'char-attrs', {characterId: entityId.value!})
}
</script>

<template>
  <div class="entity-detail">
    <div class="detail-header">
      <n-button text size="small" @click="goBack" class="back-btn">✕ 关闭</n-button>
      <div class="detail-title">{{ isPlayer ? '玩家详情' : '角色详情' }}</div>
    </div>
    <div class="detail-body">
      <template v-if="entity">
        <AttributePanel :entity="entity"/>
        <div class="spacer"/>
        <n-button v-if="!isPlayer" type="primary" @click="startDialogue">
          开始对话
        </n-button>
      </template>
      <template v-else>
        <div class="not-found">未找到</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.entity-detail {
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 16px 24px;
  border-bottom: 1px solid #434347;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.back-btn {
  color: #6699cc;
  font-size: 12px;
}

.detail-title {
  font-size: 18px;
  font-weight: bold;
  color: #dddddd;
}

.detail-body {
  padding: 24px;
}

.spacer {
  height: 24px;
}

.not-found {
  color: #666666;
  font-style: italic;
}
</style>
