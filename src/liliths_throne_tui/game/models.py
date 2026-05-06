from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class Character:
    id: str
    name: str
    role: str
    description: str
    personality: str
    mood: str = "平静"
    affection: int = 0

    def clone(self) -> Character:
        return Character(
            id=self.id,
            name=self.name,
            role=self.role,
            description=self.description,
            personality=self.personality,
            mood=self.mood,
            affection=self.affection,
        )


@dataclass
class Message:
    speaker: str
    text: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class SceneState:
    location: str = "暮色酒馆"
    time_of_day: str = "夜晚"
    atmosphere: str = "温暖昏暗，壁炉噼啪作响，空气中弥漫着麦酒和烤肉的香气"
    characters: list[Character] = field(default_factory=list)
    selected_id: str | None = None
    dialogue_history: list[Message] = field(default_factory=list)

    def get_character(self, char_id: str) -> Character | None:
        for c in self.characters:
            if c.id == char_id:
                return c
        return None

    def get_selected(self) -> Character | None:
        if self.selected_id is None:
            return None
        return self.get_character(self.selected_id)


def default_scene() -> SceneState:
    return SceneState(
        characters=[
            Character(
                id="grum",
                name="格鲁姆",
                role="酒保",
                description="一个壮实的矮人，胡须编成辫子，擦着杯子。",
                personality="豪爽直率，喜欢讲冷笑话，对老顾客格外关照。说话带着矮人特有的粗犷。",
            ),
            Character(
                id="lila",
                name="莉拉",
                role="旅者",
                description="一位年轻的人类女性，披着深绿斗篷，坐在角落的桌旁。",
                personality="好奇心旺盛，健谈但有所保留。似乎在寻找什么人，偶尔流露出一丝忧虑。",
            ),
            Character(
                id="thomas",
                name="老托马斯",
                role="吟游诗人",
                description="一个白发苍苍的老半精灵，怀抱一把旧鲁特琴。",
                personality="博学多闻，喜欢用谜语和寓言代替直接回答。对镇上的传闻了如指掌。",
            ),
        ],
        selected_id="lila",
    )
