/**
 * 集成测试: 全链路内容生命周期
 *
 * 用 Node http.createServer 搭建真实服务器，验证端到端流程:
 * 1. 启动 → 加载已有内容
 * 2. 创建实体 → GET 验证可见
 * 3. PATCH 更新 → 文件写入 + GET 返回新值
 * 4. PUT 替换 → 文件完全替换
 * 5. 对话记录 → 追加到 JSONL + 每行合法 JSON
 * 6. system_prompt → 目录遍历 + 排序 + 拼装
 * 7. 错误路径 → 404/400 正确响应
 */
import {afterEach, describe, expect, it, beforeEach} from 'vitest'
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createServer, type Server, type IncomingMessage, type ServerResponse} from 'node:http'
import type {AddressInfo} from 'node:net'
import {contentApiMiddleware} from '@/features/server/content-api'
import {dialogueApiMiddleware} from '@/features/server/dialogue-api'
import {startWatcher} from '@/features/server/file-watcher'

// --- HTTP 辅助 ---

function httpRequest(
    port: number,
    method: string,
    path: string,
    body?: string,
): Promise<{status: number; data: any}>
{
    return new Promise((resolve, reject) =>
    {
        const options = {
            hostname: 'localhost',
            port,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(body ? {'Content-Length': Buffer.byteLength(body)} : {}),
            },
        }

        const httpReq = require('node:http').request(options, (res: IncomingMessage) =>
        {
            let data = ''
            res.on('data', (chunk: Buffer) => (data += chunk))
            res.on('end', () =>
            {
                let parsed: any
                try
                {
                    parsed = JSON.parse(data)
                } catch
                {
                    parsed = data
                }
                resolve({status: res.statusCode ?? 0, data: parsed})
            })
        })
        httpReq.on('error', reject)
        if (body) httpReq.write(body)
        httpReq.end()
    })
}

