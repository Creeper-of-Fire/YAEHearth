from __future__ import annotations

import logging

from textual.app import App, ComposeResult
from textual.containers import Horizontal
from textual.widgets import Footer, Input

from .game.agent import TavernAgent
from .game.log_store import logger
from .game.models import Message, default_scene
from .game.store import GameStore
from .widgets.character_detail import CharacterDetail
from .widgets.character_list import CharacterList
from .widgets.scene_panel import ScenePanel


class _LogStoreHandler(logging.Handler):
    """将 Python logging 转发到 LogStore。"""

    def emit(self, record: logging.LogRecord) -> None:
        logger.write(f"[pylog] {record.levelName} {record.name}: {record.getMessage()}")


class TavernApp(App):
    """暮色酒馆 — TUI 对话原型"""

    CSS_PATH = "styles/layout.tss"

    TITLE = "暮色酒馆"

    BINDINGS = [
        ("ctrl+t", "next_character", "切换对话目标"),
        ("ctrl+r", "reset_scene", "重置场景"),
    ]

    def compose(self) -> ComposeResult:
        with Horizontal(id="main-grid"):
            yield CharacterList()
            yield ScenePanel()
            yield CharacterDetail()
        yield Footer()

    def on_mount(self) -> None:
        self.dark = True
        scene = self.query_one(ScenePanel)
        desc = GameStore().get_scene_description()
        scene.set_scene_description(desc)
        scene.append_message(Message(speaker="", text=f"你推开了酒馆沉重的大门。{desc}"))
        logger.info("场景已加载")

    # --- 键盘动作 ---

    def action_next_character(self) -> None:
        store = GameStore()
        chars = store.get_characters()
        if not chars:
            return
        ids = [c.id for c in chars]
        current = store.state.selected_id
        idx = (ids.index(current) + 1) % len(ids) if current in ids else 0
        store.select_character(ids[idx])

    def action_reset_scene(self) -> None:
        GameStore().reset_scene()

    # --- 输入事件 ---

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id != "msg-input":
            return
        text = event.value.strip()
        if not text:
            return
        event.input.value = ""
        GameStore().send_message(text)


def main():
    logging.basicConfig(
        level=logging.INFO,
        handlers=[_LogStoreHandler()],
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    # 游戏单例必须在线程循环启动前初始化，否则 widget 的 on_mount
    # 在 App.on_mount 之前触发，拿到的将是未初始化的实例。
    GameStore(default_scene(), TavernAgent())
    app = TavernApp()

    app.run()


if __name__ == "__main__":
    main()
