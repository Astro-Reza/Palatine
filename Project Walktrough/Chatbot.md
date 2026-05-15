# Chatbot.md

# Palatine AI Chatbot System Specification

## Overview

The Palatine AI Chatbot is a modern desktop-style AI assistant integrated directly into the Palatine workspace.

The chatbot should feel like:
- a native workspace tool
- an intelligent assistant layer
- a persistent desktop panel
- a non-intrusive AI operating system component

The system is inspired by:
- VSCode side panels
- Discord dock systems
- Figma draggable windows
- Notion desktop UI
- Copilot desktop interactions

The chatbot must support:
- floating mode
- docked layout mode
- minimized launcher mode
- persistent state
- intelligent AI notifications
- future multi-agent systems

---

# Core UX Philosophy

## Main Goals

The chatbot should:
- avoid interrupting workflow
- feel lightweight
- support smooth transitions
- support responsive interactions
- preserve user focus
- preserve conversation state
- integrate naturally into the Palatine workspace

---

# Chatbot States

| State | Description |
|---|---|
| Floating | Freely draggable overlay |
| Docked Left | Attached to left workspace panel |
| Docked Right | Attached to right workspace panel |
| Minimized | Compact launcher mode |
| Closed | Hidden panel with launcher icon |

---

# Floating Mode

## Behavior

When floating:
- use `position: absolute`
- allow free dragging around screen
- maintain high z-index
- preserve smooth movement

## Initial Position

```css
left: 304px;
top: 399px;
```

---

# Floating Requirements

Preferred movement implementation:

```css
transform: translate3d(...)
```

Behavior goals:
- GPU-friendly movement
- smooth dragging
- no layout shifting
- no forced repaint loops

---

# Advanced Snap & Docking Behavior

## Docking Philosophy

The chatbot should behave similarly to:
- VSCode side panels
- Discord dock systems
- Figma draggable panels

The chatbot must support:
- floating mode
- docked layout mode

---

# Snap Detection System

## Snap Threshold

Recommended threshold:

```txt
48px
```

---

# Snap Conditions

## Left Snap

If chatbot distance from left edge <= 48px:
- activate left docking mode

## Right Snap

If chatbot distance from right edge <= 48px:
- activate right docking mode

---

# Docked Layout Mode

## Important Behavior

When attached to a side panel:
- DO NOT continue using absolute positioning
- switch to normal layout flow

Example:

```css
position: relative;
width: 100%;
```

The chatbot becomes part of the side panel layout system.

---

# Layout Insertion Behavior

## Goal

When the chatbot docks into a panel containing:
- boxes
- cards
- labels
- sections
- panel items

the chatbot must automatically appear BELOW existing items.

The chatbot must NEVER overlap layout content.

---

# Example

Initial layout:

```txt
Explorer
Assets
Properties
```

After docking:

```txt
Explorer
Assets
Properties
Palatine AI Chatbot
```

---

# Dynamic Insertion Logic

The docking system should support:
- automatic insertion
- responsive vertical stacking
- natural panel flow
- layout-aware docking

Preferred implementation:
- `appendChild()`
- `insertBefore()`
- flex column layout

Recommended CSS:

```css
display: flex;
flex-direction: column;
gap: 12px;
```

---

# Drag & Drop UX

## Desired UX

While dragging near docking areas:
- preview snap behavior
- highlight docking zones
- animate transitions smoothly
- optionally show glow/outline effect

---

# Dock Preview Effect

Optional effect:

```css
box-shadow:
0 0 0 1px rgba(255,255,255,0.08),
0 0 24px rgba(90,140,255,0.35);
```

---

# Floating Layer Architecture

## Recommended Structure

```html
<div class="left-panel"></div>

<div id="floating-layer"></div>

<div class="right-panel"></div>
```

---

# Floating Behavior

Move chatbot into:

```js
floatingLayer.appendChild(chatbot)
```

---

# Dock Left

Move chatbot into:

```js
leftPanel.appendChild(chatbot)
```

---

# Dock Right

