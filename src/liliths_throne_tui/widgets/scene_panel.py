from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Input, RichLog, Static

from ..game.models import Message
from ..game.store import GameStore


class ScenePanel(Vertical):
    """Center panel: scene description + dialogue log + input."""

    def compose(self) -> ComposeResult:
        yield Static(id="scene-desc")
        yield RichLog(
            id="dialogue-log",
            highlight=True,
            markup=True,
            wrap=True,
            auto_scroll=True,
        )
        with Vertical(id="input-bar"):
            yield Input(placeholder="说点什么…", id="msg-input")

    def on_mount(self) -> None:
        store = GameStore()
        store.on_dialogue(self._on_dialogue)
        store.on_busy(self._on_busy)
        store.on_scene_reset(self.clear_dialogue)

    def set_scene_description(self, text: str) -> None:
        self.query_one("#scene-desc", Static).update(f"[italic]{text}[/]")

    def append_message(self, msg: Message) -> None:
        """公共方法：追加一条消息到对话日志。"""
        log_widget = self.query_one("#dialogue-log", RichLog)
        if not msg.speaker:
            log_widget.write(f"[italic #999999]{msg.text}[/]")
        elif msg.speaker == "玩家":
            log_widget.write(f"[bold cyan]你:[/] {msg.text}")
        else:
            log_widget.write(f"[bold yellow]{msg.speaker}:[/] {msg.text}")

    # --- 事件回调（可能来自后台线程） ---

    def _on_dialogue(self, msg: Message) -> None:
        self.call_from_thread(self.append_message, msg)

    def _on_busy(self, busy: bool) -> None:
        self.call_from_thread(self._set_input_busy, busy)

    def _set_input_busy(self, busy: bool) -> None:
        input_widget = self.query_one("#msg-input", Input)
        input_widget.disabled = busy
        if not busy:
            input_widget.focus()

    def clear_dialogue(self) -> None:
        self.query_one("#dialogue-log", RichLog).clear()
