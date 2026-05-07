import { defineAsyncComponent, type Component } from 'vue'

export const viewRegistry: Record<string, Component> = {
  player: defineAsyncComponent(() => import('@/components/PlayerPanel.vue')),
  'player-detail': defineAsyncComponent(() => import('@/views/PlayerDetailView.vue')),
  scene: defineAsyncComponent(() => import('@/views/SceneView.vue')),
  'char-list': defineAsyncComponent(() => import('@/components/CharacterListPanel.vue')),
  'char-detail': defineAsyncComponent(() => import('@/views/CharacterDetailView.vue')),
  'char-attrs': defineAsyncComponent(() => import('@/components/CharacterAttributes.vue')),
  dialogue: defineAsyncComponent(() => import('@/views/DialogueView.vue')),
}
