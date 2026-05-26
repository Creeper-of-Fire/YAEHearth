import {merge} from 'lodash-es'

import type {IncomingMessage, ServerResponse} from 'node:http'
import {readdirSync, statSync} from 'node:fs'
import {join, resolve, relative} from 'node:path'
import {parseContentFile, typeFromPath, writeContentFile, type ParsedContent} from './parser'
import {resolveWorkspacePrompt} from './prompt-assembler'
import type {ContentWatcher} from './file-watcher'

function sendJson(res: ServerResponse, data: any): void
{
    res.writeHead(200, {'Content-Type': 'application/json'})
    res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, status: number, message: string): void
{
    res.writeHead(status, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({error: message}))
}

/** 扫描目录，返回该类型下的所有实体 */
function listEntities(contentDir: string, type: string): Array<ParsedContent & {type: string}>
{
    const typeDir = join(contentDir, type)
    if (!statSync(typeDir, {throwIfNoEntry: false})) return []

    const results: Array<ParsedContent & {type: string}> = []
    for (const file of readdirSync(typeDir))
    {
        const filePath = join(typeDir, file)
        if (!statSync(filePath).isFile()) continue
        const fileType = typeFromPath(filePath)
        if (!fileType) continue
        const parsed = parseContentFile(filePath)
        results.push({...parsed, type})
    }
    return results
}

/** 根据类型和 id 查找文件路径 */
function resolveFilePath(contentDir: string, type: string, id: string): string | null
{
    const typeDir = join(contentDir, type)
    if (!statSync(typeDir, {throwIfNoEntry: false})) return null

    for (const file of readdirSync(typeDir))
    {
        if (!file.startsWith(id + '.')) continue
        const filePath = join(typeDir, file)
        if (!statSync(filePath).isFile()) continue
        return filePath
    }
    return null
}

/** 读取请求 body */
function readBody(req: IncomingMessage): Promise<string>
{
    return new Promise((resolve, reject) =>
    {
        let body = ''
        req.on('data', (chunk: Buffer) => body += chunk.toString())
        req.on('end', () => resolve(body))
        req.on('error', reject)
    })
}

/** REST API 中间件 */
export function contentApiMiddleware(contentDir: string, watcher: ContentWatcher)
{
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> =>
    {
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
        const pathParts = url.pathname.replace(/^\/__content\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)

        // GET /__content/system_prompt — 组装工作区系统提示词
        if (req.method === 'GET' && pathParts.length === 1 && pathParts[0] === 'system_prompt')
        {
            const startRel = url.searchParams.get('startDir') ?? ''
            const startDir = resolve(contentDir, startRel)
            // 安全校验：确保 startDir 仍在 contentDir 内
            const rel = relative(contentDir, startDir)
            if (rel.startsWith('..') || resolve(contentDir, rel) !== startDir)
            {
                return sendError(res, 400, 'Invalid startDir')
            }
            return sendJson(res, resolveWorkspacePrompt(contentDir, startDir))
        }

        // GET /__content/types
        if (req.method === 'GET' && pathParts.length === 1 && pathParts[0] === 'types')
        {
            const types: string[] = []
            if (statSync(contentDir, {throwIfNoEntry: false}))
            {
                for (const entry of readdirSync(contentDir))
                {
                    if (statSync(join(contentDir, entry)).isDirectory()) types.push(entry)
                }
            }
            return sendJson(res, types)
        }

        // GET /__content/:type — 列出所有实体
        if (req.method === 'GET' && pathParts.length === 1)
        {
            const type = pathParts[0]
            return sendJson(res, listEntities(contentDir, type))
        }

        // GET /__content/:type/:id — 获取单个实体
        if (req.method === 'GET' && pathParts.length === 2)
        {
            const [type, id] = pathParts
            const filePath = resolveFilePath(contentDir, type, id)
            if (!filePath) return sendError(res, 404, `Entity ${type}/${id} not found`)
            const parsed = parseContentFile(filePath)
            return sendJson(res, {...parsed, type})
        }

        // PATCH /__content/:type/:id — 合并更新 frontmatter
        if (req.method === 'PATCH' && pathParts.length === 2)
        {
            const [type, id] = pathParts
            const filePath = resolveFilePath(contentDir, type, id)
            if (!filePath) return sendError(res, 404, `Entity ${type}/${id} not found`)

            const body = await readBody(req)
            let patch: Record<string, any>
            try
            {
                patch = JSON.parse(body)
            } catch
            {
                return sendError(res, 400, 'Invalid JSON')
            }

            const parsed = parseContentFile(filePath)
            merge(parsed.frontmatter, patch)
            writeContentFile(filePath, parsed)

            // 记录写入时间戳，供 watcher 防抖
            watcher.writeTimestamps.set(filePath, Date.now())

            return sendJson(res, {...parsed, type})
        }

        // PUT /__content/:type/:id — 替换整个实体
        if (req.method === 'PUT' && pathParts.length === 2)
        {
            const [type, id] = pathParts
            const filePath = resolveFilePath(contentDir, type, id)
            if (!filePath) return sendError(res, 404, `Entity ${type}/${id} not found`)

            const body = await readBody(req)
            let replacement: { frontmatter?: Record<string, any>; body?: string }
            try
            {
                replacement = JSON.parse(body)
            } catch
            {
                return sendError(res, 400, 'Invalid JSON')
            }

            const parsed = parseContentFile(filePath)
            if (replacement.frontmatter) parsed.frontmatter = replacement.frontmatter
            if (replacement.body !== undefined) parsed.body = replacement.body
            writeContentFile(filePath, parsed)

            watcher.writeTimestamps.set(filePath, Date.now())

            return sendJson(res, {...parsed, type})
        }

        sendError(res, 404, 'Not found')
    }
}
