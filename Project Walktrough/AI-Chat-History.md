````md
# Arcturus Conversation Session Architecture

## Overview

Arcturus should use a **conversation session architecture**, similar to modern AI assistants such as ChatGPT, Claude, and Gemini.

Instead of storing all messages in one global chat history, each chat should be treated as a separate conversation session with its own:

- User messages
- Assistant responses
- Reasoning summaries
- Regenerated response branches
- Feedback metadata
- Conversation metadata
- Scoped AI context

This architecture makes the chat system easier to manage, restore, evaluate, and expand in the future.

---

## Core Concept

Each conversation should have a unique identifier:

```text
conversation_id
````

When the user:

* Creates a new chat
* Opens a previous chat
* Switches between conversations

the active `conversation_id` changes.

This allows Arcturus to keep each chat isolated and contextually clean.

---

## Why Conversation Sessions Matter

AI context should be scoped **per conversation**, not shared globally across all chats.

Without isolated sessions, the system may experience:

* Noisy or mixed context
* Excessive token usage
* Conflicting memory between topics
* Messy regenerated response branches
* Lower response quality
* Difficult debugging and feedback analysis

A session-based structure keeps each conversation focused and easier to maintain.

---

## Typical Conversation Architecture

### 1. Conversation List

A sidebar or history panel can show available conversations, for example:

```text
Physics Discussion
Gemma Integration
Orbital Mechanics
Telemetry Review
```

Each item represents one full conversation session, not just a visual label.

---

### 2. Message History Per Conversation

Each conversation should store:

* User messages
* Assistant messages
* Reasoning summaries
* Response branches
* Feedback state
* Message IDs
* Timestamps
* Mode metadata, such as `thinking` or `instant`

---

## Example Session Structure

```json
{
  "conversation_id": "conv_001",
  "title": "Orbital Mechanics",
  "created_at": "2026-05-18T12:00:00Z",
  "updated_at": "2026-05-18T12:30:00Z",
  "messages": [
    {
      "role": "user",
      "content": "Explain ISL"
    },
    {
      "role": "assistant",
      "branches": [
        {
          "message_id": "msg_001",
          "response": "Inter-satellite links are communication links between satellites...",
          "reasoning": "Prepared a concise explanation of ISL concepts.",
          "feedback": "like",
          "mode": "thinking",
          "timestamp": "2026-05-18T12:01:00Z"
        }
      ],
      "active_branch_index": 0
    }
  ]
}
```

---

## New Chat Behavior

When the user clicks:

```text
New Chat
```

the system should create a new empty conversation session.

It should **not** delete previous conversations.

Expected behavior:

```text
New Chat
    ↓
Create new conversation_id
    ↓
Start empty message history
```

---

## Loading Existing Conversations

When the user opens a previous conversation:

Frontend:

```text
Load selected conversation_id
```

Backend:

```text
Retrieve the saved conversation history
```

Then Arcturus should continue using only the context from that selected conversation.

---

## Recommended Storage Structure

For the current Flask-based development stage, a simple JSON file-based storage system is sufficient.

Recommended directory:

```text
database/conversations/
```

Example files:

```text
conv_001.json
conv_002.json
conv_003.json
```

Each file represents one saved conversation session.

---

## Example Stored Conversation

```json
{
  "id": "conv_001",
  "title": "Earth Explanation",
  "created_at": "2026-05-18T12:00:00Z",
  "updated_at": "2026-05-18T12:15:00Z",
  "messages": [
    {
      "role": "user",
      "content": "What is Earth?"
    },
    {
      "role": "assistant",
      "branches": [
        {
          "message_id": "msg_001",
          "response": "Earth is the third planet from the Sun...",
          "reasoning": "Generated a general explanation of Earth.",
          "feedback": null,
          "mode": "instant",
          "timestamp": "2026-05-18T12:01:00Z"
        }
      ],
      "active_branch_index": 0
    }
  ]
}
```

---

## App Reload Behavior

Conversation sessions should persist on disk.

When the user closes and reopens the web app:

* Previous conversations should still be available
* The conversation list should reload from storage
* The last active conversation can be restored automatically
* The user should be able to continue from where they left off

---

## Frontend Responsibilities

The frontend should manage:

* Active `conversation_id`
* Conversation switching
* New chat creation
* Message rendering
* Branch navigation
* Active branch display
* Restoring conversation UI after loading
* Sending the correct conversation context to the backend

---

## Backend Responsibilities

The backend should manage:

* Creating conversation files
* Saving conversation updates
* Loading conversation history
* Listing available conversations
* Updating metadata
* Persisting messages and branches
* Returning conversation data to the frontend

---

## Recommended API Endpoints

Suggested endpoints for future implementation:

```text
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/<conversation_id>
POST   /api/conversations/<conversation_id>/messages
PATCH  /api/conversations/<conversation_id>
DELETE /api/conversations/<conversation_id>
```

### Endpoint Purpose

| Endpoint                                             | Purpose                   |
| ---------------------------------------------------- | ------------------------- |
| `GET /api/conversations`                             | List saved conversations  |
| `POST /api/conversations`                            | Create a new conversation |
| `GET /api/conversations/<conversation_id>`           | Load one conversation     |
| `POST /api/conversations/<conversation_id>/messages` | Save or append messages   |
| `PATCH /api/conversations/<conversation_id>`         | Update title or metadata  |
| `DELETE /api/conversations/<conversation_id>`        | Delete a conversation     |

---

## Professional Architecture Flow

```text
Frontend
    ↓
