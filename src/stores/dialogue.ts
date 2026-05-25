import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import {useGameStore} from '@/stores/game'
import {useContentStore} from '@/content/store'
import {useLogStore} from '@/stores/log'
import {buildDialogueDynamic, buildMoodDynamic, StaticContext, SYSTEM_PROMPT} from '@/services/prompts'
import type {ChatMsg, UsageSnapshot} from '@/services/agent'
import {DialogueRequest, MoodRequest} from '@/services/agent'
import type {ContentEntity} from '@/content/types'

export const useDialogueStore = defineStore('dialogue', () =>
{
    const gameStore = useGameStore()
    const contentStore = useContentStore()
    const targetCharacterId = ref<string | null>(null)
    const busy = ref(false)
    const ctx = new StaticContext()

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

    function initDialogue(charId: string)
    {
        targetCharacterId.value = charId
        ctx.reset()
        resetUsage()
        ctx.append({type: 'system', text: SYSTEM_PROMPT})
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
        ensureCharacterCard(targetCharacterId.value)
        const log = useLogStore()
        const target = findTarget(targetCharacterId.value)
        const speakerName = target?.frontmatter.name ?? '???'

        ctx.append({type: 'player', text, name: '玩家'})
        log.info(`玩家: ${text.slice(0, 30)}`)

        try
        {
            ctx.commit()
            const staticMsgs = ctx.build()
            const dynamicMsgs = buildDialogueDynamic(target!, gameStore.characters)
            const messages: ChatMsg[] = [...staticMsgs, ...dynamicMsgs]

            const dialogueResult = await new DialogueRequest()
                .withMessages(messages)
                .execute()

            accumulateUsage(dialogueResult.usage)
            let aiText = dialogueResult.text

            ctx.append({type: 'assistant', text: aiText, name: speakerName})

            const moodDynMsgs = buildMoodDynamic(target!, aiText)
            const moodMessages: ChatMsg[] = [...messages, ...moodDynMsgs]

            const moodResult = await new MoodRequest()
                .withMessages(moodMessages)
                .execute()

            accumulateUsage(moodResult.usage)
            cumulativeUsage.value.turnCount++

            if (target)
            {
                const patch: Record<string, any> = {}
                if (moodResult.mood) patch.mood = moodResult.mood
                const currentAffection = (target.frontmatter.affection as number) ?? 0
                patch.affection = Math.max(0, Math.min(5, currentAffection + moodResult.affectionDelta))
                await contentStore.updateFrontmatter('characters', target.id, patch)
            }

            log.info(`${speakerName}: ${aiText.slice(0, 40)}`)
            ctx.commit()
        } catch (e)
        {
            log.error(`Agent 调用失败: ${e}`)
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
