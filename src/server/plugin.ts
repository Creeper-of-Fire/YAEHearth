import type {Plugin} from 'vite'
import {contentApiMiddleware} from './content-api'
import {dialogueApiMiddleware} from './dialogue-api'
import {startWatcher, sseMiddleware} from './file-watcher'

export function contentPlugin(contentDir: string, dialoguesDir: string): Plugin
{
    return {
        name: 'vite-plugin-content',
        configureServer(server)
        {
            const watcher = startWatcher(contentDir)

            // SSE 端点
            server.middlewares.use('/__content/events', sseMiddleware(watcher))

            // REST API
            server.middlewares.use('/__content', contentApiMiddleware(contentDir, watcher))

            // 对话持久化
            server.middlewares.use('/__dialogues', dialogueApiMiddleware(dialoguesDir))

            server.httpServer?.on('close', () =>
            {
                watcher.close()
            })
        },
    }
}