Active conversation_id
    ↓
Backend Conversation API
    ↓
Session Storage
    ↓
Conversation History
```

---

## Auto Title Generation

Modern AI assistants often generate conversation titles automatically from the first user prompt.

Examples:

```text
Physics Discussion
Gemma Integration
Satellite Telemetry
Earth Explanation
Orbital Mechanics
```

This can be implemented later as a lightweight enhancement.

Suggested behavior:

```text
First user prompt
    ↓
Generate short title
    ↓
Save title to conversation metadata
```

---

## Current Arcturus Foundation

Arcturus already has several important foundations for conversation sessions.

Already implemented:

* Response branching
* Reasoning UI
* Feedback logging
* Message IDs
* Mode state
* Markdown rendering
* KaTeX equation rendering
* Send / Stop lifecycle
* Prompt composer behavior

Not yet implemented:

* Persistent conversation sessions
* Sidebar conversation history
* Restore after reload
* Session storage
* Conversation switching
* Auto-title generation

---

## Suggested Development Phases

### Phase 1 — Chatbot UI Foundation

Completed or mostly completed:

* Floating chatbot UI
* Docking system
* Reasoning UI
* Prompt composer
* Send / Stop interaction
* Message rendering

---

### Phase 2 — Response Intelligence

Completed or mostly completed:

* Regenerated response branches
* Feedback logging
* Markdown rendering
* KaTeX equation rendering
* Per-branch feedback behavior

---

### Phase 3 — Conversation Sessions

Planned:

* Persistent conversation storage
* Conversation list / sidebar history
* New chat behavior
* Restore after reload
* Conversation switching
* Branch persistence

---

### Phase 4 — Advanced Memory and Retrieval

Future expansion:

* Semantic memory
* Vector search
* Retrieval-Augmented Generation
* Long-term memory
* Contextual retrieval
* User/project-aware AI context

---

## Implementation Notes

For the first implementation, keep the system simple and development-friendly.

Recommended first version:

* Store conversations as JSON files
* Use one file per conversation
* Save messages, branches, feedback, and metadata
* Restore messages when conversation is reopened
* Avoid complex database setup until the architecture is stable

A later version can migrate to:

* SQLite
* PostgreSQL
* Vector database
* Hybrid session + semantic memory storage

---

## Summary

A ChatGPT-like history system is fundamentally built around:

```text
Multiple isolated conversation sessions
```

Each session should include:

* Unique `conversation_id`
* Stored message history
* Regenerated response branches
* Feedback metadata
* Reload persistence
* Sidebar navigation
* Scoped AI context

Arcturus already has much of the foundation needed to move toward this architecture. The next major step is implementing persistent conversation sessions and conversation switching.

```
```
