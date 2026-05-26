import {describe, expect, it, vi} from 'vitest'
import {computed} from 'vue'
import {
    buildModeIndicator,
    buildDialogueDynamic,
    buildEditorDynamic,
    fetchWorkspacePrompt,
    StaticContext,
} from '@/features/dialogue/prompts'
import type {ContentEntity} from '@/shared/types'

// ---------------------------------------------------------------------------
// buildModeIndicator
// ---------------------------------------------------------------------------

describe('buildModeIndicator', () =>
{
    it('对话模式', () =>
    {
        expect(buildModeIndicator('dialogue')).toBe('[工作模式: 对话演绎]')
    })

    it('编辑模式', () =>
    {
        expect(buildModeIndicator('edit')).toBe('[工作模式: 字段编辑]')
    })
})

// ---------------------------------------------------------------------------
// buildDialogueDynamic
// ---------------------------------------------------------------------------

describe('buildDialogueDynamic', () =>
{
    const target: ContentEntity = {
        id: 'npc1',
        type: 'characters',
        frontmatter: {name: '艾琳'},
        body: '',
    }

    const player: ContentEntity = {
        id: 'player',
        type: 'characters',
        frontmatter: {name: '玩家', 属性: {体力: 100}},
        body: '',
    }

    it('包含当前状态和角色扮演指令', () =>
    {
        const msgs = buildDialogueDynamic(target, [player, target])
        expect(msgs).toHaveLength(2)
        expect(msgs[0].content).toContain('当前状态')
        expect(msgs[0].content).toContain('玩家')
        expect(msgs[1].content).toContain('艾琳')
    })

    it('无其他角色时也能工作', () =>
    {
        const msgs = buildDialogueDynamic(target, [])
        expect(msgs).toHaveLength(1)
        expect(msgs[0].content).toContain('艾琳')
    })

    it('跳过 id 和 name 字段', () =>
    {
        const msgs = buildDialogueDynamic(target, [player])
        const stateMsg = msgs[0].content
        // id 和 name 不应出现在格式化中
        expect(stateMsg).not.toContain('id:')
        // name 也被跳过
    })
})

// ---------------------------------------------------------------------------
// buildEditorDynamic
// ---------------------------------------------------------------------------

describe('buildEditorDynamic', () =>
{
    it('构建编辑请求消息', () =>
    {
        const chars: ContentEntity[] = [
            {id: 'player', type: 'characters', frontmatter: {name: '玩家'}, body: ''},
            {id: 'npc1', type: 'characters', frontmatter: {name: '艾琳'}, body: ''},
        ]
        const msgs = buildEditorDynamic(chars, '你好')
        expect(msgs).toHaveLength(1)
        expect(msgs[0].content).toContain('可编辑的角色')
        expect(msgs[0].content).toContain('玩家')
        expect(msgs[0].content).toContain('艾琳')
        expect(msgs[0].content).toContain('你好')
        expect(msgs[0].content).toContain('[工作模式: 字段编辑]')
    })

    it('角色无 name 字段时使用 id', () =>
    {
        const chars: ContentEntity[] = [
            {id: 'hero', type: 'characters', frontmatter: {}, body: ''},
        ]
        const msgs = buildEditorDynamic(chars, '测试')
        expect(msgs[0].content).toContain('hero')
    })
})

// ---------------------------------------------------------------------------
// StaticContext
// ---------------------------------------------------------------------------