Move chatbot into:

```js
rightPanel.appendChild(chatbot)
```

---

# Minimize Behavior

When minimized:
- chatbot snaps toward bottom area
- preserve full chat history
- preserve session state
- preserve scroll position
- allow instant reopening

The minimized behavior should feel similar to:
- Discord activity launcher
- Messenger floating launcher
- Copilot desktop icon

---

# Close Behavior

When closed:
- hide full chatbot panel
- replace with compact AI launcher icon
- preserve state/history
- launcher restores chatbot instantly

Closing the chatbot must NEVER destroy session state.

---

# Official Palatine Chatbot Logo

## Logo Asset

Use the official Palatine SVG logo.

Recommended path:

```txt
/static/icons/palatine-chatbot-logo.svg
```

Alternative supported formats:
- PNG
- SVG
- WEBP

---

# SVG Requirements

The logo must:
- remain vector-based
- preserve transparency
- support CSS animations
- support scaling
- support GPU transforms

Preferred usage:
- inline SVG
- or `<img src="...svg">`

---

# Recommended Launcher HTML

```html
<button
  id="chatbot-launcher"
  class="chatbot-launcher">

  <img
    id="chatbot-logo"
    class="chatbot-logo"
    src="/static/icons/palatine-chatbot-logo.svg"
    alt="Palatine AI Chatbot"
  />

  <span
    id="chatbot-status-bubble"
    class="chatbot-status-bubble">
  </span>

</button>
```

---

# Launcher Purpose

The launcher acts as:
- reopen button
- notification center
- AI status indicator
- minimized access point

---

# Launcher Container CSS

```css
.chatbot-launcher {

  position: fixed;

  right: 24px;
  bottom: 24px;

  width: 56px;
  height: 56px;

  border: none;
  border-radius: 50%;

  background: #111827;

  display: flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;

  z-index: 9999;

  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
```

---

# Launcher Hover Effect

```css
.chatbot-launcher:hover {

  transform: scale(1.05);

  box-shadow:
    0 0 0 1px rgba(255,255,255,0.06),
    0 8px 32px rgba(0,0,0,0.35);
}
```

---

# Logo CSS

```css
.chatbot-logo {

  width: 34px;
  height: 34px;

  object-fit: contain;
}
```

---

# Status Bubble CSS

```css
.chatbot-status-bubble {

  position: absolute;

  top: 4px;
  right: 4px;

  width: 11px;
  height: 11px;

  border-radius: 50%;

  display: none;

  border: 2px solid #111827;
}

.status-orange {
  display: block;
  background: orange;
}

.status-green {
  display: block;
  background: #22c55e;
}

.status-red {
  display: block;
  background: #ef4444;
}
```

---

# Chatbot Status System

## Supported States

| State | Description |
|---|---|
| idle | waiting |
| thinking | processing prompt |
| reasoning | planning/executing |
| success | completed |
| failed | processing failed |

---

# Status Bubble Colors

| Status | Color |
|---|---|
| Thinking / Reasoning | Orange |
| Success | Green |
| Failed | Red |

---

# Important Notification Philosophy

The chatbot MUST NEVER auto-open itself after AI completion.

The user always decides whether to reopen the chatbot.

This behavior is critical for:
- workflow continuity
- non-intrusive UX
- professional desktop behavior

---

# Launcher Animation Target

The uploaded SVG logo is the primary animated element.

Animations should apply directly to:

```css
.chatbot-logo
```

---

# Success Notification Animation

When:
- chatbot minimized or closed
- AI finishes successfully

Apply:
```css
.bounce2
```

to:
```css
.chatbot-logo
```

---

# Failed Notification Animation

When:
- AI request fails
- reasoning crashes
- processing errors occur

Apply:
- red status bubble
- optional `.bounce2`

The chatbot must remain closed.

---

# Thinking Animation

When:
- AI thinking
- AI reasoning
- AI processing

Apply:
```css
.pulse-thinking
```

to:
```css
.chatbot-logo
```

---

# Bounce Notification Animation

