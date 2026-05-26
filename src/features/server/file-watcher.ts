import type {FSWatcher} from 'chokidar'
import chokidar from 'chokidar'
import type {IncomingMessage, ServerResponse} from 'node:http'
import {basename, dirname} from 'node:path'
import {parseContentFile, typeFromPath, type ParsedContent} from './parser'

const PROMPT_FOLDER_NAME = 'system_prompts'

/** 检测文件是否位于 system_prompts 目录下 */
function isPromptFile(filePath: string): boolean
{
    return filePath.endsWith('.md') && basename(dirname(filePath)) === PROMPT_FOLDER_NAME
}

export interface WatcherEvent
{
    action: 'add' | 'change' | 'delete'
    type: string
    id: string
    entity?: ParsedContent & {type: string}
}

export interface ContentWatcher
{
    /** 最近写入时间戳，用于防抖 */
    writeTimestamps: Map<string, number>
    onEvent(fn: (event: WatcherEvent) => void): () => void
    close(): void
}

export function startWatcher(contentDir: string): ContentWatcher
{
    const listeners = new Set<(event: WatcherEvent) => void>()
    const writeTimestamps = new Map<string, number>()

    const watcher: FSWatcher = chokidar.watch(contentDir, {
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 50,
        },
    })

    function emit(event: WatcherEvent): void
    {
        for (const fn of listeners) fn(event)
    }

    watcher.on('add', (filePath) =>
    {
        const type = typeFromPath(filePath)
        if (type)
        {
            const parsed = parseContentFile(filePath)
            emit({action: 'add', type, id: parsed.id, entity: {...parsed, type}})
        }
        else if (isPromptFile(filePath))
        {
            const id = basename(filePath).replace(/\.md$/, '')
            emit({action: 'add', type: PROMPT_FOLDER_NAME, id})
        }
    })

    watcher.on('change', (filePath) =>
    {
        const type = typeFromPath(filePath)
        if (type)
        {
            // 防抖：跳过 API 写入后 200ms 内的自身触发
            const lastWrite = writeTimestamps.get(filePath) ?? 0
            if (Date.now() - lastWrite < 200) return
            const parsed = parseContentFile(filePath)
            emit({action: 'change', type, id: parsed.id, entity: {...parsed, type}})
        }
        else if (isPromptFile(filePath))
        {
            const lastWrite = writeTimestamps.get(filePath) ?? 0
            if (Date.now() - lastWrite < 200) return
            const id = basename(filePath).replace(/\.md$/, '')
            emit({action: 'change', type: PROMPT_FOLDER_NAME, id})
        }
    })

    watcher.on('unlink', (filePath) =>
    {
        const type = typeFromPath(filePath)
        if (type)
        {
            const id = basename(filePath).replace(/\.[^.]+$/, '')
            emit({action: 'delete', type, id})
        }
        else if (isPromptFile(filePath))
        {
            const id = basename(filePath).replace(/\.md$/, '')
            emit({action: 'delete', type: PROMPT_FOLDER_NAME, id})
        }
    })

    return {
        writeTimestamps,
        onEvent(fn)
        {
            listeners.add(fn)
            return () => listeners.delete(fn)
        },
        close()
        {
            void watcher.close()
        },
    }
}

/** SSE 中间件 */
export function sseMiddleware(watcher: ContentWatcher)
{
    return (req: IncomingMessage, res: ServerResponse): void =>
    {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        })

        const unsubscribe = watcher.onEvent((event) =>
        {
            res.write(`data: ${JSON.stringify(event)}\n\n`)
        })

        req.on('close', () =>
        {
            unsubscribe()
        })
    }
}
