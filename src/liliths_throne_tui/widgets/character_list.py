from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import OptionList, RichLog
from textual.widgets.option_list import Option

from ..game.log_store import logger
from ..game.models import Character
from ..game.store import GameStore


class CharacterList(Vertical):
    """Left sidebar: character list (top) + event log (bottom)."""

    def compose(self) -> ComposeResult:
        yield OptionList(id="char-options")
        yield RichLog(
            id="event-log",
            highlight=True,
            markup=True,
            wrap=True,
            auto_scroll=True,
        )

    def on_mount(self) -> None:
        store = GameStore()
        store.on_selection_change(self._on_selection_change)

        # 初始角色列表
        chars = store.get_characters()
        self._rebuild_options(chars, self._selected_id(chars, store.state.selected_id))

        # 事件日志
        log = self.query_one("#event-log", RichLog)
        for line in logger.all:
            log.write(line)
        logger.subscribe(self._on_log)

    def on_unmount(self) -> None:
        logger.unsubscribe(self._on_log)

    @staticmethod
    def _selected_id(chars: list[Character], store_id: str | None) -> str | None:
        """取 chars 中存在的 selected_id，防删除后残留。"""
        if store_id and any(c.id == store_id for c in chars):
            return store_id
        return chars[0].id if chars else None

    def _on_log(self, line: str) -> None:
        self.query_one("#event-log", RichLog).write(line)

    def _on_selection_change(self, char_id: str | None) -> None:
        self.call_from_thread(self._refresh_list)

    def _refresh_list(self) -> None:
        store = GameStore()
        self._rebuild_options(store.get_characters(), store.state.selected_id)

    def _rebuild_options(
        self, characters: list[Character], selected_id: str | None
    ) -> None:
        ol = self.query_one("#char-options", OptionList)
        ol.clear_options()
        for char in characters:
            marker = " ★" if char.id == selected_id else ""
            label = f"{char.name} ({char.role}){marker}"
            ol.add_option(Option(label, id=char.id))

    def on_option_list_option_selected(
        self, event: OptionList.OptionSelected
    ) -> None:
        event.stop()
        if event.option_id:
            GameStore().select_character(event.option_id)
