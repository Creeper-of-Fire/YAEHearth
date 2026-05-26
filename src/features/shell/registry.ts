import {type Component, defineAsyncComponent} from 'vue'

export const viewRegistry: Record<string, Component> = {
    player: defineAsyncComponent(() => import('@/features/player/PlayerPanel.vue')),
    'player-detail': defineAsyncComponent(() => import('@/features/player/PlayerDetailView.vue')),
    scene: defineAsyncComponent(() => import('@/features/game/SceneView.vue')),
    'char-list': defineAsyncComponent(() => import('@/features/character/CharacterListPanel.vue')),
    'char-detail': defineAsyncComponent(() => import('@/features/character/CharacterDetailView.vue')),
    'char-attrs': defineAsyncComponent(() => import('@/features/character/CharacterAttributes.vue')),
    dialogue: defineAsyncComponent(() => import('@/features/dialogue/DialogueView.vue')),
}
