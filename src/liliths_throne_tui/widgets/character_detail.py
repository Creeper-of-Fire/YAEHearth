from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical, VerticalScroll
from textual.widgets import Static

from ..game.models import Character
from ..game.store import GameStore


class CharacterDetail(Vertical):
    """Right sidebar: selected character details."""

    def compose(self) -> ComposeResult:
        with VerticalScroll(id="detail-scroll"):
            yield Static("[italic]选择一个角色查看详情[/]", id="no-selection")

    def on_mount(self) -> None:
        store = GameStore()
        store.on_selection_change(self._on_selection_change)
        store.on_character_update(self._on_character_update)
        store.on_scene_reset(self._on_scene_reset)
        # 初始状态
        char = store.get_selected_character()
        if char:
            self.update_character(char)

    def _on_selection_change(self, char_id: str | None) -> None:
        self.call_from_thread(self._refresh_for_selection)

    def _on_character_update(self, char: Character) -> None:
        self.call_from_thread(self.update_character, char)

    def _on_scene_reset(self) -> None:
        self.call_from_thread(self._refresh_for_selection)

    def _refresh_for_selection(self) -> None:
        store = GameStore()
        self.update_character(store.get_selected_character())

    # --- 渲染 ---

    def update_character(self, char: Character | None) -> None:
        scroll = self.query_one("#detail-scroll", VerticalScroll)
        scroll.remove_children()

        if char is None:
            scroll.mount(Static("[italic]选择一个角色查看详情[/]", id="no-selection"))
            return

        hearts_full = "❤" * char.affection
        hearts_empty = "♡" * (5 - char.affection)
        hearts_display = (
            f"[#cc4444]{hearts_full}[/][#444444]{hearts_empty}[/]"
            if hearts_full or hearts_empty
            else "[#444444]♡♡♡♡♡[/]"
        )

        scroll.mount(
            Static(f"[bold]{char.name}[/bold]", classes="detail-value"),
            Static(f"{char.role}", classes="detail-value"),
            Static(""),
            Static(char.description, classes="detail-value"),
            Static(""),
            Static("好感度", classes="detail-label"),
            Static(hearts_display, classes="detail-value"),
            Static(""),
            Static("心情", classes="detail-label"),
            Static(f"[#aaaaaa]{char.mood}[/]", classes="detail-value"),
        )
