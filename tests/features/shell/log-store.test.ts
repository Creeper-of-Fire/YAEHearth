import {describe, expect, it, beforeEach} from 'vitest'
import {useLogStore} from '@/features/shell/log-store'

describe('useLogStore', () =>
{
    let store: ReturnType<typeof useLogStore>

    beforeEach(() =>
    {
        store = useLogStore()
        store.entries.value = []
    })

    it('info 添加 info 级别日志', () =>
    {
        store.info('信息')
        expect(store.entries.value).toHaveLength(1)
        expect(store.entries.value[0]).toEqual(
            expect.objectContaining({level: 'info', message: '信息'}),
        )
    })

    it('debug 添加 debug 级别日志', () =>
    {
        store.debug('调试')
        expect(store.entries.value[0].level).toBe('debug')
    })

    it('warn 添加 warn 级别日志', () =>
    {
        store.warn('警告')
        expect(store.entries.value[0].level).toBe('warn')
    })

    it('error 添加 error 级别日志', () =>
    {
        store.error('错误')
        expect(store.entries.value[0].level).toBe('error')
    })

    it('日志条数超过 500 时截断', () =>
    {
        for (let i = 0; i < 510; i++)
        {
            store.info(`消息${i}`)
        }
        expect(store.entries.value).toHaveLength(500)
        expect(store.entries.value[0].message).toBe('消息10')
    })

    it('日志条目包含时间戳', () =>
    {
        store.info('测试')
        expect(store.entries.value[0].time).toBeTruthy()
    })
})