```css
.bounce2 {
  animation: bounce2 2s ease infinite;
}

@keyframes bounce2 {

  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }

  40% {
    transform: translateY(-30px);
  }

  60% {
    transform: translateY(-15px);
  }

}
```

---

# Bounce Animation Rules

Apply `.bounce2` when:
- chatbot minimized or closed
- AI process completed
- user has not reopened chatbot

Remove `.bounce2` when:
- user opens chatbot
- user clears notification state

---

# Thinking Pulse Animation

```css
.pulse-thinking {
  animation: pulse-thinking 1.4s ease-in-out infinite;
}

@keyframes pulse-thinking {

  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.08);
    opacity: 0.85;
  }

}
```

---

# Open Window Processing Behavior

If the chatbot window is open and the user sends a prompt:
- show loading line
- show status text
- animate processing state

Examples:
- `Thinking...`
- `Reasoning...`
- `Processing...`

---

# Open Window Animation

```css
.bounce-in {
  animation: bounce-in 2s ease infinite;
}

@keyframes bounce-in {

  0% {
    opacity: 0;
    transform: scale(.3);
  }

  50% {
    opacity: 1;
    transform: scale(1.05);
  }

  70% {
    transform: scale(.9);
  }

  100% {
    transform: scale(1);
  }

}
```

---

# Loading Animation Rules

Apply `.bounce-in` when:
- chatbot window open
- AI actively processing

Remove `.bounce-in` when:
- process finishes
- response rendered
- process fails

---

# Example Status Logic

```js
function updateChatbotStatus(status, isOpen) {

  const logo = document.getElementById("chatbot-logo");
  const bubble = document.getElementById("chatbot-status-bubble");

  logo.classList.remove(
    "bounce2",
    "pulse-thinking"
  );

  bubble.classList.remove(
    "status-orange",
    "status-green",
    "status-red"
  );

  if (isOpen) {
    return;
  }

  if (
    status === "thinking" ||
    status === "reasoning"
  ) {
    bubble.classList.add("status-orange");
    logo.classList.add("pulse-thinking");
  }

  if (status === "success") {
    bubble.classList.add("status-green");
    logo.classList.add("bounce2");
  }

  if (status === "failed") {
    bubble.classList.add("status-red");
    logo.classList.add("bounce2");
  }

}
```

---

# Status Logic Summary

## Chatbot Minimized / Closed

### AI Thinking
- orange bubble
- pulse animation
- keep chatbot closed

### AI Success
- green bubble
- `.bounce2`
- keep chatbot closed

### AI Failed
- red bubble
- `.bounce2`
- keep chatbot closed

---

# Chatbot Open

## AI Thinking
- loading line
- `.bounce-in`

## AI Success
- render response
- stop loading animation

## AI Failed
- render failure message
- stop loading animation

---

# Important UX Rules

- NEVER auto-open chatbot
- ALWAYS preserve history
- ALWAYS preserve session state
- Animations must remain subtle
- Notifications must not interrupt workflow
- Docking should feel natural
- Launcher should remain lightweight

---

# Performance Recommendations

Preferred:
- CSS transforms
- requestAnimationFrame
- passive event listeners
- GPU-friendly animations

Avoid:
- layout thrashing
- expensive repaint loops
- constant DOM rebuilding

---

# Future Compatibility

The architecture should support:
- local AI models
- remote AI providers
- streaming responses
- multi-agent systems
- reasoning traces
- workspace-aware context
- voice systems

---

# Recommended File Structure

```txt
/chatbot
  chatbot.js
  chatbot-ui.js
  chatbot-docking.js
  chatbot-status.js
  chatbot-state.js
  chatbot-layout.css
  chatbot-animations.css
```

---

# Final UX Goal

The Palatine AI chatbot should feel like:
- a professional desktop AI assistant
- a native workspace component
- a persistent intelligent panel
- a lightweight AI operating layer

The final experience should combine:
- modern desktop UX
- intelligent notifications
- smooth docking behavior
- responsive AI interactions
- future-ready architecture