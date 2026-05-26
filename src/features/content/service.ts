import {merge} from 'lodash-es'
import type {ContentEntity, ContentEvent, ContentType} from '@/shared/types'

const API_BASE = '/__content'

export class ContentService
{
    private cache = new Map<string, ContentEntity>()
    private listeners = new Set<(event: ContentEvent) => void>()
    private eventSource: EventSource | null = null
    private _ready = false

    get ready(): boolean
    {
        return this._ready
    }

    /** 连接后端：全量加载 + SSE */
    async connect(): Promise<void>
    {
        // 获取所有类型
        const types: string[] = await this.fetch('/types')

        // 按类型全量加载
        for (const type of types)
        {
            const entities: ContentEntity[] = await this.fetch(`/${type}`)
            for (const entity of entities)
            {
                this.cache.set(this.key(entity.type, entity.id), entity)
            }
        }

        // 打开 SSE 连接
        this.eventSource = new EventSource(`${API_BASE}/events`)
        this.eventSource.onmessage = (event) =>
        {
            try
            {
                const data: ContentEvent = JSON.parse(event.data)
                this.handleEvent(data)
            } catch
            {
                // 忽略解析错误
            }
        }

        this._ready = true
    }

    /** 断开 SSE */
    disconnect(): void
    {
        this.eventSource?.close()
        this.eventSource = null
        this._ready = false
    }

    /** 获取单个实体 */
    get(type: ContentType, id: string): ContentEntity | undefined
    {
        return this.cache.get(this.key(type, id))
    }

    /** 获取所有实体 */
    all(): ContentEntity[]
    {
        return [...this.cache.values()]
    }

    /** 获取某类型下的所有实体 */
    getByType(type: ContentType): ContentEntity[]
    {
        const result: ContentEntity[] = []
        for (const entity of this.cache.values())
        {
            if (entity.type === type) result.push(entity)
        }
        return result
    }

    /** 更新 frontmatter 字段（部分合并，回写文件） */
    async updateFrontmatter(type: ContentType, id: string, patch: Record<string, any>): Promise<ContentEntity>
    {
        const cacheKey = this.key(type, id)
        const entity = this.cache.get(cacheKey)
        if (!entity) throw new Error(`Entity ${cacheKey} not found`)

        // 乐观更新（深合并，支持嵌套路径）
        const updated: ContentEntity = {
            ...entity,
            frontmatter: merge({}, entity.frontmatter, patch),
        }
        this.cache.set(cacheKey, updated)

        // 发送到后端
        const serverEntity: ContentEntity = await this.fetch(`/${type}/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(patch),
        })

        // 用服务端返回的权威数据覆盖
        this.cache.set(cacheKey, serverEntity)
        return serverEntity
    }

    /** 订阅变更 */
    onChange(fn: (event: ContentEvent) => void): () => void
    {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
    }

    private handleEvent(event: ContentEvent): void
    {
        const cacheKey = this.key(event.type, event.id)

        switch (event.action)
        {
            case 'add':
            case 'change':
                if (event.entity) this.cache.set(cacheKey, event.entity)
                break
            case 'delete':
                this.cache.delete(cacheKey)
                break
        }

        for (const fn of this.listeners) fn(event)
    }

    private key(type: string, id: string): string
    {
        return `${type}/${id}`
    }

    private async fetch(path: string, init?: RequestInit): Promise<any>
    {
        const res = await fetch(`${API_BASE}${path}`, init)
        if (!res.ok)
        {
            let detail = ''
            try
            {
                const body = await res.json()
                detail = body.error ? `: ${body.error}` : ''
            } catch { /* ignore */ }
            throw new Error(`Content API ${res.status}${detail}`)
        }
        return res.json()
    }
}
