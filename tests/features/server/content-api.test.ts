import {afterEach, describe, expect, it, vi, beforeEach} from 'vitest'
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {contentApiMiddleware} from '@/features/server/content-api'

// 创建模拟的 req/res 对象
function mockRequest(url: string, method = 'GET', body?: string)
{
    const req: any = {
        method,
        url,
        headers: {host: 'localhost'},
        on: vi.fn((event: string, fn: Function) =>
        {
            if (event === 'data' && !body)
            {
                // 无 body
            }
            if (event === 'end' && !body)
            {
                fn()
            }
        }),
    }

    if (body)
    {
        let dataCalled = false
        let endCalled = false
        req.on = vi.fn((event: string, fn: Function) =>
        {
            if (event === 'data')
            {
                dataCalled = true
                fn(Buffer.from(body))
            }
            if (event === 'end')
            {
                endCalled = true
                fn()
            }
        })
    }

    return req
}

function mockResponse()
{
    const res: any = {
        writeHead: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
        _getData(): any
        {
            const calls = this.end.mock.calls
            if (calls.length > 0)
            {
                try
                {
                    return JSON.parse(calls[0][0])
                } catch
                {
                    return calls[0][0]
                }
            }
            return null
        },
        _getStatus(): number
        {
            const calls = this.writeHead.mock.calls
            return calls.length > 0 ? calls[0][0] : 0
        },
    }
    return res
}

const mockWatcher = {
    writeTimestamps: new Map<string, number>(),
    onEvent: vi.fn(),
    close: vi.fn(),
}

