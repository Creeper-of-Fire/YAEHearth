import {defineStore} from 'pinia'
import {computed, reactive, shallowRef} from 'vue'
import type {ContentType, ContentEntity} from '@/shared/types'
import {ContentService} from './service'

export const useContentStore = defineStore('content', () =>
{
    const service = new ContentService()

    const entities = reactive<Map<string, ContentEntity>>(new Map())
    const ready = shallowRef(false)

    /** 从 service 缓存同步到响应式 map */
    function fullSync(): void
    {
        entities.clear()
        for (const entity of service.all())
        {
            entities.set(`${entity.type}/${entity.id}`, entity)
        }
    }

    const characters = computed(() =>
        [...entities.values()].filter(e => e.type === 'characters'),
    )

    const scenes = computed(() =>
        [...entities.values()].filter(e => e.type === 'scenes'),
    )

    const items = computed(() =>
        [...entities.values()].filter(e => e.type === 'items'),
    )

    function getEntity(type: ContentType, id: string): ContentEntity | undefined
    {
        return entities.get(`${type}/${id}`)
    }

    function allOfType(type: ContentType): ContentEntity[]
    {
        return [...entities.values()].filter(e => e.type === type)
    }

    async function updateFrontmatter(type: ContentType, id: string, patch: Record<string, any>): Promise<void>
    {
        const updated = await service.updateFrontmatter(type, id, patch)
        entities.set(`${type}/${id}`, updated)
    }

    async function initialize(): Promise<void>
    {
        service.onChange(() => fullSync())
        await service.connect()
        fullSync()
        ready.value = true
    }

    return {
        entities,
        ready,
        characters,
        scenes,
        items,
        getEntity,
        allOfType,
        updateFrontmatter,
        initialize,
    }
})
