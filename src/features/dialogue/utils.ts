export function makeSessionFile(sceneId: string, charId: string): string
{
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    return `${sceneId}_${charId}_${stamp}.jsonl`
}

export function getNestedValue(obj: Record<string, any>, path: string): any
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

export function setNestedValue(obj: Record<string, any>, path: string, value: any): void
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
