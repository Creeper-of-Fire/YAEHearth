from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

from .log_store import logger
from .models import SceneState
from .prompts import build_messages, build_system_prompt


def _init_litellm() -> None:
    import logging
    import litellm

    litellm.suppress_debug_info = True
    litellm.set_verbose = False
    for name in ("litellm", "httpx", "httpcore", "openai"):
        logging.getLogger(name).setLevel(logging.WARNING)


@dataclass
class AgentResponse:
    speaker: str
    text: str
    mood: str | None = None
    affection_delta: int = 0

    @staticmethod
    def from_dict(data: dict) -> AgentResponse:
        return AgentResponse(
            speaker=data.get("speaker", "???"),
            text=data.get("text", "……"),
            mood=data.get("mood"),
            affection_delta=int(data.get("affection_delta", 0)),
        )


class TavernAgent:
    """AI 对话生成器 — 使用 litellm 统一调用，不依赖任何 UI 框架。"""

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
    ) -> None:
        load_dotenv(Path(__file__).resolve().parents[3] / ".env")
        self.model = model or os.getenv("LITELLM_MODEL", "deepseek/deepseek-chat")
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY", "")
        self.api_base = api_base or os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")
        logger.info(f"Agent 初始化: model={self.model}")

    def generate(self, state: SceneState) -> AgentResponse:
        import litellm

        _init_litellm()
        system_prompt = build_system_prompt(state)
        messages = [{"role": "system", "content": system_prompt}] + build_messages(
            state
        )

        try:
            logger.info(f"请求 LLM: model={self.model}")
            resp = litellm.completion(
                model=self.model,
                messages=messages,
                temperature=0.8,
                max_tokens=512,
                api_base=self.api_base,
            )
            raw = resp.choices[0].message.content.strip()
            logger.info(f"LLM 原始响应: {raw[:80]}")
            return self._parse_response(raw)
        except Exception as e:
            logger.error(f"Agent 调用失败: {e}")
            return AgentResponse(speaker="???", text="（沉默）")

    def _parse_response(self, raw: str) -> AgentResponse:
        cleaned = _strip_think_tags(raw)

        try:
            return AgentResponse.from_dict(json.loads(cleaned))
        except json.JSONDecodeError:
            pass

        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return AgentResponse.from_dict(json.loads(cleaned[start:end]))
            except json.JSONDecodeError:
                pass

        logger.warn(f"JSON 解析失败: {raw[:60]}")
        return AgentResponse(speaker="???", text=cleaned[:200])


def _strip_think_tags(text: str) -> str:
    text = re.sub(r"<think[^>]*>.*?</think\s*>", "", text, flags=re.DOTALL)
    text = re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL)
    return text.strip()