describe('StaticContext', () =>
{
    it('append 和 displayMessages', () =>
    {
        const ctx = new StaticContext()
        ctx.append({type: 'system', text: '系统提示'})
        ctx.append({type: 'player', text: '你好', name: '玩家'})
        ctx.append({type: 'assistant', text: '你好啊', name: 'NPC'})

        const display = ctx.displayMessages.value
        // system 不在 display 中
        expect(display).toHaveLength(2)
        expect(display[0]).toEqual({type: 'player', text: '你好', name: '玩家'})
        expect(display[1]).toEqual({type: 'assistant', text: '你好啊', name: 'NPC'})
    })

    it('build 返回已 commit 的消息', () =>
    {
        const ctx = new StaticContext()
        ctx.append({type: 'system', text: '系统'})
        ctx.append({type: 'player', text: '你好', name: '玩家'})
        ctx.commit()

        // commit 后再添加的不会出现在 build 中
        ctx.append({type: 'assistant', text: '你好啊', name: 'NPC'})

        const msgs = ctx.build()
        expect(msgs).toHaveLength(2)
        expect(msgs[0].role).toBe('system')
        expect(msgs[1].role).toBe('user')
    })

    it('reset 清空所有内容', () =>
    {
        const ctx = new StaticContext()
        ctx.append({type: 'system', text: '系统'})
        ctx.commit()
        ctx.reset()

        expect(ctx.build()).toHaveLength(0)
        expect(ctx.displayMessages.value).toHaveLength(0)
    })

    it('loadedCardIds 返回已加载的角色卡 id', () =>
    {
        const ctx = new StaticContext()
        ctx.append({
            type: 'char-card',
            view: computed(() => '角色卡内容'),
            charId: 'npc1',
            name: computed(() => 'NPC'),
        })
        ctx.append({
            type: 'char-card',
            view: computed(() => '玩家卡'),
            charId: 'player',
            name: computed(() => '玩家'),
        })

        expect(ctx.loadedCardIds).toEqual(['npc1', 'player'])
    })

    it('persister 在 append 时被调用', () =>
    {
        const ctx = new StaticContext()
        const records: any[] = []
        ctx.setPersister((record) => records.push(record))

        ctx.append({type: 'system', text: '系统'})
        ctx.append({type: 'player', text: '你好', name: '玩家'})

        expect(records).toHaveLength(2)
        expect(records[0].type).toBe('system')
        expect(records[1].type).toBe('player')
    })

    it('persister 对 char-card 类型包含 charId 和 name', () =>
    {
        const ctx = new StaticContext()
        const records: any[] = []
        ctx.setPersister((record) => records.push(record))

        ctx.append({
            type: 'char-card',
            view: computed(() => '内容'),
            charId: 'npc1',
            name: computed(() => '艾琳'),
        })

        expect(records).toHaveLength(1)
        expect(records[0].charId).toBe('npc1')
        expect(records[0].name).toBe('艾琳')
    })

    it('persister 对 scene 类型正确处理', () =>
    {
        const ctx = new StaticContext()
        const records: any[] = []
        ctx.setPersister((record) => records.push(record))

        ctx.append({type: 'scene', view: computed(() => '场景描述')})

        expect(records).toHaveLength(1)
        expect(records[0].type).toBe('scene')
        expect(records[0].text).toBe('场景描述')
    })

    it('persister 对 assistant 类型包含 name', () =>
    {
        const ctx = new StaticContext()
        const records: any[] = []
        ctx.setPersister((record) => records.push(record))

        ctx.append({type: 'assistant', text: '回复内容', name: 'NPC'})

        expect(records).toHaveLength(1)
        expect(records[0].type).toBe('assistant')
        expect(records[0].name).toBe('NPC')
        expect(records[0].text).toBe('回复内容')
    })

    it('getRecentDialogue 返回最近的对话', () =>
    {
        const ctx = new StaticContext()
        ctx.append({type: 'player', text: '消息1', name: '玩家'})
        ctx.append({type: 'assistant', text: '回复1', name: 'NPC'})
        ctx.append({type: 'player', text: '消息2', name: '玩家'})
        ctx.append({type: 'assistant', text: '回复2', name: 'NPC'})

        const recent = ctx.getRecentDialogue(2)
        expect(recent).toHaveLength(2)
        expect(recent[0]).toEqual({name: '玩家', text: '消息2'})
        expect(recent[1]).toEqual({name: 'NPC', text: '回复2'})
    })

    it('scene 类型在 displayMessages 中正确展示', () =>
    {
        const ctx = new StaticContext()
        ctx.append({type: 'scene', view: computed(() => '场景描述')})

        const display = ctx.displayMessages.value
        expect(display).toHaveLength(1)
        expect(display[0]).toEqual({type: 'scene', text: '场景描述'})
    })

    it('char-card 类型在 displayMessages 中包含 name', () =>
    {
        const ctx = new StaticContext()
        ctx.append({
            type: 'char-card',
            view: computed(() => '卡片'),
            charId: 'npc1',
            name: computed(() => '艾琳'),
        })

        const display = ctx.displayMessages.value
        expect(display).toHaveLength(1)
        expect(display[0]).toEqual({type: 'char-card', text: '卡片', name: '艾琳'})
    })

    it('build 包含 scene 类型生成 system role', () =>
    {
        const ctx = new StaticContext()
        ctx.append({type: 'scene', view: computed(() => '场景描述')})
        ctx.commit()

        const msgs = ctx.build()
        expect(msgs).toHaveLength(1)
        expect(msgs[0]).toEqual({role: 'system', content: '场景描述'})
    })

    it('build 包含 char-card 类型生成 system role', () =>
    {
        const ctx = new StaticContext()
        ctx.append({
            type: 'char-card',
            view: computed(() => '角色描述'),
            charId: 'npc1',
            name: computed(() => 'NPC'),
        })
        ctx.commit()

        const msgs = ctx.build()
        expect(msgs).toHaveLength(1)
        expect(msgs[0]).toEqual({role: 'system', content: '角色描述'})
    })

    it('build 包含 assistant 类型生成 assistant role', () =>
    {
        const ctx = new StaticContext()
        ctx.append({type: 'assistant', text: '回复', name: 'NPC'})
        ctx.commit()

        const msgs = ctx.build()
        expect(msgs).toHaveLength(1)
        expect(msgs[0]).toEqual({role: 'assistant', content: '回复', name: 'NPC'})
    })

    it('build 包含 player 类型生成 user role', () =>
    {
        const ctx = new StaticContext()
        ctx.append({type: 'player', text: '输入', name: '玩家'})
        ctx.commit()

        const msgs = ctx.build()
        expect(msgs).toHaveLength(1)
        expect(msgs[0]).toEqual({role: 'user', content: '输入', name: '玩家'})
    })
})

