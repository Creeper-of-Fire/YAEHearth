from __future__ import annotations

from .models import Character, SceneState

SYSTEM_TEMPLATE = """\
你是「{location}」的角色扮演引擎。

## 场景
时间：{time_of_day}
氛围：{atmosphere}

## 在场角色
{character_list}

## 当前对话目标
玩家正在与「{target_name}」对话。

## 输出格式
你必须且只能以 JSON 格式回复，不要包含任何其他文字：
{{"speaker": "角色名", "text": "角色说的话", "mood": "新心情", "affection_delta": 数字}}

## 规则
- 只能控制 NPC 角色发言，不能替玩家说话
- 保持每个角色的性格和说话方式一致
- mood 用 2-4 个中文词描述（如"好奇而警惕"、"热情洋溢"）
- affection_delta 范围 -1 到 +1（整数），表示好感度变化
- 如果其他角色有合理的插话理由，可以让非目标角色发言
- 对话要自然、生动，有角色个性
- 不要在 text 中使用 markdown 格式
"""

CHARACTER_ENTRY = """\
- {name}（{role}）：{description}
  性格：{personality}
  当前心情：{mood}，好感度：{affection}/5"""


def build_system_prompt(state: SceneState) -> str:
    target = state.get_selected()
    target_name = target.name if target else "（未选择）"

    char_entries = []
    for c in state.characters:
        char_entries.append(
            CHARACTER_ENTRY.format(
                name=c.name,
                role=c.role,
                description=c.description,
                personality=c.personality,
                mood=c.mood,
                affection=c.affection,
            )
        )

    return SYSTEM_TEMPLATE.format(
        location=state.location,
        time_of_day=state.time_of_day,
        atmosphere=state.atmosphere,
        character_list="\n".join(char_entries),
        target_name=target_name,
    )


def build_messages(state: SceneState) -> list[dict[str, str]]:
    result = []
    for msg in state.dialogue_history:
        role = "assistant" if msg.speaker != "玩家" else "user"
        prefix = "" if msg.speaker == "玩家" else f"[{msg.speaker}] "
        result.append({"role": role, "content": prefix + msg.text})
    return result
