import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from google.genai import types


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_name(value: str) -> str:
    base = os.path.basename(str(value or "")).strip().lower()
    base = re.sub(r"\.(yaml|yml|json)$", "", base)
    base = re.sub(r"[^a-z0-9._-]+", "_", base)
    return base or "default"


class MultiChatMemoryManager:
    """Project-scoped nested chat memory stored as JSON.

    Layout:
    {
      "_meta": {
        "chat_session_1": {"title": "...", "created_at": "...", "updated_at": "..."}
      },
      "chat_session_1": [
        {"role": "user", "parts": [{"text": "..."}]},
        {"role": "model", "parts": [{"text": "..."}]}
      ]
    }
    """

    def __init__(self, storage_dir: str):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _storage_path(self, project_id: str) -> Path:
        return self.storage_dir / f"{_safe_name(project_id)}.json"

    def _load_project_vault(self, project_id: str) -> dict:
        path = self._storage_path(project_id)
        if not path.exists():
            return {"_meta": {}}

        try:
            with path.open("r", encoding="utf-8") as file_handle:
                payload = json.load(file_handle)
            if not isinstance(payload, dict):
                return {"_meta": {}}
            payload.setdefault("_meta", {})
            return payload
        except Exception:
            return {"_meta": {}}

    def _save_project_vault(self, project_id: str, vault: dict):
        path = self._storage_path(project_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as file_handle:
            json.dump(vault, file_handle, indent=2, ensure_ascii=False)

    @staticmethod
    def _extract_text(message: dict) -> str:
        parts = message.get("parts") or []
        if not parts:
            return ""
        first_part = parts[0] if isinstance(parts, list) else None
        if isinstance(first_part, dict):
            return str(first_part.get("text") or "")
        return ""

    def _derive_title(self, messages: list) -> str:
        for message in messages:
            if message.get("role") != "user":
                continue
            text = self._extract_text(message).strip()
            if text:
                return text[:42] + ("..." if len(text) > 42 else "")
        return "Untitled Chat"

    def _touch_meta(self, vault: dict, chat_id: str, messages: list, title: str | None = None):
        meta = vault.setdefault("_meta", {})
        created_at = meta.get(chat_id, {}).get("created_at") or _utc_now_iso()
        meta[chat_id] = {
            "title": title or self._derive_title(messages),
            "created_at": created_at,
            "updated_at": _utc_now_iso(),
        }

    def create_session(self, project_id: str, chat_id: str | None = None, title: str | None = None) -> str:
        vault = self._load_project_vault(project_id)
        chat_id = chat_id or f"chat_session_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        vault.setdefault(chat_id, [])
        self._touch_meta(vault, chat_id, vault[chat_id], title=title)
        self._save_project_vault(project_id, vault)
        return chat_id

    def list_sessions(self, project_id: str) -> list:
        vault = self._load_project_vault(project_id)
        meta = vault.get("_meta", {})
        sessions = []

        for chat_id, messages in vault.items():
            if chat_id == "_meta":
                continue
            if not isinstance(messages, list):
                continue
            info = meta.get(chat_id, {}) if isinstance(meta, dict) else {}
            sessions.append({
                "chat_id": chat_id,
                "title": info.get("title") or self._derive_title(messages),
                "message_count": len(messages),
                "created_at": info.get("created_at"),
                "updated_at": info.get("updated_at"),
            })

        sessions.sort(key=lambda item: item.get("updated_at") or "", reverse=True)
        return sessions

    def get_chat_history(self, project_id: str, chat_id: str) -> list:
        vault = self._load_project_vault(project_id)
        history = vault.get(chat_id, [])
        return history if isinstance(history, list) else []

    def get_history_contents(self, project_id: str, chat_id: str) -> list:
        return [types.Content.model_validate(message) for message in self.get_chat_history(project_id, chat_id)]

    def append_turn(self, project_id: str, chat_id: str, user_text: str, assistant_text: str, title: str | None = None):
        vault = self._load_project_vault(project_id)
        vault.setdefault(chat_id, [])

        user_message = {
            "role": "user",
            "parts": [{"text": user_text}],
            "created_at": _utc_now_iso(),
        }
        assistant_message = {
            "role": "model",
            "parts": [{"text": assistant_text}],
            "created_at": _utc_now_iso(),
        }

        vault[chat_id].extend([user_message, assistant_message])
        self._touch_meta(vault, chat_id, vault[chat_id], title=title)
        self._save_project_vault(project_id, vault)

    def delete_session(self, project_id: str, chat_id: str | None = None):
        path = self._storage_path(project_id)
        if chat_id is None:
            if path.exists():
                path.unlink()
            return

        vault = self._load_project_vault(project_id)
        vault.pop(chat_id, None)
        meta = vault.get("_meta", {})
        if isinstance(meta, dict):
            meta.pop(chat_id, None)
        if not any(key != "_meta" for key in vault.keys()):
            if path.exists():
                path.unlink()
            return
        self._save_project_vault(project_id, vault)

    def build_history_context(self, project_id: str, chat_id: str, max_messages: int = 12) -> str:
        history = self.get_chat_history(project_id, chat_id)[-max_messages:]
        if not history:
            return ""

        lines = ["[CHAT HISTORY]"]
        for message in history:
            text = self._extract_text(message).strip()
            if not text:
                continue
            role = message.get("role", "user")
            label = "User" if role == "user" else "Assistant"
            lines.append(f"{label}: {text}")
        return "\n".join(lines)


CHAT_MEMORY_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "database", "chat_history"))
chat_memory = MultiChatMemoryManager(CHAT_MEMORY_DIR)