describe('contentApiMiddleware', () =>
{
    let tmpDir: string
    let middleware: ReturnType<typeof contentApiMiddleware>

    beforeEach(() =>
    {
        tmpDir = mkdtempSync(join(tmpdir(), 'api-test-'))
        mkdirSync(join(tmpDir, 'characters'), {recursive: true})
        mkdirSync(join(tmpDir, 'scenes'), {recursive: true})
        middleware = contentApiMiddleware(tmpDir, mockWatcher as any)
    })

    afterEach(() =>
    {
        rmSync(tmpDir, {recursive: true, force: true})
    })

    it('GET /types 返回内容类型列表', async () =>
    {
        const req = mockRequest('/__content/types')
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data).toContain('characters')
        expect(data).toContain('scenes')
    })

    it('GET /:type 列出该类型下所有实体', async () =>
    {
        writeFileSync(join(tmpDir, 'characters', 'hero.chr'), '---\nname: 英雄\n---\n英雄描述', 'utf-8')

        const req = mockRequest('/__content/characters')
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(Array.isArray(data)).toBe(true)
        expect(data).toHaveLength(1)
        expect(data[0].id).toBe('hero')
        expect(data[0].frontmatter.name).toBe('英雄')
    })

    it('GET /:type/:id 获取单个实体', async () =>
    {
        writeFileSync(join(tmpDir, 'characters', 'hero.chr'), '---\nname: 英雄\n---\n英雄描述', 'utf-8')

        const req = mockRequest('/__content/characters/hero')
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data.id).toBe('hero')
        expect(data.type).toBe('characters')
    })

    it('GET /:type/:id 实体不存在返回 404', async () =>
    {
        const req = mockRequest('/__content/characters/missing')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(404)
    })

    it('PATCH /:type/:id 合并更新 frontmatter', async () =>
    {
        writeFileSync(join(tmpDir, 'characters', 'hero.chr'), '---\nname: 英雄\nage: 25\n---\n描述', 'utf-8')

        const req = mockRequest('/__content/characters/hero', 'PATCH', JSON.stringify({age: 26}))
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data.frontmatter.age).toBe(26)
        expect(data.frontmatter.name).toBe('英雄')

        // 验证文件也被更新
        const raw = readFileSync(join(tmpDir, 'characters', 'hero.chr'), 'utf-8')
        expect(raw).toContain('age: 26')
    })

    it('PUT /:type/:id 替换整个实体', async () =>
    {
        writeFileSync(join(tmpDir, 'characters', 'hero.chr'), '---\nname: 英雄\n---\n旧描述', 'utf-8')

        const req = mockRequest(
            '/__content/characters/hero',
            'PUT',
            JSON.stringify({frontmatter: {name: '新英雄'}, body: '新描述'}),
        )
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data.frontmatter.name).toBe('新英雄')
        expect(data.body).toBe('新描述')
    })

    it('GET /system_prompt 返回组装的提示词', async () =>
    {
        mkdirSync(join(tmpDir, 'system_prompts'), {recursive: true})
        writeFileSync(join(tmpDir, 'system_prompts', '[0001]规则.md'), '全局规则', 'utf-8')

        const req = mockRequest('/__content/system_prompt')
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data.text).toBe('全局规则')
    })

    it('GET /system_prompt 非法 startDir 返回 400', async () =>
    {
        const req = mockRequest('/__content/system_prompt?startDir=../../../etc')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(400)
    })

    it('PATCH 无效 JSON 返回 400', async () =>
    {
        writeFileSync(join(tmpDir, 'characters', 'hero.chr'), '---\nname: 英雄\n---\n描述', 'utf-8')

        const req = mockRequest('/__content/characters/hero', 'PATCH', 'not-json')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(400)
    })

    it('PUT 无效 JSON 返回 400', async () =>
    {
        writeFileSync(join(tmpDir, 'characters', 'hero.chr'), '---\nname: 英雄\n---\n描述', 'utf-8')

        const req = mockRequest('/__content/characters/hero', 'PUT', 'not-json')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(400)
    })

    it('未知路由返回 404', async () =>
    {
        const req = mockRequest('/__content/unknown/path')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(404)
    })

    it('GET /:type 空目录返回空数组', async () =>
    {
        const req = mockRequest('/__content/items')
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data).toEqual([])
    })

    it('GET /:type 忽略非内容文件', async () =>
    {
        writeFileSync(join(tmpDir, 'characters', 'readme.txt'), 'Not a content file', 'utf-8')
        writeFileSync(join(tmpDir, 'characters', 'hero.chr'), '---\nname: 英雄\n---\n描述', 'utf-8')

        const req = mockRequest('/__content/characters')
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data).toHaveLength(1)
    })

    it('GET /:type 不存在的类型目录返回空数组', async () =>
    {
        // 创建新的 middleware 指向没有 items 目录的 tmp
        const m = contentApiMiddleware(tmpDir, mockWatcher as any)
        const req = mockRequest('/__content/nonexistent')
        const res = mockResponse()
        await m(req as any, res as any)

        const data = res._getData()
        expect(data).toEqual([])
    })

    it('PUT 只更新 body', async () =>
    {
        writeFileSync(join(tmpDir, 'characters', 'hero.chr'), '---\nname: 英雄\n---\n旧描述', 'utf-8')

        const req = mockRequest(
            '/__content/characters/hero',
            'PUT',
            JSON.stringify({body: '新描述'}),
        )
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data.body).toBe('新描述')
        expect(data.frontmatter.name).toBe('英雄')
    })

    it('GET /system_prompt 有效 startDir', async () =>
    {
        mkdirSync(join(tmpDir, 'scenes', 'system_prompts'), {recursive: true})
        writeFileSync(join(tmpDir, 'scenes', 'system_prompts', '[0001]场景规则.md'), '场景规则', 'utf-8')

        const req = mockRequest('/__content/system_prompt?startDir=scenes')
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data.text).toBe('场景规则')
    })

    it('GET /__content/ 根路径返回 404', async () =>
    {
        const req = mockRequest('/__content/')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(404)
    })

    it('GET /types 混合文件和目录，只返回目录', async () =>
    {
        // 在 contentDir 根下放一个文件和一个新目录
        writeFileSync(join(tmpDir, 'readme.txt'), 'readme', 'utf-8')
        mkdirSync(join(tmpDir, 'items'), {recursive: true})

        const req = mockRequest('/__content/types')
        const res = mockResponse()
        await middleware(req as any, res as any)

        const data = res._getData()
        expect(data).toContain('characters')
        expect(data).toContain('scenes')
        expect(data).toContain('items')
        // readme.txt 不是目录，不应出现
        expect(data).not.toContain('readme.txt')
    })

    it('GET /:type/:id PATCH 找不到文件返回 404', async () =>
    {
        const req = mockRequest('/__content/characters/nonexistent', 'PATCH', JSON.stringify({a: 1}))
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(404)
    })

    it('GET /:type/:id PUT 找不到文件返回 404', async () =>
    {
        const req = mockRequest('/__content/characters/nonexistent', 'PUT', JSON.stringify({body: 'x'}))
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(404)
    })
})