describe('集成: 全链路内容生命周期', () =>
{
    let contentDir: string
    let dialoguesDir: string
    let server: Server
    let port: number
    let watcher: ReturnType<typeof startWatcher>

    beforeEach(async () =>
    {
        contentDir = mkdtempSync(join(tmpdir(), 'lifecycle-content-'))
        dialoguesDir = mkdtempSync(join(tmpdir(), 'lifecycle-dlg-'))

        // 预设目录结构
        mkdirSync(join(contentDir, 'characters'), {recursive: true})
        mkdirSync(join(contentDir, 'scenes'), {recursive: true})
        mkdirSync(join(contentDir, 'items'), {recursive: true})

        // 预设内容
        writeFileSync(
            join(contentDir, 'characters', 'player.chr'),
            '---\nname: 玩家\n属性:\n  体力: 100\n  魔力: 50\n---\n玩家角色卡',
            'utf-8',
        )
        writeFileSync(
            join(contentDir, 'scenes', 'tavern.scn'),
            '---\nname: 酒馆之夜\ncharacters:\n  - player\n---\n你推开酒馆沉重的木门...',
            'utf-8',
        )
        writeFileSync(
            join(contentDir, 'items', 'sword.itm'),
            '---\nname: 铁剑\n攻击: 10\n---\n一把普通的铁剑',
            'utf-8',
        )

        // 启动 watcher
        watcher = startWatcher(contentDir)

        // 创建 HTTP 服务器，挂载两个中间件
        const contentMiddleware = contentApiMiddleware(contentDir, watcher)
        const dialogueMiddleware = dialogueApiMiddleware(dialoguesDir)

        server = createServer((req: IncomingMessage, res: ServerResponse) =>
        {
            const url = req.url ?? '/'
            if (url.startsWith('/__dialogues'))
            {
                dialogueMiddleware(req, res)
            } else
            {
                contentMiddleware(req, res)
            }
        })

        await new Promise<void>(r => server.listen(0, () => r()))
        port = (server.address() as AddressInfo).port
    })

    afterEach(() =>
    {
        watcher?.close()
        server?.close()
        rmSync(contentDir, {recursive: true, force: true})
        rmSync(dialoguesDir, {recursive: true, force: true})
    })

    // --- 阶段 1: 启动加载 ---

    it('加载所有预设类型', async () =>
    {
        const {status, data} = await httpRequest(port, 'GET', '/__content/types')
        expect(status).toBe(200)
        expect(data.sort()).toEqual(['characters', 'items', 'scenes'])
    })

    it('加载所有角色', async () =>
    {
        const {data} = await httpRequest(port, 'GET', '/__content/characters')
        expect(data).toHaveLength(1)
        expect(data[0].id).toBe('player')
        expect(data[0].frontmatter.name).toBe('玩家')
        expect(data[0].frontmatter.属性.体力).toBe(100)
    })

    it('加载场景', async () =>
    {
        const {data} = await httpRequest(port, 'GET', '/__content/scenes')
        expect(data).toHaveLength(1)
        expect(data[0].id).toBe('tavern')
        expect(data[0].frontmatter.name).toBe('酒馆之夜')
    })

    it('加载物品', async () =>
    {
        const {data} = await httpRequest(port, 'GET', '/__content/items')
        expect(data).toHaveLength(1)
        expect(data[0].id).toBe('sword')
        expect(data[0].frontmatter.攻击).toBe(10)
    })

    // --- 阶段 2: 创建新实体（通过外部文件写入 + GET 验证）---

    it('外部创建文件后 GET 可见', async () =>
    {
        writeFileSync(
            join(contentDir, 'characters', 'npc.chr'),
            '---\nname: 酒保\n---\n酒保描述',
            'utf-8',
        )

        // 等待文件系统同步（readFileSync 是同步的，不需要等）
        const {data} = await httpRequest(port, 'GET', '/__content/characters')
        expect(data).toHaveLength(2)
        const npc = data.find((e: any) => e.id === 'npc')
        expect(npc).toBeDefined()
        expect(npc.frontmatter.name).toBe('酒保')
    })

    // --- 阶段 3: PATCH 更新 ---

    it('PATCH 部分更新 frontmatter', async () =>
    {
        // 更新嵌套字段
        const {status, data} = await httpRequest(
            port, 'PATCH', '/__content/characters/player',
            JSON.stringify({属性: {体力: 80}}),
        )
        expect(status).toBe(200)
        expect(data.frontmatter.属性.体力).toBe(80)
        // 魔力应该保留
        expect(data.frontmatter.属性.魔力).toBe(50)

        // 验证文件也更新了
        const raw = readFileSync(join(contentDir, 'characters', 'player.chr'), 'utf-8')
        expect(raw).toContain('体力: 80')

        // 再次 GET 验证持久化
        const {data: fresh} = await httpRequest(port, 'GET', '/__content/characters/player')
        expect(fresh.frontmatter.属性.体力).toBe(80)
    })

    // --- 阶段 4: PUT 替换 ---

    it('PUT 完全替换实体', async () =>
    {
        const {status, data} = await httpRequest(
            port, 'PUT', '/__content/items/sword',
            JSON.stringify({frontmatter: {name: '传说中的圣剑', 攻击: 999}, body: '闪耀着金色光芒'}),
        )
        expect(status).toBe(200)
        expect(data.frontmatter.name).toBe('传说中的圣剑')
        expect(data.frontmatter.攻击).toBe(999)
        expect(data.body).toBe('闪耀着金色光芒')

        // 文件验证
        const raw = readFileSync(join(contentDir, 'items', 'sword.itm'), 'utf-8')
        expect(raw).toContain('传说中的圣剑')
        expect(raw).toContain('闪耀着金色光芒')
    })

    // --- 阶段 5: 对话记录 ---

    it('完整对话记录写入并验证', async () =>
    {
        const sessionId = `test_${Date.now()}.jsonl`

        // 模拟一轮完整对话
        const records = [
            {ts: '2024-01-01T00:00:00Z', type: 'system', text: '系统提示'},
            {ts: '2024-01-01T00:00:01Z', type: 'player', text: '你好，酒保'},
            {ts: '2024-01-01T00:00:02Z', type: 'assistant', text: '欢迎光临！'},
            {ts: '2024-01-01T00:00:03Z', type: 'player', text: '来杯啤酒'},
            {ts: '2024-01-01T00:00:04Z', type: 'assistant', text: '好的，稍等'},
        ]

        for (const record of records)
        {
            const {status} = await httpRequest(
                port, 'POST', '/__dialogues/append',
                JSON.stringify({file: sessionId, record}),
            )
            expect(status).toBe(200)
        }

        // 验证 JSONL 文件
        const content = readFileSync(join(dialoguesDir, sessionId), 'utf-8')
        const lines = content.trim().split('\n')
        expect(lines).toHaveLength(5)

        // 每行必须是合法 JSON
        for (const line of lines)
        {
            const parsed = JSON.parse(line)
            expect(parsed).toHaveProperty('ts')
            expect(parsed).toHaveProperty('type')
            expect(parsed).toHaveProperty('text')
        }

        // 验证对话顺序
        const parsed = lines.map(l => JSON.parse(l))
        expect(parsed[0].type).toBe('system')
        expect(parsed[1].text).toBe('你好，酒保')
        expect(parsed[2].text).toBe('欢迎光临！')
    })

    // --- 阶段 6: system_prompt 端到端 ---

    it('system_prompt 目录遍历 + 排序 + 拼装', async () =>
    {
        mkdirSync(join(contentDir, 'system_prompts'), {recursive: true})
        mkdirSync(join(contentDir, 'scenes', 'system_prompts'), {recursive: true})

        writeFileSync(join(contentDir, 'system_prompts', '[0100]全局规则.md'), '全局规则', 'utf-8')
        writeFileSync(join(contentDir, 'scenes', 'system_prompts', '[0050]场景规则.md'), '场景规则', 'utf-8')

        const {status, data} = await httpRequest(
            port, 'GET', '/__content/system_prompt?startDir=scenes',
        )
        expect(status).toBe(200)

        // 内层 (scenes/system_prompts, depth=0) 的序号 50 先于外层 (depth=1) 的序号 100
        expect(data.text).toBe('场景规则\n\n全局规则')
        expect(data.sources).toHaveLength(2)
    })

    // --- 阶段 7: 错误路径 ---

    it('获取不存在的实体返回 404', async () =>
    {
        const {status, data} = await httpRequest(port, 'GET', '/__content/characters/ghost')
        expect(status).toBe(404)
        expect(data.error).toBeTruthy()
    })

    it('无效 JSON 的 PATCH 返回 400', async () =>
    {
        const {status} = await httpRequest(
            port, 'PATCH', '/__content/characters/player',
            'not valid json',
        )
        expect(status).toBe(400)
    })

    it('非法 startDir 返回 400', async () =>
    {
        const {status} = await httpRequest(
            port, 'GET', '/__content/system_prompt?startDir=../../etc',
        )
        expect(status).toBe(400)
    })

    it('对话 API 无效 JSON 返回 400', async () =>
    {
        const {status} = await httpRequest(
            port, 'POST', '/__dialogues/append',
            'bad json',
        )
        expect(status).toBe(400)
    })

    it('对话 API 危险文件名返回 400', async () =>
    {
        const {status} = await httpRequest(
            port, 'POST', '/__dialogues/append',
            JSON.stringify({file: '../../etc/passwd', record: {ts: 'x', type: 'x', text: 'x'}}),
        )
        expect(status).toBe(400)
    })
})
