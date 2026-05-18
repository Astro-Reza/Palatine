# AI-InputGroup-Reference.md

# Arcturus Prompt Input Reference

This file contains the reference UX/layout for the modern AI prompt input area used as inspiration for the Arcturus chatbot input system.

The reference is based on a React InputGroup implementation similar to:

* ChatGPT
* Gemini
* Claude
* AI SDK Elements

---

# IMPORTANT

This file is a:

* UX reference
* layout reference
* interaction reference
* spacing reference

Do NOT directly copy:

* React code
* shadcn/ui
* Radix UI
* lucide-react
* TypeScript implementation

Do NOT convert the project into React.

Instead, recreate the same experience using:

* Flask templates
* HTML
* CSS
* Vanilla JavaScript

---

# Target UX

The prompt area should feel:

* modern
* AI-native
* flexible
* minimal
* desktop-quality

---

# Reference React Code

import { ArrowUpIcon, PlusIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"

const Example = () => (
  <div className="flex w-full max-w-2xl flex-col gap-4">
    <InputGroup className="bg-background">
      <InputGroupTextarea placeholder="Ask, Search or Chat..." />
      <InputGroupAddon align="block-end">
        <InputGroupButton className="rounded-full" size="icon-xs" variant="outline">
          <PlusIcon />
        </InputGroupButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <InputGroupButton variant="ghost">Auto</InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="[--radius:0.95rem]" side="top">
            <DropdownMenuItem>Auto</DropdownMenuItem>
            <DropdownMenuItem>Agent</DropdownMenuItem>
            <DropdownMenuItem>Manual</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <InputGroupText className="ml-auto">52% used</InputGroupText>
        <Separator className="!h-4" orientation="vertical" />
        <InputGroupButton className="rounded-full" disabled size="icon-xs" variant="default">
          <ArrowUpIcon />
          <span className="sr-only">Send</span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>

    <small className="text-center text-muted-foreground">
      For better AI components, check out{" "}
      <a className="underline" href="https://ai-sdk.dev/elements/overview">
        AI Elements
      </a>
    </small>
  </div>
)

export default Example

# Important Behaviors

## Layout

* One unified prompt container
* Textarea inside the container
* Bottom addon/action row
* Send button inside the container
* Mode switch button inside the container

## Textarea

* Enter sends
* Shift + Enter inserts newline
* Auto-grow up to max height
* Internal scrolling after max height

## Send Button

Idle:
[ Send ]

Processing:
[ ■ ]

Processing should:

* animate outline
* use rgba(91, 227, 205)
* stop generation on click

## Styling Direction

* outline-based container
* rounded corners
* soft dark UI
* minimal visual weight
* modern AI assistant appearance

## Preserve Existing Features

* reasoning UI
* docking
* resize
* launcher states
* markdown rendering
* assistant actions
* Arcturus animations
