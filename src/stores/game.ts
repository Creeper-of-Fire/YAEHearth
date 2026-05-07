import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import type {SceneState} from '@/types/game'
import {defaultScene} from '@/types/game'
import {useLogStore} from '@/stores/log'

export const useGameStore = defineStore('game', () =>
{
    const scene = ref<SceneState>(defaultScene())

    const player = ref({
        id: 'player',
        name: '旅人',
        role: '冒险者',
        description: '一个来自远方的旅人，身披风尘仆仆的斗篷，眼中带着对未知的好奇与警惕。',
        personality: '沉稳内敛，善于观察。在陌生环境中保持警觉，但面对善意会逐渐敞开心扉。',
        mood: '平静',
        affection: 0,
    })

    const characters = computed(() => scene.value.characters)

    function resetScene()
    {
        scene.value = defaultScene()
        useLogStore().info('场景已重置')
    }

    return {
        scene,
        player,
        characters,
        resetScene,
    }
})
