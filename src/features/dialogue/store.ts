import {defineStore} from 'pinia'
import {computed, ref, shallowRef} from 'vue'
import {useGameStore} from '@/features/game/store'
import {useContentStore} from '@/features/content/store'
import {useLogStore} from '@/features/shell/log-store'
import {buildDialogueDynamic, buildEditorDynamic, fetchWorkspacePrompt, StaticContext, SYSTEM_PROMPT, type PersistRecord} from './prompts'
import type {ChatMsg, UsageSnapshot} from './agent'
import {DialogueRequest, EditorRequest} from './agent'
import type {ContentEntity} from '@/shared/types'
import {makeSessionFile, getNestedValue, setNestedValue} from './utils'

export const useDialogueStore = defineStore('dialogue', () =>
{
    const gameStore = useGameStore()
    const contentStore = useContentStore()
    const targetCharacterId = shallowRef<string | null>(null)
    const busy = shallowRef(false)
    const ctx = new StaticContext()
    const sessionFile = shallowRef<string | null>(null)

    ctx.setPersister((record: PersistRecord) =>
    {
        if (!sessionFile.value) return
        fetch('/__dialogues/append', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file: sessionFile.value, record}),
        }).catch(() => {})
    })

    const displayMessages = computed(() => ctx.displayMessages.value)

    const cumulativeUsage = ref({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cacheHitTokens: 0,
        cacheMissTokens: 0,
        turnCount: 0,
    })

    const cacheHitRate = computed(() =>
    {
        const total = cumulativeUsage.value.promptTokens
        return total === 0 ? 0 : cumulativeUsage.value.cacheHitTokens / total
    })

    function accumulateUsage(snapshot: UsageSnapshot | null)
    {
        if (!snapshot) return
        const c = cumulativeUsage.value
        c.promptTokens += snapshot.promptTokens
        c.completionTokens += snapshot.completionTokens
        c.totalTokens += snapshot.totalTokens
        c.cacheHitTokens += snapshot.cacheHitTokens
        c.cacheMissTokens += snapshot.cacheMissTokens
    }

    function resetUsage()
    {
        cumulativeUsage.value = {
            promptTokens: 0, completionTokens: 0, totalTokens: 0,
            cacheHitTokens: 0, cacheMissTokens: 0, turnCount: 0,
        }
    }

    function findTarget(charId: string): ContentEntity | undefined
    {
        return contentStore.getEntity('characters', charId)
    }

    function ensureCharacterCard(charId: string)
    {
        if (ctx.loadedCardIds.includes(charId)) return
        const entity = findTarget(charId)
        if (!entity) return
        ctx.append({
            type: 'char-card',
            view: computed(() => entity.body),
            charId,
            name: computed(() => String(entity.frontmatter.name ?? charId)),
        })
    }

    async function initDialogue(charId: string)
    {
        targetCharacterId.value = charId
        ctx.reset()
        resetUsage()

        const sceneId = gameStore.activeSceneId
        sessionFile.value = makeSessionFile(sceneId, charId)

        ctx.append({type: 'system', text: SYSTEM_PROMPT})

        const workspacePrompt = await fetchWorkspacePrompt()
        if (workspacePrompt)
        {
            ctx.append({type: 'system', text: workspacePrompt})
        }

        ctx.commit()

        const scene = gameStore.activeScene
        ctx.append({
            type: 'scene',
            view: computed(() => scene?.body ?? ''),
        })
        ctx.commit()

        const target = findTarget(charId)
        useLogStore().info(`对话目标: ${target?.frontmatter.name ?? '???'}`)
    }

    async function sendMessage(text: string)
    {
        if (busy.value || !targetCharacterId.value) return
        busy.value = true
        ensureCharacterCard('player')
        ensureCharacterCard(targetCharacterId.value)
        const log = useLogStore()
        const target = findTarget(targetCharacterId.value)
        const speakerName = target?.frontmatter.name ?? '???'

        ctx.append({type: 'player', text, name: '玩家'})
        log.info(`玩家: ${text}`)

        // 已加载静态人物卡的角色实体——"谁在场"的唯一真相来源
        const loadedEntities = ctx.loadedCardIds
            .map(id => contentStore.getEntity('characters', id))
            .filter((e): e is ContentEntity => e !== undefined)

        try
        {
            ctx.commit()
            const staticMsgs = ctx.build()
            const dynamicMsgs = buildDialogueDynamic(target!, loadedEntities)
            const messages: ChatMsg[] = [...staticMsgs, ...dynamicMsgs]

            const dialogueResult = await new DialogueRequest()
                .withMessages(messages)
                .execute()

            accumulateUsage(dialogueResult.usage)
            const aiText = dialogueResult.text

            ctx.append({type: 'assistant', text: aiText, name: speakerName})
            log.info(`${speakerName}: ${aiText}`)
            ctx.commit()

            // 编辑操作独立 try-catch，失败不影响对话显示
            try
            {
                const editorDynMsgs = buildEditorDynamic(loadedEntities, aiText)
                const editorMessages: ChatMsg[] = [...messages, ...editorDynMsgs]

                const editResult = await new EditorRequest()
                    .withMessages(editorMessages)
                    .execute()

                accumulateUsage(editResult.usage)
                cumulativeUsage.value.turnCount++

                // 按 entity 分组应用
                const byEntity = new Map<string, Record<string, any>>()
                for (const op of editResult.operations)
                {
                    const entity = contentStore.getEntity('characters', op.entity)
                    if (!entity)
                    {
                        log.warn(`编辑操作跳过: 找不到角色 ${op.entity}`)
                        continue
                    }

                    let patch = byEntity.get(op.entity)
                    if (!patch)
                    {
                        patch = {}
                        byEntity.set(op.entity, patch)
                    }

                    if (op.op === 'set-string')
                    {
                        setNestedValue(patch, op.path, op.value)
                    }
                    else if (op.op === 'adjust-number')
                    {
                        const current = getNestedValue(entity.frontmatter, op.path) ?? 0
                        setNestedValue(patch, op.path, current + op.delta)
                    }
                    else if (op.op === 'push-to-list')
                    {
                        const list = [...(getNestedValue(entity.frontmatter, op.path) ?? [])]
                        list.push(op.value)
                        setNestedValue(patch, op.path, list)
                    }
                }

                for (const [entityId, patch] of byEntity)
                {
                    if (Object.keys(patch).length > 0)
                    {
                        try
                        {
                            await contentStore.updateFrontmatter('characters', entityId, patch)
                            log.info(`字段编辑已应用: ${entityId} → ${Object.keys(patch).join(', ')}`)
                        } catch (e)
                        {
                            log.warn(`字段编辑失败 (${entityId}, 字段: ${Object.keys(patch).join(', ')}): ${e}`)
                        }
                    }
                }
            } catch (e)
            {
                log.warn(`字段编辑失败: ${e}`)
            }
        } catch (e)
        {
            log.error(`对话生成失败: ${e}`)
            ctx.append({type: 'assistant', text: '（沉默）', name: speakerName})
            ctx.commit()
        } finally
        {
            busy.value = false
        }
    }

    function endConversation()
    {
        targetCharacterId.value = null
        sessionFile.value = null
        ctx.reset()
        resetUsage()
        useLogStore().info('对话已结束')
    }

    return {
        targetCharacterId,
        busy,
        displayMessages,
        cumulativeUsage,
        cacheHitRate,
        initDialogue,
        sendMessage,
        endConversation,
    }
})