// ---------------------------------------------------------------------------
// fetchWorkspacePrompt
// ---------------------------------------------------------------------------

describe('fetchWorkspacePrompt', () =>
{
    it('returns text from API', async () =>
    {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({text: '工作区提示词'}),
        })
        vi.stubGlobal('fetch', mockFetch)

        const result = await fetchWorkspacePrompt()
        expect(result).toBe('工作区提示词')

        vi.unstubAllGlobals()
    })

    it('returns empty string on error', async () =>
    {
        const mockFetch = vi.fn().mockRejectedValue(new Error('network error'))
        vi.stubGlobal('fetch', mockFetch)

        const result = await fetchWorkspacePrompt()
        expect(result).toBe('')

        vi.unstubAllGlobals()
    })

    it('returns empty string on non-ok response', async () =>
    {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
        })
        vi.stubGlobal('fetch', mockFetch)

        const result = await fetchWorkspacePrompt()
        expect(result).toBe('')

        vi.unstubAllGlobals()
    })

    it('passes startDir parameter', async () =>
    {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({text: '提示词'}),
        })
        vi.stubGlobal('fetch', mockFetch)

        await fetchWorkspacePrompt('scenes/tavern')
        expect(mockFetch).toHaveBeenCalledWith('/__content/system_prompt?startDir=scenes%2Ftavern')

        vi.unstubAllGlobals()
    })
})

// ---------------------------------------------------------------------------
// buildDialogueDynamic - array values in frontmatter
// ---------------------------------------------------------------------------

describe('buildDialogueDynamic with array values', () =>
{
    it('handles array values in frontmatter', () =>
    {
        const char: ContentEntity = {
            id: 'hero',
            type: 'characters',
            frontmatter: {
                name: '英雄',
                tags: ['战士', '勇者'],
                属性: {体力: 100},
            },
            body: '',
        }
        const target: ContentEntity = {
            id: 'npc',
            type: 'characters',
            frontmatter: {name: 'NPC'},
            body: '',
        }

        const msgs = buildDialogueDynamic(target, [char])
        expect(msgs[0].content).toContain('tags')
        expect(msgs[0].content).toContain('战士')
    })
})
