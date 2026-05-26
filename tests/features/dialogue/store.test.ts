import {describe, expect, it, beforeEach, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {ref} from 'vue'

// Mock dependencies
vi.mock('@/features/dialogue/agent', () => ({
    DialogueRequest: vi.fn().mockImplementation(() => ({
        withMessages: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            text: 'AI reply',
            usage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
                cacheHitTokens: 80,
                cacheMissTokens: 20,
            },
        }),
    })),
    EditorRequest: vi.fn().mockImplementation(() => ({
        withMessages: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            operations: [],
            usage: {
                promptTokens: 50,
                completionTokens: 20,
                totalTokens: 70,
                cacheHitTokens: 0,
                cacheMissTokens: 50,
            },
        }),
    })),
}))

vi.mock('@/features/shell/log-store', () => ({
    useLogStore: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}))

vi.mock('@/features/dialogue/prompts', () => ({
    SYSTEM_PROMPT: '系统提示',
    buildDialogueDynamic: vi.fn().mockReturnValue([
        {role: 'user', content: '动态消息'},
    ]),
    buildEditorDynamic: vi.fn().mockReturnValue([
        {role: 'user', content: '编辑动态'},
    ]),
    fetchWorkspacePrompt: vi.fn().mockResolvedValue('工作区提示词'),
    StaticContext: class
    {
        entries = ref([])
        displayMessages = vi.fn().mockReturnValue({value: []})
        loadedCardIds: string[] = []
        private persister: any = null

        setPersister(fn: any)
        {
            this.persister = fn
        }

        append(entry: any)
        {
            (this.entries as any).value = [...(this.entries as any).value, entry]
        }

        commit()
        {
        }

        build()
        {
            return []
        }

        reset()
        {
            (this.entries as any).value = []
            this.loadedCardIds = []
        }
    },
}))

vi.mock('@/features/content/store', () => ({
    useContentStore: vi.fn().mockReturnValue({
        getEntity: vi.fn().mockReturnValue({
            id: 'npc1',
            type: 'characters',
            frontmatter: {name: 'NPC'},
            body: 'NPC card',
        }),
        updateFrontmatter: vi.fn().mockResolvedValue({
            id: 'npc1',
            type: 'characters',
            frontmatter: {name: 'NPC'},
            body: 'NPC card',
        }),
    }),
}))

// Mock global fetch for persister
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true}))

import {useDialogueStore} from '@/features/dialogue/store'

describe('useDialogueStore', () =>
{
    beforeEach(() =>
    {
        setActivePinia(createPinia())
    })

    it('初始状态', () =>
    {
        const store = useDialogueStore()
        expect(store.targetCharacterId).toBeNull()
        expect(store.busy).toBe(false)
    })

    it('initDialogue 设置目标角色', async () =>
    {
        const store = useDialogueStore()
        await store.initDialogue('npc1')

        expect(store.targetCharacterId).toBe('npc1')
    })

    it('endConversation 重置状态', async () =>
    {
        const store = useDialogueStore()
        await store.initDialogue('npc1')
        store.endConversation()

        expect(store.targetCharacterId).toBeNull()
    })

    it('cumulativeUsage 初始为零', () =>
    {
        const store = useDialogueStore()
        expect(store.cumulativeUsage.promptTokens).toBe(0)
        expect(store.cumulativeUsage.turnCount).toBe(0)
    })

    it('cacheHitRate 初始为 0', () =>
    {
        const store = useDialogueStore()
        expect(store.cacheHitRate).toBe(0)
    })
})

describe('dialogue store 辅助函数', () =>
{
    function getNestedValue(obj: Record<string, any>, path: string): any
    {
        const keys = path.split('.')
        let cur: any = obj
        for (const k of keys)
        {
            if (cur == null || typeof cur !== 'object') return undefined
            cur = cur[k]
        }
        return cur
    }

    function setNestedValue(obj: Record<string, any>, path: string, value: any): void
    {
        const keys = path.split('.')
        let cur: any = obj
        for (let i = 0; i < keys.length - 1; i++)
        {
            const k = keys[i]
            if (!(k in cur) || typeof cur[k] !== 'object') cur[k] = {}
            cur = cur[k]
        }
        cur[keys[keys.length - 1]] = value
    }

    describe('getNestedValue', () =>
    {
        it('获取顶层值', () =>
        {
            expect(getNestedValue({name: 'test'}, 'name')).toBe('test')
        })

        it('获取嵌套值', () =>
        {
            expect(getNestedValue({a: {b: {c: 42}}}, 'a.b.c')).toBe(42)
        })

        it('路径不存在返回 undefined', () =>
        {
            expect(getNestedValue({a: 1}, 'b')).toBeUndefined()
        })

        it('中间值为 null 时返回 undefined', () =>
        {
            expect(getNestedValue({a: null}, 'a.b')).toBeUndefined()
        })
    })

    describe('setNestedValue', () =>
    {
        it('设置顶层值', () =>
        {
            const obj: any = {}
            setNestedValue(obj, 'name', 'test')
            expect(obj.name).toBe('test')
        })

        it('设置嵌套值', () =>
        {
            const obj: any = {}
            setNestedValue(obj, 'a.b.c', 42)
            expect(obj.a.b.c).toBe(42)
        })

        it('覆盖已有值', () =>
        {
            const obj: any = {name: 'old'}
            setNestedValue(obj, 'name', 'new')
            expect(obj.name).toBe('new')
        })

        it('覆盖非对象中间节点', () =>
        {
            const obj: any = {a: 'string'}
            setNestedValue(obj, 'a.b', 'value')
            expect(obj.a.b).toBe('value')
        })
    })

    describe('makeSessionFile', () =>
    {
        function makeSessionFile(sceneId: string, charId: string): string
        {
            const now = new Date()
            const pad = (n: number) => String(n).padStart(2, '0')
            const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
            return `${sceneId}_${charId}_${stamp}.jsonl`
        }

        it('生成正确格式的文件名', () =>
        {
            const result = makeSessionFile('tavern', 'npc1')
            expect(result).toMatch(/^tavern_npc1_\d{8}_\d{6}\.jsonl$/)
        })
    })
})
