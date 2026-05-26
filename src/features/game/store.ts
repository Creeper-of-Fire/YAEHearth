import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import {useContentStore} from '@/features/content/store'
import {useLogStore} from '@/features/shell/log-store'
import type {ContentEntity} from '@/shared/types'

export const useGameStore = defineStore('game', () =>
{
    const contentStore = useContentStore()
    const log = useLogStore()

    const activeSceneId = ref('tavern-night')

    const activeScene = computed<ContentEntity | undefined>(() =>
        contentStore.getEntity('scenes', activeSceneId.value),
    )

    /** 场景中登场的角色 id 列表 */
    const characterIds = computed<string[]>(() =>
        activeScene.value?.frontmatter.characters ?? [],
    )

    /** 场景中的所有角色实体 */
    const characters = computed<ContentEntity[]>(() =>
        characterIds.value
            .map(id => contentStore.getEntity('characters', id))
            .filter((e): e is ContentEntity => e !== undefined),
    )

    /** 玩家角色实体 */
    const player = computed<ContentEntity | undefined>(() =>
        contentStore.getEntity('characters', 'player'),
    )

    function resetScene(): void
    {
        activeSceneId.value = 'tavern-night'
        log.info('场景已重置')
    }

    return {
        activeSceneId,
        activeScene,
        characters,
        characterIds,
        player,
        resetScene,
    }
})
