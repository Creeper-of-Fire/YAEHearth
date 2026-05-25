import {computed, type ComputedRef, type Ref} from 'vue'
import type {ContentEntity, ContentType} from './types'
import {useContentStore} from './store'

/** 获取单个实体（响应式） */
export function useContentEntity(type: ContentType, id: Ref<string>): ComputedRef<ContentEntity | undefined>
{
    const store = useContentStore()
    return computed(() => store.getEntity(type, id.value))
}

/** 获取某类型所有实体（响应式） */
export function useContentByType(type: ContentType): ComputedRef<ContentEntity[]>
{
    const store = useContentStore()
    return computed(() => store.allOfType(type))
}

/** 获取实体的某个 frontmatter 字段（响应式） */
export function useContentField<T = any>(type: ContentType, id: Ref<string>, field: string): ComputedRef<T | undefined>
{
    const store = useContentStore()
    return computed(() =>
    {
        const entity = store.getEntity(type, id.value)
        return entity?.frontmatter[field] as T | undefined
    })
}

/** 获取实体的 body（响应式） */
export function useContentBody(type: ContentType, id: Ref<string>): ComputedRef<string>
{
    const store = useContentStore()
    return computed(() => store.getEntity(type, id.value)?.body ?? '')
}
