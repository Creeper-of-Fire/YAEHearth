"""全局日志存储（单例）— 任何模块都可以写入，UI 通过订阅接收，统一写文件。"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Callable

_LOG_FILE = Path(__file__).resolve().parents[3] / "tavern.log"


class LogStore:
    _instance: LogStore | None = None

    def __new__(cls) -> LogStore:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init()
        return cls._instance

    def _init(self) -> None:
        self._logs: list[str] = []
        self._listeners: list[Callable[[str], None]] = []
        self._file = open(_LOG_FILE, "a", encoding="utf-8")

    def write(self, message: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        line = f"[{timestamp}] {message}"
        self._logs.append(line)
        for listener in self._listeners:
            try:
                listener(line)
            except Exception:
                pass
        self._file.write(line + "\n")
        self._file.flush()

    def info(self, message: str) -> None:
        self.write(message)

    def warn(self, message: str) -> None:
        self.write(f"[warn] {message}")

    def error(self, message: str) -> None:
        self.write(f"[error] {message}")

    @property
    def all(self) -> list[str]:
        return list(self._logs)

    def subscribe(self, callback: Callable[[str], None]) -> None:
        self._listeners.append(callback)

    def unsubscribe(self, callback: Callable[[str], None]) -> None:
        if callback in self._listeners:
            self._listeners.remove(callback)

    def clear(self) -> None:
        self._logs.clear()


logger = LogStore()
