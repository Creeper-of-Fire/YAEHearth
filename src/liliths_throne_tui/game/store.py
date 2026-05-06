from __future__ import annotations

import threading
from typing import Callable

from .agent import AgentResponse, TavernAgent
from .log_store import logger
from .models import Character, Message, SceneState, default_scene

DialogueCallback = Callable[[Message], None]
CharacterCallback = Callable[[Character], None]
SelectionCallback = Callable[[str | None], None]
BusyCallback = Callable[[bool], None]


class GameStore:
    """Singleton 游戏状态管理器 — 业务逻辑层，不依赖任何 UI 框架。"""

    _instance: GameStore | None = None
    _initialized: bool = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, state: SceneState | None = None, agent: TavernAgent | None = None):
        if GameStore._initialized:
            return
        self.state = state
        self.agent = agent
        self._dialogue_listeners: list[DialogueCallback] = []
        self._character_listeners: list[CharacterCallback] = []
        self._selection_listeners: list[SelectionCallback] = []
        self._busy_listeners: list[BusyCallback] = []
        self._reset_listeners: list[Callable[[], None]] = []
        self._lock = threading.Lock()
        self._generating = False
        GameStore._initialized = True

    # ------------------------------------------------------------------ #
    # 订阅接口
    # ------------------------------------------------------------------ #

    def on_dialogue(self, cb: DialogueCallback) -> None:
        self._dialogue_listeners.append(cb)

    def on_character_update(self, cb: CharacterCallback) -> None:
        self._character_listeners.append(cb)

    def on_selection_change(self, cb: SelectionCallback) -> None:
        self._selection_listeners.append(cb)

    def on_busy(self, cb: BusyCallback) -> None:
        self._busy_listeners.append(cb)

    def on_scene_reset(self, cb: Callable[[], None]) -> None:
        self._reset_listeners.append(cb)

    # ------------------------------------------------------------------ #
    # 内部触发
    # ------------------------------------------------------------------ #

    def _fire_dialogue(self, msg: Message) -> None:
        for cb in self._dialogue_listeners:
            try:
                cb(msg)
            except Exception:
                pass

    def _fire_character_update(self, char: Character) -> None:
        for cb in self._character_listeners:
            try:
                cb(char)
            except Exception:
                pass

    def _fire_selection_change(self, char_id: str | None) -> None:
        for cb in self._selection_listeners:
            try:
                cb(char_id)
            except Exception:
                pass

    def _fire_busy(self, busy: bool) -> None:
        for cb in self._busy_listeners:
            try:
                cb(busy)
            except Exception:
                pass

    def _fire_scene_reset(self) -> None:
        for cb in self._reset_listeners:
            try:
                cb()
            except Exception:
                pass

    # ------------------------------------------------------------------ #
    # 只读操作
    # ------------------------------------------------------------------ #

    def get_characters(self) -> list[Character]:
        return list(self.state.characters)

    def get_selected_character(self) -> Character | None:
        return self.state.get_selected()

    def get_dialogue_history(self) -> list[Message]:
        return list(self.state.dialogue_history)

    def get_scene_description(self) -> str:
        return self.state.atmosphere

    # ------------------------------------------------------------------ #
    # 写操作
    # ------------------------------------------------------------------ #

    def select_character(self, char_id: str) -> None:
        with self._lock:
            char = self.state.get_character(char_id)
            self.state.selected_id = char_id
        if char:
            logger.info(f"对话目标: {char.name}")
        self._fire_selection_change(char_id)

    def send_message(self, text: str) -> None:
        msg = Message(speaker="玩家", text=text)
        with self._lock:
            self.state.dialogue_history.append(msg)
        logger.info(f"玩家: {text[:30]}")
        self._fire_dialogue(msg)
        self._trigger_agent()

    def reset_scene(self) -> None:
        with self._lock:
            self.state = default_scene()
        logger.info("场景已重置")
        self._fire_scene_reset()
        self._fire_selection_change(self.state.selected_id)

    # ------------------------------------------------------------------ #
    # Agent
    # ------------------------------------------------------------------ #

    def _trigger_agent(self) -> None:
        if self._generating:
            return
        self._generating = True
        self._fire_busy(True)

        def _run() -> None:
            try:
                with self._lock:
                    s = self.state
                    snapshot = SceneState(
                        location=s.location,
                        time_of_day=s.time_of_day,
                        atmosphere=s.atmosphere,
                        characters=[c.clone() for c in s.characters],
                        selected_id=s.selected_id,
                        dialogue_history=list(s.dialogue_history),
                    )
                response = self.agent.generate(snapshot)
                self._apply_response(response)
            except Exception:
                logger.error("Agent 调用失败")
            finally:
                self._generating = False
                self._fire_busy(False)

        threading.Thread(target=_run, daemon=True).start()

    def _apply_response(self, resp: AgentResponse) -> None:
        msg = Message(speaker=resp.speaker, text=resp.text)
        with self._lock:
            self.state.dialogue_history.append(msg)
            char = self.state.get_character(resp.speaker) or self._find_character_by_name(resp.speaker)
            if char:
                if resp.mood:
                    char.mood = resp.mood
                char.affection = max(0, min(5, char.affection + resp.affection_delta))

        logger.info(f"{resp.speaker}: {resp.text[:40]}")
        self._fire_dialogue(msg)
        if char:
            self._fire_character_update(char)

    def _find_character_by_name(self, name: str) -> Character | None:
        for c in self.state.characters:
            if c.name == name:
                return c
        return None
