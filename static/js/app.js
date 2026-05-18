document.addEventListener('DOMContentLoaded', () => {
    /* -----------------------------------------
       Left Panel (Satellite Settings) Logic
       ----------------------------------------- */
    const resizerLeft = document.getElementById('dragHandleLeft');
    const panelLeft = document.getElementById('sidePanelLeft');
    const toggleWindowBtn = document.getElementById('toggleWindowBtn');


    if (toggleWindowBtn && panelLeft) {
        toggleWindowBtn.addEventListener('click', () => {
            panelLeft.classList.toggle('transparent-mode');
        });
    }

    let isResizingLeft = false;
    if (resizerLeft && panelLeft) {
        resizerLeft.addEventListener('mousedown', (e) => {
            isResizingLeft = true;
            resizerLeft.classList.add('active');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (isResizingLeft && panelLeft) {
            let newWidth = window.innerWidth - e.clientX;
            panelLeft.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingLeft) {
            isResizingLeft = false;
            if (resizerLeft) resizerLeft.classList.remove('active');
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });

    /* -----------------------------------------
       Right Panel (Constellation) Logic
       ----------------------------------------- */
    const setupEyeToggles = () => {
        const eyeToggleButtons = document.querySelectorAll('.eye-toggle-btn');
        eyeToggleButtons.forEach(button => {
            button.onclick = null; 
            button.onclick = function () {
                this.classList.toggle('slashed');
                const section = this.closest('.section');
                if (section && window.orbitManager && section.constellationObj) {
                    section.constellationObj.visible = !this.classList.contains('slashed');
                }
            };
        });
    };

    const resizerRight = document.getElementById('dragHandleRight');
    const panelRight = document.getElementById('sidePanelRight');
    const toggleWindowRightBtn = document.getElementById('toggleWindowRightBtn');
    let isResizingRight = false;

    if (toggleWindowRightBtn && panelRight) {
        toggleWindowRightBtn.addEventListener('click', () => {
            panelRight.classList.toggle('transparent-mode');
        });
    }

    if (resizerRight && panelRight) {
        resizerRight.addEventListener('mousedown', (e) => {
            isResizingRight = true;
            resizerRight.classList.add('active');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (isResizingRight && panelRight) {
            let newWidth = e.clientX;
            panelRight.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingRight) {
            isResizingRight = false;
            if (resizerRight) resizerRight.classList.remove('active');
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });

    /* -----------------------------------------
       Floating AI Chatbot Logic
       ----------------------------------------- */
    const aiChatbot = document.getElementById('aiChatbot');
    const aiChatbotHeader = document.getElementById('aiChatbotHeader');
    const aiChatbotReopen = document.getElementById('aiChatbotReopen');
    const aiCloseBtn = document.getElementById('aiCloseBtn');
    const aiMinimizeBtn = document.getElementById('aiMinimizeBtn');
    const aiChatbotResizeHandle = document.getElementById('aiChatbotResizeHandle');
    const aiChatbotForm = document.getElementById('aiChatbotForm');
    const aiChatbotInput = document.getElementById('aiChatbotInput');
    const aiChatbotBody = aiChatbot ? aiChatbot.querySelector('.ai-chatbot-body') : null;
    const aiChatbotSendBtn = aiChatbotForm ? aiChatbotForm.querySelector('.ai-chatbot-send-btn') : null;
    const floatingLayer = document.getElementById('floating-layer');
    const middleArea = document.querySelector('.middle-area');
    const leftPanel = document.getElementById('sidePanelRight');
    const rightPanel = document.getElementById('sidePanelLeft');

    if (aiChatbot && aiChatbotHeader && aiChatbotForm && aiChatbotInput && aiChatbotBody) {
        const supportsFloatingChat = Boolean(middleArea && floatingLayer && leftPanel && rightPanel);
        let chatMode = supportsFloatingChat ? 'floating' : 'embedded';
        let dragState = null;
        let resizeState = null;
        let resizeFrame = null;
        let latestRequestId = 0;
        let aiState = 'idle';
        let isProcessing = false;
        let activeRequest = null;
        let thinkingAnimationTimer = null;
        let thinkingFrameIndex = 0;
        let latestPrompt = '';
        let aiChatMode = 'think'; // 'think' or 'instant'
        const aiChatbotModeToggle = document.getElementById('aiChatbotModeToggle');
        const floatingPosition = { left: 16, top: 16 };
        const SNAP_THRESHOLD = 48;
        const statusLabels = ['Thinking...', 'Reasoning...', 'Processing...'];
        const thinkingFrames = [
            '/static/icons/arcturusAI-animation1.svg',
            '/static/icons/arcturusAI-animation2.svg',
            '/static/icons/arcturusAI-animation3.svg',
            '/static/icons/arcturusAI-animation4.svg'
        ];

        function clearSnapPreview() {
            if (!supportsFloatingChat) return;
            leftPanel.classList.remove('chatbot-snap-target');
            rightPanel.classList.remove('chatbot-snap-target');
        }

        function setFloatingPosition(left, top) {
            if (!supportsFloatingChat) return;
            const bounds = middleArea.getBoundingClientRect();
            const maxLeft = Math.max(0, bounds.width - aiChatbot.offsetWidth - 8);
            const maxTop = Math.max(0, bounds.height - aiChatbot.offsetHeight - 8);
            floatingPosition.left = Math.min(Math.max(0, left), maxLeft);
            floatingPosition.top = Math.min(Math.max(0, top), maxTop);
            aiChatbot.style.left = `${floatingPosition.left}px`;
            aiChatbot.style.top = `${floatingPosition.top}px`;
        }

        function setBottomLeftFloatingPosition() {
            if (!supportsFloatingChat) return;
            const bounds = middleArea.getBoundingClientRect();
            setFloatingPosition(16, Math.max(16, bounds.height - aiChatbot.offsetHeight - 16));
        }

        function setChatMode(nextMode) {
            if (!supportsFloatingChat) return;
            chatMode = nextMode;
            aiChatbot.classList.toggle('docked', chatMode !== 'floating');

            if (chatMode === 'dock-left') {
                leftPanel.appendChild(aiChatbot);
            } else if (chatMode === 'dock-right') {
                rightPanel.appendChild(aiChatbot);
            } else {
                floatingLayer.appendChild(aiChatbot);
                setFloatingPosition(floatingPosition.left, floatingPosition.top);
            }
            clearSnapPreview();
        }

        function setFloatingSize(width, height, left, top) {
            if (!supportsFloatingChat) return;
            const bounds = middleArea.getBoundingClientRect();
            const minWidth = 280;
            const minHeight = 320;
            const maxWidth = Math.min(640, bounds.width - left - 16);
            const maxHeight = Math.min(window.innerHeight * 0.8, bounds.height - 16);
            const nextWidth = Math.min(Math.max(width, minWidth), maxWidth);
            const nextHeight = Math.min(Math.max(height, minHeight), maxHeight);
            aiChatbot.style.width = `${nextWidth}px`;
            aiChatbot.style.height = `${nextHeight}px`;
            const nextLeft = Math.min(Math.max(0, left), Math.max(0, bounds.width - nextWidth - 8));
            const nextTop = Math.min(Math.max(0, top), Math.max(0, bounds.height - nextHeight - 8));
            setFloatingPosition(nextLeft, nextTop);
        }

        function applyResizeFrame() {
            resizeFrame = null;
            if (!resizeState) return;
            setFloatingSize(
                resizeState.nextWidth,
                resizeState.nextHeight,
                resizeState.startLeft,
                resizeState.nextTop
            );
        }

        function clearLauncherState() {
            if (!aiChatbotReopen) return;
            aiChatbotReopen.classList.remove('is-thinking', 'is-success', 'is-failed', 'bounce2', 'pulse-thinking');
        }

        function setLauncherState(state) {
            if (!aiChatbotReopen || !aiChatbot.hidden) return;
            clearLauncherState();
            if (state === 'thinking') {
                aiChatbotReopen.classList.add('is-thinking', 'pulse-thinking');
            } else if (state === 'success') {
                aiChatbotReopen.classList.add('is-success', 'bounce2');
            } else if (state === 'failed') {
                aiChatbotReopen.classList.add('is-failed', 'bounce2');
            }
        }

        function appendInlineMarkdown(parent, text) {
            const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
            parts.forEach((part) => {
                if (part.startsWith('`') && part.endsWith('`')) {
                    const code = document.createElement('code');
                    code.textContent = part.slice(1, -1);
                    parent.appendChild(code);
                } else if (part.startsWith('**') && part.endsWith('**')) {
                    const strong = document.createElement('strong');
                    strong.textContent = part.slice(2, -2);
                    parent.appendChild(strong);
                } else {
                    parent.appendChild(document.createTextNode(part));
                }
            });
        }

        function renderMarkdown(container, text) {
            const lines = text.split('\n');
            let paragraph = null;
            let list = null;
            let codeBlock = null;

            function flushParagraph() {
                paragraph = null;
            }

            function flushList() {
                list = null;
            }

            lines.forEach((rawLine) => {
                const line = rawLine.trimEnd();

                if (line.startsWith('```')) {
                    flushParagraph();
                    flushList();
                    if (codeBlock) {
                        codeBlock = null;
                    } else {
                        const pre = document.createElement('pre');
                        const code = document.createElement('code');
                        pre.appendChild(code);
                        container.appendChild(pre);
                        codeBlock = code;
                    }
                    return;
                }

                if (codeBlock) {
                    codeBlock.textContent += `${codeBlock.textContent ? '\n' : ''}${rawLine}`;
                    return;
                }

                if (!line.trim()) {
                    flushParagraph();
                    flushList();
                    return;
                }

                if (/^[-*]\s+/.test(line)) {
                    flushParagraph();
                    if (!list) {
                        list = document.createElement('ul');
                        container.appendChild(list);
                    }
                    const item = document.createElement('li');
                    appendInlineMarkdown(item, line.replace(/^[-*]\s+/, ''));
                    list.appendChild(item);
                    return;
                }

                flushList();
                if (!paragraph) {
                    paragraph = document.createElement('p');
                    container.appendChild(paragraph);
                } else {
                    paragraph.appendChild(document.createElement('br'));
                }
                appendInlineMarkdown(paragraph, line);
            });
        }

        function createMessageActions(text, prompt = '') {
            const actions = document.createElement('div');
            actions.className = 'ai-chatbot-message-actions';
            [
                { label: 'Copy response', icon: '/static/icons/copy.svg', onClick: () => navigator.clipboard?.writeText(text) },
                { label: 'Bad response', icon: '/static/icons/dislike.svg' },
                { label: 'Good response', icon: '/static/icons/like.svg' },
                { label: 'Regenerate response', icon: '/static/icons/refresh.svg', onClick: () => requestAssistantResponse(prompt || latestPrompt) }
            ].forEach(({ label, icon, onClick }) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'ai-chatbot-action-btn';
                button.title = label;
                button.setAttribute('aria-label', label);
                const image = document.createElement('img');
                image.src = icon;
                image.alt = '';
                button.appendChild(image);
                if (onClick) button.addEventListener('click', onClick);
                actions.appendChild(button);
            });
            return actions;
        }

        function appendMessage(sender, text, options = {}) {
            if (!aiChatbotBody) return;
            const message = document.createElement('div');
            message.className = `ai-chatbot-message ${sender}`;
            const content = document.createElement('div');
            content.className = 'ai-chatbot-message-content';
            renderMarkdown(content, text);
            message.appendChild(content);
            if (sender === 'assistant' && options.actions !== false) {
                message.appendChild(createMessageActions(text, options.prompt));
            }
            aiChatbotBody.appendChild(message);
            aiChatbotBody.scrollTop = aiChatbotBody.scrollHeight;
            return message;
        }

        function setReasoningOpen(reasoning, isOpen) {
            if (!reasoning) return;
            reasoning.classList.toggle('is-open', isOpen);
            const trigger = reasoning.querySelector('.ai-chatbot-reasoning-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', String(isOpen));
        }

        function createReasoningBlock() {
            const reasoning = document.createElement('div');
            reasoning.className = 'ai-chatbot-reasoning is-open';
            reasoning.dataset.startedAt = String(Date.now());
            reasoning.innerHTML = `
                <button class="ai-chatbot-reasoning-trigger" type="button" aria-expanded="true">
                    <img class="ai-chatbot-reasoning-icon" src="${thinkingFrames[0]}" alt="">
                    <span class="ai-chatbot-reasoning-label is-thinking">Thinking...</span>
                    <svg class="ai-chatbot-reasoning-chevron" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="ai-chatbot-reasoning-content ai-chatbot-message-content"></div>
            `;
            const content = reasoning.querySelector('.ai-chatbot-reasoning-content');
            renderMarkdown(
                content,
                'Preparing a concise response.\n\n- Reviewing the request\n- Organizing a user-facing summary\n- Keeping the answer safe and explainable'
            );
            reasoning.querySelector('.ai-chatbot-reasoning-trigger').addEventListener('click', () => {
                setReasoningOpen(reasoning, !reasoning.classList.contains('is-open'));
            });
            return reasoning;
        }

        function createPendingAssistantMessage() {
            if (!aiChatbotBody) return null;
            const message = document.createElement('div');
            message.className = 'ai-chatbot-message assistant';
            const reasoning = createReasoningBlock();
            message.appendChild(reasoning);
            aiChatbotBody.appendChild(message);
            aiChatbotBody.scrollTop = aiChatbotBody.scrollHeight;
            return { message, reasoning };
        }

        function completeReasoning(reasoning) {
            if (!reasoning) return;
            const startedAt = Number(reasoning.dataset.startedAt);
            const durationSeconds = Number.isFinite(startedAt)
                ? Math.ceil((Date.now() - startedAt) / 1000)
                : null;
            const label = reasoning.querySelector('.ai-chatbot-reasoning-label');
            if (label) {
                label.classList.remove('is-thinking');
                label.textContent = durationSeconds === null
                    ? 'Thought for a few seconds'
                    : `Thought for ${durationSeconds} seconds`;
            }
            window.setTimeout(() => setReasoningOpen(reasoning, false), 1000);
        }

        function stopOpenChatbotThinkingAnimation() {
            if (thinkingAnimationTimer) {
                window.clearInterval(thinkingAnimationTimer);
                thinkingAnimationTimer = null;
            }
        }

        function startOpenChatbotThinkingAnimation(icons = [], textNodes = []) {
            stopOpenChatbotThinkingAnimation();
            thinkingFrameIndex = 0;
            
            const updateFrames = () => {
                const iconSrc = thinkingFrames[thinkingFrameIndex];
                icons.forEach(icon => { if (icon) icon.src = iconSrc; });
                
                const dots = '.'.repeat(thinkingFrameIndex);
                textNodes.forEach(node => {
                    if (node) {
                        node.textContent = 'Processing' + dots;
                    }
                });
            };

            updateFrames();
            thinkingAnimationTimer = window.setInterval(() => {
                thinkingFrameIndex = (thinkingFrameIndex + 1) % thinkingFrames.length;
                updateFrames();
            }, 250);
        }

        function appendThinkingRow(text, parent = aiChatbotBody) {
            if (!parent) return null;
            const row = document.createElement('div');
            row.className = 'chatbot-thinking-row';
            row.innerHTML = `<span class="chatbot-thinking-text"></span>`;
            row.querySelector('.chatbot-thinking-text').textContent = text;
            parent.appendChild(row);
            aiChatbotBody.scrollTop = aiChatbotBody.scrollHeight;
            return row;
        }

        function setProcessingState(processing) {
            isProcessing = processing;
            if (aiChatbotInput) aiChatbotInput.disabled = processing;
            if (!aiChatbotSendBtn) return;
            aiChatbotSendBtn.classList.toggle('is-processing', processing);
            aiChatbotSendBtn.title = processing ? 'Stop generating' : 'Send';
            aiChatbotSendBtn.setAttribute('aria-label', processing ? 'Stop generating' : 'Send');
            aiChatbotSendBtn.textContent = processing ? '■' : 'Send';
        }

        function restoreInputAfterResponse() {
            setProcessingState(false);
            if (aiChatbotInput) aiChatbotInput.focus();
            if (aiChatbotBody) aiChatbotBody.scrollTop = aiChatbotBody.scrollHeight;
        }

        function resizeChatbotInput() {
            if (!aiChatbotInput || aiChatbotInput.tagName !== 'TEXTAREA') return;
            aiChatbotInput.style.height = 'auto';
            const inputStyles = window.getComputedStyle(aiChatbotInput);
            const minHeight = Number.parseFloat(inputStyles.minHeight);
            const maxHeight = Number.parseFloat(inputStyles.maxHeight);
            const unclampedHeight = aiChatbotInput.scrollHeight;
            const nextHeight = Math.min(
                Number.isFinite(maxHeight) ? maxHeight : unclampedHeight,
                Math.max(Number.isFinite(minHeight) ? minHeight : 0, unclampedHeight)
            );
            aiChatbotInput.style.height = `${nextHeight}px`;
            aiChatbotInput.style.overflowY = unclampedHeight > nextHeight ? 'auto' : 'hidden';
        }

        function stopReasoning(reasoning) {
            if (!reasoning) return;
            const label = reasoning.querySelector('.ai-chatbot-reasoning-label');
            if (label) {
                label.classList.remove('is-thinking');
                label.textContent = 'Stopped';
            }
            window.setTimeout(() => setReasoningOpen(reasoning, false), 1000);
        }

        function stopActiveResponse() {
            if (!isProcessing || !activeRequest) return;

            const { controller, reasoning, responseContent, thinkingRow } = activeRequest;
            latestRequestId += 1;
            controller.abort();
            stopOpenChatbotThinkingAnimation();
            if (thinkingRow) thinkingRow.remove();
            stopReasoning(reasoning);
            if (responseContent) {
                responseContent.innerHTML = '';
                renderMarkdown(responseContent, 'Generation stopped.');
            }
            aiState = 'idle';
            activeRequest = null;
            restoreInputAfterResponse();
            clearLauncherState();
        }

        async function requestAssistantResponse(text) {
            if (!text || isProcessing) return;
            latestPrompt = text;
            const requestId = ++latestRequestId;
            const controller = new AbortController();
            aiState = 'thinking';
            setLauncherState('thinking');
            setProcessingState(true);

            const message = document.createElement('div');
            message.className = 'ai-chatbot-message assistant';
            
            let reasoning = null;
            let reasoningContent = null;
            if (aiChatMode === 'think') {
                reasoning = createReasoningBlock();
                reasoningContent = reasoning.querySelector('.ai-chatbot-reasoning-content');
                reasoningContent.innerHTML = ''; // clear default
                message.appendChild(reasoning);
            }
            
            const responseContent = document.createElement('div');
            responseContent.className = 'ai-chatbot-message-content';
            message.appendChild(responseContent);

            aiChatbotBody.appendChild(message);
            const thinkingRow = appendThinkingRow('Processing', message);
            aiChatbotBody.scrollTop = aiChatbotBody.scrollHeight;

            const rIcon = reasoning?.querySelector('.ai-chatbot-reasoning-icon');
            const tText = thinkingRow?.querySelector('.chatbot-thinking-text');
            startOpenChatbotThinkingAnimation([rIcon], [tText]);
            activeRequest = { requestId, controller, message, reasoning, responseContent, thinkingRow };

            let fullRawText = '';

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt: text, 
                        mode: aiChatMode,
                        project_state: window.SessionManager ? window.SessionManager.getCurrentState() : {}
                    }),
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error('API Error: ' + response.statusText);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                let currentThinkText = '';
                let currentMainText = '';

                while (true) {
                    if (requestId !== latestRequestId) break;
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') continue;
                            try {
                                const data = JSON.parse(dataStr);
                                if (data.error) throw new Error(data.error);
                                
                                if (data.thought) {
                                    currentThinkText += data.thought;
                                } else if (data.text) {
                                    currentMainText += data.text;
                                }

                                // Update UI
                                if (aiChatMode === 'think' && reasoningContent) {
                                    reasoningContent.innerHTML = '';
                                    renderMarkdown(reasoningContent, currentThinkText.trim() || 'Thinking...');
                                }

                                responseContent.innerHTML = '';
                                renderMarkdown(responseContent, currentMainText.trim());
                                aiChatbotBody.scrollTop = aiChatbotBody.scrollHeight;

                            } catch (e) {
                                console.error('Parse error or backend error:', e);
                            }
                        }
                    }
                }

                if (requestId !== latestRequestId) return;
                
                stopOpenChatbotThinkingAnimation();
                if (thinkingRow) thinkingRow.remove();
                if (reasoning) completeReasoning(reasoning);

                aiState = 'success';
                let finalText = currentMainText.trim();
                try {
                    const parsed = JSON.parse(finalText);
                    if (parsed && parsed.type === 'state_update') {
                        if (window.SessionManager && window.SessionManager.applyStateUpdate) {
                            window.SessionManager.applyStateUpdate(parsed.updated_state);
                        }
                        const saveMsg = parsed.saved ? " Update saved directly to your YAML file." : " Updates applied to your session.";
                        finalText = "✅ **Task Completed**\n" + saveMsg;
                        responseContent.innerHTML = '';
                        renderMarkdown(responseContent, finalText);
                    }
                } catch(e) {
                    // Not JSON, keep raw markdown
                }
                
                message.appendChild(createMessageActions(finalText, text));
                aiChatbotBody.scrollTop = aiChatbotBody.scrollHeight;
                setLauncherState('success');
                activeRequest = null;
                restoreInputAfterResponse();

            } catch (err) {
                if (requestId !== latestRequestId) return;
                console.error(err);
                stopOpenChatbotThinkingAnimation();
                if (thinkingRow) thinkingRow.remove();
                if (reasoning) completeReasoning(reasoning);

                aiState = 'failed';
                responseContent.innerHTML = '';
                renderMarkdown(responseContent, '**Sorry — I could not complete that response.** Please try again.');
                setLauncherState('failed');
                activeRequest = null;
                restoreInputAfterResponse();
            }
        }

        function openChatbot() {
            aiChatbot.hidden = false;
            aiChatbot.classList.remove('minimized');
            if (chatMode === 'floating') setBottomLeftFloatingPosition();
            if (aiState === 'success' || aiState === 'failed') aiState = 'idle';
            clearLauncherState();
        }

        function closeChatbot() {
            aiChatbot.classList.remove('minimized');
            aiChatbot.hidden = true;
            setLauncherState(aiState);
        }

        function minimizeChatbot() {
            aiChatbot.classList.add('minimized');
            aiChatbot.hidden = true;
            setLauncherState(aiState);
        }

        if (supportsFloatingChat) {
            aiChatbotHeader.addEventListener('mousedown', (e) => {
                if (e.target.closest('button')) return;
                const rect = aiChatbot.getBoundingClientRect();
                if (chatMode !== 'floating') {
                    setChatMode('floating');
                    const bounds = middleArea.getBoundingClientRect();
                    setFloatingPosition(rect.left - bounds.left, rect.top - bounds.top);
                }
                dragState = {
                    offsetX: e.clientX - rect.left,
                    offsetY: e.clientY - rect.top
                };
                document.body.style.userSelect = 'none';
            });

            document.addEventListener('mousemove', (e) => {
                if (resizeState) {
                    e.preventDefault();
                    const deltaX = e.clientX - resizeState.startX;
                    const deltaY = e.clientY - resizeState.startY;
                    const nextWidth = resizeState.startWidth + deltaX;
                    const nextHeight = resizeState.startHeight - deltaY;
                    const constrainedHeight = Math.min(
                        Math.max(nextHeight, 320),
                        Math.min(window.innerHeight * 0.8, resizeState.startBottom - 16)
                    );
                    const nextTop = resizeState.startBottom - constrainedHeight;
                    resizeState.nextWidth = nextWidth;
                    resizeState.nextHeight = constrainedHeight;
                    resizeState.nextTop = nextTop;
                    if (!resizeFrame) resizeFrame = window.requestAnimationFrame(applyResizeFrame);
                    return;
                }
                if (!dragState) return;
                const bounds = middleArea.getBoundingClientRect();
                setFloatingPosition(e.clientX - bounds.left - dragState.offsetX, e.clientY - bounds.top - dragState.offsetY);
                const distanceToLeft = e.clientX;
                const distanceToRight = window.innerWidth - e.clientX;
                clearSnapPreview();
                if (distanceToLeft <= SNAP_THRESHOLD) {
                    leftPanel.classList.add('chatbot-snap-target');
                } else if (distanceToRight <= SNAP_THRESHOLD) {
                    rightPanel.classList.add('chatbot-snap-target');
                }
            });

            document.addEventListener('mouseup', (e) => {
                if (resizeState) {
                    if (resizeFrame) {
                        window.cancelAnimationFrame(resizeFrame);
                        resizeFrame = null;
                    }
                    resizeState = null;
                    aiChatbot.classList.remove('is-resizing');
                    document.body.style.cursor = 'default';
                    document.body.style.userSelect = 'auto';
                    return;
                }
                if (!dragState) return;
                dragState = null;
                document.body.style.userSelect = 'auto';
                if (e.clientX <= SNAP_THRESHOLD) {
                    setChatMode('dock-left');
                } else if (window.innerWidth - e.clientX <= SNAP_THRESHOLD) {
                    setChatMode('dock-right');
                } else {
                    clearSnapPreview();
                }
            });
        }

        if (aiCloseBtn) {
            aiCloseBtn.addEventListener('click', closeChatbot);
        }

        if (aiChatbotReopen) {
            aiChatbotReopen.addEventListener('click', () => {
                if (aiChatbot.hidden) openChatbot();
            });
        }

        if (aiMinimizeBtn) {
            aiMinimizeBtn.addEventListener('click', minimizeChatbot);
        }

        if (supportsFloatingChat && aiChatbotResizeHandle) {
            aiChatbotResizeHandle.addEventListener('mousedown', (e) => {
                if (chatMode !== 'floating') return;
                e.preventDefault();
                e.stopPropagation();
                const rect = aiChatbot.getBoundingClientRect();
                const bounds = middleArea.getBoundingClientRect();
                resizeState = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startWidth: rect.width,
                    startHeight: rect.height,
                    startLeft: rect.left - bounds.left,
                    startTop: rect.top - bounds.top,
                    startBottom: rect.top - bounds.top + rect.height,
                    nextWidth: rect.width,
                    nextHeight: rect.height,
                    nextTop: rect.top - bounds.top
                };
                aiChatbot.classList.add('is-resizing');
                document.body.style.cursor = 'nesw-resize';
                document.body.style.userSelect = 'none';
            });
        }

        if (aiChatbotForm && aiChatbotInput && aiChatbotBody) {
            if (aiChatbotModeToggle) {
                aiChatbotModeToggle.addEventListener('click', () => {
                    aiChatMode = aiChatMode === 'think' ? 'instant' : 'think';
                    aiChatbotModeToggle.classList.toggle('instant-mode', aiChatMode === 'instant');
                    
                    const modeIcon = document.getElementById('aiChatbotModeIcon');
                    if (aiChatMode === 'instant') {
                        if (modeIcon) modeIcon.src = '/static/icons/instantWhite.svg';
                        aiChatbotModeToggle.title = 'Switch to Think Mode';
                    } else {
                        if (modeIcon) modeIcon.src = '/static/icons/thinkBlack.svg';
                        aiChatbotModeToggle.title = 'Switch to Instant Mode';
                    }
                });
            }

            aiChatbotForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (isProcessing) {
                    stopActiveResponse();
                    return;
                }
                const text = aiChatbotInput.value.trim();
                if (!text) return;

                appendMessage('user', text);
                aiChatbotInput.value = '';
                resizeChatbotInput();
                requestAssistantResponse(text);
            });

            if (aiChatbotInput.tagName === 'TEXTAREA') {
                aiChatbotInput.addEventListener('input', resizeChatbotInput);
                aiChatbotInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        aiChatbotForm.requestSubmit();
                    }
                });
                resizeChatbotInput();
            }
        }

        aiChatbotBody.querySelectorAll('.ai-chatbot-message.assistant').forEach((message) => {
            if (message.querySelector('.ai-chatbot-message-actions')) return;
            const text = message.querySelector('.ai-chatbot-message-content')?.textContent?.trim();
            if (text) message.appendChild(createMessageActions(text));
        });

        if (supportsFloatingChat) {
            setChatMode('floating');
            setBottomLeftFloatingPosition();
        }
    }

    /* -----------------------------------------
       View List Dropdown Logic
       ----------------------------------------- */
    const dropdownContainer = document.getElementById('viewSettingsDropdown');
    const dropdownToggleBtn = document.getElementById('dropdownToggleBtn');

    if (dropdownToggleBtn && dropdownContainer) {
        dropdownToggleBtn.addEventListener('click', () => {
            dropdownContainer.classList.toggle('closed');
        });
    }

    /* -----------------------------------------
       Toolbar Toggle Logic
       ----------------------------------------- */
    const viewToggle = document.getElementById('viewToggle');
    const viewLabel = document.getElementById('viewLabel');

    if (viewToggle) {
        viewToggle.addEventListener('change', () => {
            if (viewToggle.checked) {
                viewLabel.textContent = "3d View";
                if (window.orbitManager) window.orbitManager.setMode('3D');
            } else {
                viewLabel.textContent = "2d View";
                if (window.orbitManager) window.orbitManager.setMode('2D');
            }
        });
    }

    /* -----------------------------------------
       Constellation List Selection & Toolbar
       ----------------------------------------- */
    let selectedConstellationIndex = null;
    const throwDeleteBtn = document.getElementById('deleteBtn');
    const focusBtn = document.getElementById('focusBtn');
    const groupBtn = document.getElementById('group-constellations-btn');

    function updateThrowButtons() {
        const selectedCount = document.querySelectorAll('#mainSectionsContainerRight .selected').length;
        const isFocused = window.orbitManager && window.orbitManager.focusedSat !== null;
        
        // Find if we have exactly one constellation selected for focus
        const selectedSections = document.querySelectorAll('#mainSectionsContainerRight .section.selected');
        const firstSelectedSection = selectedSections[0];
        
        if (selectedSections.length === 1) {
            if (focusBtn) {
                focusBtn.disabled = false;
                if (!isFocused) focusBtn.classList.remove('active');
            }
            if (throwDeleteBtn) throwDeleteBtn.disabled = false;
            // Update selectedConstellationIndex based on DOM order for single selection
            selectedConstellationIndex = getAllSections().indexOf(firstSelectedSection);
        } else if (selectedCount > 0) {
            // Multiple items (sections or groups) selected
            if (focusBtn) {
                focusBtn.disabled = !isFocused;
                if (!isFocused) focusBtn.classList.remove('active');
            }
            if (throwDeleteBtn) throwDeleteBtn.disabled = false;
            selectedConstellationIndex = null;
        } else {
            if (focusBtn) {
                focusBtn.disabled = !isFocused;
                if (!isFocused) focusBtn.classList.remove('active');
            }
            if (throwDeleteBtn) throwDeleteBtn.disabled = true;
            selectedConstellationIndex = null;
        }
    }

    function getAllSections() {
        return Array.from(document.querySelectorAll('#mainSectionsContainerRight .section'));
    }

    function refreshSectionIndices() {
        if (!window.orbitManager) return;
        
        // Reorder the constellations array in OrbitManager to match the DOM order
        const allSections = getAllSections();
        const newConstellations = allSections.map(s => s.constellationObj).filter(c => c !== null);
        
        window.orbitManager.constellations = newConstellations;
        
        // If 2D view is active, trigger redraw
        if (window.orbitManager.mode === '2D') {
            window.orbitManager.draw2D();
        }
    }

    // Add drag and drop listeners to the container for dropping into empty space
    const sectionsWrapper = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
    if (sectionsWrapper) {
        sectionsWrapper.addEventListener('dragover', (e) => {
            if (e.target === sectionsWrapper) {
                e.preventDefault();
                sectionsWrapper.classList.add('drag-over-container');
            }
        });

        sectionsWrapper.addEventListener('dragleave', (e) => {
            if (e.target === sectionsWrapper) {
                sectionsWrapper.classList.remove('drag-over-container');
            }
        });

        sectionsWrapper.addEventListener('drop', (e) => {
            if (e.target === sectionsWrapper && draggedElement) {
                e.preventDefault();
                sectionsWrapper.classList.remove('drag-over-container');
                sectionsWrapper.appendChild(draggedElement);
                refreshSectionIndices();
                updateThrowButtons();
            }
        });
    }

    if (focusBtn) {
        focusBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                const isFocused = window.orbitManager.focusedSat !== null;
                
                if (isFocused) {
                    // Turn OFF focus
                    window.orbitManager.focusOnSatellite();
                    focusBtn.classList.remove('active');
                    updateThrowButtons();
                } else if (selectedConstellationIndex !== null) {
                    // Turn ON focus
                    const newlyFocused = window.orbitManager.focusOnSatellite(selectedConstellationIndex);
                    focusBtn.classList.toggle('active', newlyFocused);
                    updateThrowButtons();
                }
            }
        });
    }

    if (throwDeleteBtn) {
        throwDeleteBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                const selectedItems = Array.from(document.querySelectorAll('#mainSectionsContainerRight .selected'));
                if (selectedItems.length === 0) return;

                // Sort selected sections by index descending to avoid splice shifting issues
                const sectionsToRemove = [];
                selectedItems.forEach(item => {
                    if (item.classList.contains('section')) {
                        sectionsToRemove.push(item);
                    } else if (item.classList.contains('group')) {
                        // All sections inside the group
                        item.querySelectorAll('.section').forEach(s => sectionsToRemove.push(s));
                    }
                });

                // Get unique sections and their indices
                const uniqueSections = Array.from(new Set(sectionsToRemove));
                const allSections = getAllSections();
                const indicesToRemove = uniqueSections.map(s => allSections.indexOf(s)).sort((a, b) => b - a);

                indicesToRemove.forEach(idx => {
                    if (idx !== -1) {
                        window.orbitManager.removeConstellation(idx);
                        allSections[idx].remove();
                    }
                });

                // Remove selected groups if they are empty or were selected themselves
                selectedItems.forEach(item => {
                    if (item.classList.contains('group')) {
                        item.remove();
                    }
                });

                // Clean up empty groups
                document.querySelectorAll('#mainSectionsContainerRight .group').forEach(group => {
                    if (group.querySelector('.group-content').children.length === 0) {
                        group.remove();
                    }
                });
                
                // Clear selection
                selectedConstellationIndex = null;
                updateThrowButtons();

                // If currently focused on that sat, disable focus
                if (window.orbitManager.focusedSat === null) {
                    focusBtn.classList.remove('active');
                }
            }
        });
    }

    if (groupBtn) {
        groupBtn.addEventListener('click', () => {
            groupSelectedConstellations();
        });
    }

    function groupSelectedConstellations() {
        const container = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
        // Find selected items that are direct children of their parent (no double selection of parent and child)
        const selectedItems = Array.from(document.querySelectorAll('#mainSectionsContainerRight .selected'));
        if (selectedItems.length === 0) return;

        // Filter out items whose parents are also selected
        const topLevelSelected = selectedItems.filter(item => {
            let parent = item.parentElement;
            while (parent && parent !== container) {
                if (parent.classList.contains('selected')) return false;
                parent = parent.parentElement;
            }
            return true;
        });

        if (topLevelSelected.length === 0) return;

        // Create group at the position of the first selected item
        const firstItem = topLevelSelected[0];
        const group = addGroupToList("New Group", topLevelSelected, firstItem.parentElement, firstItem);
        
        // Clear selection after grouping
        document.querySelectorAll('#mainSectionsContainerRight .selected').forEach(el => el.classList.remove('selected'));
        selectedConstellationIndex = null;
        updateThrowButtons();
    }

    /* -----------------------------------------
       Drag and Drop Logic
       ----------------------------------------- */
    let draggedElement = null;

    function setupDragAndDrop(el) {
        el.addEventListener('mousedown', (e) => {
            if (e.target.closest('.section-header') || e.target.closest('.group-header')) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                    el.draggable = false;
                } else {
                    el.draggable = true;
                }
            } else {
                el.draggable = false;
            }
        });

        el.addEventListener('dragstart', (e) => {
            if (!el.draggable) {
                e.preventDefault();
                return;
            }
            e.stopPropagation(); // Prevent parent groups from catching this
            draggedElement = el;
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Set some data to satisfy Firefox
            e.dataTransfer.setData('text/plain', '');
        });

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = el.getBoundingClientRect();
            
            // Clean up previous classes
            el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-inside');

            if (el.classList.contains('group')) {
                const threshold = 15; // increased threshold for inside group
                if (e.clientY < rect.top + threshold) {
                    el.classList.add('drop-target-above');
                } else if (e.clientY > rect.bottom - threshold) {
                    el.classList.add('drop-target-below');
                } else {
                    el.classList.add('drop-target-inside');
                }
            } else {
                const midpoint = rect.top + rect.height / 2;
                if (e.clientY < midpoint) {
                    el.classList.add('drop-target-above');
                } else {
                    el.classList.add('drop-target-below');
                }
            }
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-inside');
        });

        el.addEventListener('dragend', (e) => {
            e.stopPropagation();
            el.classList.remove('dragging');
            document.querySelectorAll('.drop-target-above, .drop-target-below, .drop-target-inside').forEach(node => {
                node.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-inside');
            });
            if (sectionsWrapper) sectionsWrapper.classList.remove('drag-over-container');
            draggedElement = null;
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-inside');

            if (!draggedElement || draggedElement === el) return;
            
            // Prevent dragging a group into itself or its own children
            if (draggedElement.contains(el)) return;

            const rect = el.getBoundingClientRect();
            const threshold = 15;

            if (el.classList.contains('group') && 
                e.clientY >= rect.top + threshold && 
                e.clientY <= rect.bottom - threshold) {
                // Drop INSIDE group
                const content = el.querySelector('.group-content');
                content.appendChild(draggedElement);
                el.classList.remove('collapsed'); // Expand if dropped inside
            } else {
                // Drop BEFORE or AFTER
                const midpoint = rect.top + rect.height / 2;
                if (e.clientY < midpoint) {
                    el.parentNode.insertBefore(draggedElement, el);
                } else {
                    el.parentNode.insertBefore(draggedElement, el.nextSibling);
                }
            }
            
            refreshSectionIndices();
            updateThrowButtons();
        });
    }

    function addGroupToList(name = "New Group", children = [], parent = null, referenceNode = null) {
        const container = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
        if (!parent) parent = container;

        const group = document.createElement('div');
        group.className = 'group';
        group.draggable = true;
        group.innerHTML = `
            <div class="group-header">
                <div class="collapse-arrow"></div>
                <img src="/static/icon/groupSats.svg" alt="Group">
                <input type="text" class="group-name" value="${name}">
            </div>
            <div class="group-content"></div>
        `;

        if (referenceNode) {
            parent.insertBefore(group, referenceNode);
        } else {
            parent.appendChild(group);
        }

        const groupContent = group.querySelector('.group-content');
        children.forEach(child => {
            groupContent.appendChild(child);
        });

        // Collapse logic
        const arrow = group.querySelector('.collapse-arrow');
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            group.classList.toggle('collapsed');
        });

        // Group selection logic
        const groupHeader = group.querySelector('.group-header');
        groupHeader.addEventListener('click', (e) => {
            if (e.target.classList.contains('group-name') || e.target.classList.contains('collapse-arrow')) return;
            
            if (!e.ctrlKey && !e.metaKey) {
                const isAlreadySelected = group.classList.contains('selected');
                // Clear others
                document.querySelectorAll('#mainSectionsContainerRight .section, #mainSectionsContainerRight .group').forEach(el => {
                    if (el !== group) el.classList.remove('selected');
                });
                // Toggle self
                group.classList.toggle('selected', !isAlreadySelected);
            } else {
                group.classList.toggle('selected');
            }
            updateThrowButtons();
        });

        // Stop propagation for group name input to prevent selection toggle
        const groupNameInput = group.querySelector('.group-name');
        groupNameInput.addEventListener('click', (e) => e.stopPropagation());

        // Context Menu logic for group
        groupHeader.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!group.classList.contains('selected')) {
                document.querySelectorAll('#mainSectionsContainerRight .section, #mainSectionsContainerRight .group').forEach(el => el.classList.remove('selected'));
                group.classList.add('selected');
                updateThrowButtons();
            }
            
            showContextMenu(e.clientX, e.clientY, 'group');
        });

        setupDragAndDrop(group);

        return group;
    }
    window.addGroupToList = addGroupToList;

    /* -----------------------------------------
       Context Menu Global Logic
       ----------------------------------------- */
    const contextMenu = document.getElementById('constellation-context-menu');
    let copiedData = null;

    function showContextMenu(x, y, type) {
        if (!contextMenu) return;

        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;

        // Handle Ungroup visibility
        const ungroupItem = document.getElementById('menu-ungroup');
        if (ungroupItem) {
            ungroupItem.style.display = (type === 'group') ? 'block' : 'none';
        }

        // Handle Paste visibility/state
        const pasteItem = document.getElementById('menu-paste');
        if (pasteItem) {
            if (copiedData) {
                pasteItem.classList.remove('disabled');
            } else {
                pasteItem.classList.add('disabled');
            }
        }
    }

    function hideContextMenu() {
        if (contextMenu) contextMenu.style.display = 'none';
    }

    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.section') && !e.target.closest('.group')) {
            hideContextMenu();
        }
    });

    // Menu Item Handlers
    document.getElementById('menu-copy').addEventListener('click', () => {
        const selectedItems = Array.from(document.querySelectorAll('#mainSectionsContainerRight .selected'));
        if (selectedItems.length === 0) return;

        // Collect data from selected items
        copiedData = selectedItems.map(item => {
            if (item.classList.contains('section')) {
                return { type: 'section', settings: JSON.parse(JSON.stringify(item.constellationObj.settings)) };
            } else if (item.classList.contains('group')) {
                return { 
                    type: 'group', 
                    name: item.querySelector('.group-name').value,
                    children: Array.from(item.querySelector('.group-content').children).map(child => {
                         // Recursive for nested groups if needed, but simplified for now
                         if (child.classList.contains('section')) {
                            return { type: 'section', settings: JSON.parse(JSON.stringify(child.constellationObj.settings)) };
                         }
                         return null;
                    }).filter(c => c !== null)
                };
            }
        });
        hideContextMenu();
    });

    document.getElementById('menu-paste').addEventListener('click', () => {
        if (!copiedData) return;

        const target = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
        // If a group is selected, paste into it
        let pasteParent = target;
        const selectedGroup = document.querySelector('#mainSectionsContainerRight .group.selected');
        if (selectedGroup) {
            pasteParent = selectedGroup.querySelector('.group-content');
        }

        copiedData.forEach(item => {
            if (item.type === 'section') {
                pasteConstellation(item.settings, pasteParent);
            } else if (item.type === 'group') {
                const newGroup = addGroupToList(item.name + " (Copy)", [], pasteParent);
                const content = newGroup.querySelector('.group-content');
                item.children.forEach(child => {
                    pasteConstellation(child.settings, content);
                });
            }
        });
        hideContextMenu();
    });

    function pasteConstellation(settings, parent) {
        const newSettings = JSON.parse(JSON.stringify(settings));
        newSettings.name += " (Copy)";
        let constellation = null;
        if (window.orbitManager) {
            constellation = window.orbitManager.addConstellation(newSettings);
        }
        addConstellationToList(newSettings, constellation);
        // Move to correct parent if not the default container
        const container = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
        if (parent !== container) {
            const lastSection = container.lastElementChild;
            parent.appendChild(lastSection);
        }
    }

    document.getElementById('menu-delete').addEventListener('click', () => {
        if (throwDeleteBtn) throwDeleteBtn.click();
        hideContextMenu();
    });

    document.getElementById('menu-ungroup').addEventListener('click', () => {
        const selectedGroups = Array.from(document.querySelectorAll('#mainSectionsContainerRight .group.selected'));
        selectedGroups.forEach(group => {
            const content = group.querySelector('.group-content');
            const parent = group.parentElement;
            const children = Array.from(content.children);
            children.forEach(child => {
                parent.insertBefore(child, group);
            });
            group.remove();
        });
        hideContextMenu();
        updateThrowButtons();
    });



    function addConstellationToList(settings, constellationObj = null) {
        const container = document.querySelector('#mainSectionsContainerRight .sections-wrapper');
        const section = document.createElement('div');
        section.className = 'section';
        section.draggable = true;
        section.constellationObj = constellationObj;
        section.innerHTML = `
            <div class="section-header">
                <div class="collapse-arrow"></div>
                <h3>${settings.name}</h3>
                <div class="header-icons">
                    <div class="eye-toggle-btn">
                        <img src="/static/icon/toogleView.svg" alt="Toggle View">
                    </div>
                    <img src="/static/icon/more1.svg" class="detailed-settings-btn" alt="Settings" title="Detailed Settings">
                </div>
            </div>
            <div class="form-row">
                <span class="form-label">Sats Amount</span>
                <span class="form-value">${settings.satsPerPlane * settings.planes}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Orbital Planes</span>
                <span class="form-value">${settings.planes}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Inclination</span>
                <span class="form-value">${settings.inclination}</span>
            </div>
            <div class="form-row">
                <span class="form-label">Apogee/Perigee</span>
                <span class="form-value">${settings.apogee}/${settings.perigee} km</span>
            </div>
            <div class="form-row" style="margin-top: 15px; flex-direction: column; align-items: stretch; gap: 4px;">
                <label style="font-size: 11px; color:#aaa; margin-bottom: 2px;">Orbit/Sat Opacity</label>
                <div class="slider-group">
                    <div class="slider-track-wrapper">
                        <div class="slider-track">
                            <div class="block-blue blue-orbit"></div>
                            <div class="block-green"></div>
                            <div class="block-gray gray-orbit"></div>
                        </div>
                        <input type="range" class="hidden-slider opacity-orbit" min="0" max="1" step="0.05" value="1">
                        <span class="value-display disp-orbit">1.00</span>
                    </div>
                </div>
            </div>
            <div class="form-row" style="margin-top: 15px; flex-direction: column; align-items: stretch; gap: 4px; padding-bottom: 5px;">
                <label style="font-size: 11px; color:#aaa; margin-bottom: 2px;">Beam Opacity</label>
                <div class="slider-group">
                    <div class="slider-track-wrapper">
                        <div class="slider-track">
                            <div class="block-blue blue-beam"></div>
                            <div class="block-green"></div>
                            <div class="block-gray gray-beam"></div>
                        </div>
                        <input type="range" class="hidden-slider opacity-beam" min="0" max="0.5" step="0.01" value="0.1">
                        <span class="value-display disp-beam">0.10</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(section);
        setupEyeToggles();

        // Collapse logic
        const arrow = section.querySelector('.collapse-arrow');
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            section.classList.toggle('collapsed');
        });

        function getConstellationIndex() {
            if (!window.orbitManager || !section.constellationObj) return -1;
            return window.orbitManager.constellations.indexOf(section.constellationObj);
        }

        // Selection logic
        section.addEventListener('click', (e) => {
            if (e.target.closest('.header-icons') || e.target.classList.contains('collapse-arrow')) return;

            if (!e.ctrlKey && !e.metaKey) {
                const isAlreadySelected = section.classList.contains('selected');
                // Clear others
                document.querySelectorAll('#mainSectionsContainerRight .section, #mainSectionsContainerRight .group').forEach(el => {
                    if (el !== section) el.classList.remove('selected');
                });
                // Toggle self
                section.classList.toggle('selected', !isAlreadySelected);
            } else {
                section.classList.toggle('selected');
            }
            updateThrowButtons();
        });

        // Context Menu logic
        section.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // If not selected, select only this
            if (!section.classList.contains('selected')) {
                document.querySelectorAll('#mainSectionsContainerRight .section, #mainSectionsContainerRight .group').forEach(el => el.classList.remove('selected'));
                section.classList.add('selected');
                updateThrowButtons();
            }
            
            showContextMenu(e.clientX, e.clientY, 'section');
        });

        setupDragAndDrop(section);

        // Detailed settings functionality
        const settingsBtn = section.querySelector('.detailed-settings-btn');
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent triggering selection
            const advancedModal = document.getElementById('advancedSettingsModal');
            if (advancedModal) {
                window.editingConstellationIndex = getConstellationIndex();
                document.querySelector('.modal-title').textContent = settings.name;
                document.querySelector('.constellation-name-input').value = settings.name;
                
                document.getElementById('pop-inclination').value = settings.inclination;
                document.getElementById('pop-planes').value = settings.planes;
                document.getElementById('pop-sats-per-plane').value = settings.satsPerPlane;
                document.getElementById('pop-apogee').value = settings.apogee;
                document.getElementById('pop-perigee').value = settings.perigee;
                document.getElementById('pop-beam-quantity').value = settings.beamQuantity;
                document.getElementById('pop-beam-size').value = settings.beamSize;
                
                // Trigger updates if symmetric toggle should change
                const symToggle = document.getElementById('sym-toggle');
                if(symToggle) {
                    symToggle.checked = (settings.apogee === settings.perigee);
                    const event = new Event('change');
                    symToggle.dispatchEvent(event);
                }

                advancedModal.style.display = 'flex';
            }
        });

        // Opacity Sliders Logic
        function updateSliderVisuals(sliderWrapper, val, maxVal) {
            const percentage = val / maxVal;
            const blueBlock = sliderWrapper.querySelector('.block-blue');
            const grayBlock = sliderWrapper.querySelector('.block-gray');
            const valueDisplay = sliderWrapper.querySelector('.value-display');
            if(blueBlock) blueBlock.style.width = (percentage * 100) + '%';
            if(grayBlock) grayBlock.style.width = ((1 - percentage) * 100) + '%';
            if(valueDisplay) valueDisplay.textContent = val.toFixed(2);
        }

        const orbitSliderWrapper = section.querySelectorAll('.slider-track-wrapper')[0];
        const orbitSlider = orbitSliderWrapper.querySelector('.opacity-orbit');
        orbitSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            updateSliderVisuals(orbitSliderWrapper, val, parseFloat(orbitSlider.max));
            if (window.orbitManager) {
                const c = section.constellationObj;
                if (c) {
                    if (c.satPoints) c.satPoints.material.opacity = val;
                    if (c.orbitGroup) {
                        c.orbitGroup.children.forEach(line => line.material.opacity = val * 0.2);
                    }
                }
            }
        });
        updateSliderVisuals(orbitSliderWrapper, parseFloat(orbitSlider.value), parseFloat(orbitSlider.max));

        const beamSliderWrapper = section.querySelectorAll('.slider-track-wrapper')[1];
        const beamSlider = beamSliderWrapper.querySelector('.opacity-beam');
        beamSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            updateSliderVisuals(beamSliderWrapper, val, parseFloat(beamSlider.max));
            if (window.orbitManager) {
                const c = section.constellationObj;
                if (c && c.beamMesh) {
                    c.beamMesh.material.opacity = val;
                }
            }
        });
        updateSliderVisuals(beamSliderWrapper, parseFloat(beamSlider.value), parseFloat(beamSlider.max));
    }
    window.addConstellationToList = addConstellationToList;
    /* -----------------------------------------
       Time Control Logic
       ----------------------------------------- */
    const slowerBtn = document.getElementById('slower-btn');
    const pausePlayBtn = document.getElementById('pause-play-btn');
    const fasterBtn = document.getElementById('faster-btn');
    const utcSyncBtn = document.getElementById('utc-sync-btn');

    if (slowerBtn) {
        slowerBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                window.orbitManager.timeMultiplier = Math.max(0.1, window.orbitManager.timeMultiplier / 2);
                window.orbitManager.syncUTC = false;
                utcSyncBtn.classList.remove('active');
            }
        });
    }

    if (fasterBtn) {
        fasterBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                window.orbitManager.timeMultiplier = Math.min(64, window.orbitManager.timeMultiplier * 2);
                window.orbitManager.syncUTC = false;
                utcSyncBtn.classList.remove('active');
            }
        });
    }

    if (pausePlayBtn) {
        pausePlayBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                window.orbitManager.isPaused = !window.orbitManager.isPaused;
                pausePlayBtn.textContent = window.orbitManager.isPaused ? "▶" : "II";
                pausePlayBtn.classList.toggle('active', window.orbitManager.isPaused);
            }
        });
    }

    if (utcSyncBtn) {
        utcSyncBtn.addEventListener('click', () => {
            if (window.orbitManager) {
                window.orbitManager.syncUTC = true;
                window.orbitManager.timeMultiplier = 1.0;
                window.orbitManager.isPaused = false;
                if (pausePlayBtn) {
                    pausePlayBtn.textContent = "II";
                    pausePlayBtn.classList.remove('active');
                }
                utcSyncBtn.classList.add('active');
            }
        });
    }

    /* -----------------------------------------
       Advanced Settings Modal Logic
       ----------------------------------------- */
    const advancedModal = document.getElementById('advancedSettingsModal');
    const openAdvancedBtns = document.querySelectorAll('#openAdvancedSettings, .trigger-advanced-settings');
    window.editingConstellationIndex = null; // Use window to access in save block

    if (advancedModal) {
        openAdvancedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                window.editingConstellationIndex = null;
                document.querySelector('.modal-title').textContent = "Add Constellation";
                document.querySelector('.constellation-name-input').value = "";
                
                document.getElementById('pop-inclination').value = 53;
                document.getElementById('pop-planes').value = 20;
                document.getElementById('pop-sats-per-plane').value = 22;
                document.getElementById('pop-apogee').value = 550;
                document.getElementById('pop-perigee').value = 550;
                document.getElementById('pop-beam-quantity').value = 24;

                const symToggle = document.getElementById('sym-toggle');
                if(symToggle) {
                    const apo = parseFloat(document.getElementById('pop-apogee').value);
                    const peri = parseFloat(document.getElementById('pop-perigee').value);
                    symToggle.checked = (apo === peri);
                    symToggle.dispatchEvent(new Event('change'));
                }
                
                advancedModal.style.display = 'flex';
            });
        });
    }

    // Close modal if clicking overlay
    if (advancedModal) {
        advancedModal.addEventListener('click', (e) => {
            if (e.target === advancedModal) {
                advancedModal.style.display = 'none';
            }
        });
    }

    // --- ADVANCED MODAL LOGIC ---
    // ─────────────────────────────────────────────────────────────────
        // SYMMETRIC ORBIT TOGGLE
        // ─────────────────────────────────────────────────────────────────
        const symToggle = document.getElementById('sym-toggle');
        const perigeeFields = document.getElementById('perigee-fields');
        const apogeeInput = document.getElementById('pop-apogee');
        const perigeeInput = document.getElementById('pop-perigee');

        function updateSym() {
            const sym = symToggle.checked;
            perigeeFields.classList.toggle('disabled', sym);
            if (sym) {
                // mirror perigee = apogee
                perigeeInput.value = apogeeInput.value;
            }
        }
        symToggle.addEventListener('change', () => { updateSym(); rebuildOrbits(); rebuildBeams(); });
        // Keep perigee in sync while typing apogee in symmetric mode
        apogeeInput.addEventListener('input', () => {
            if (symToggle.checked) perigeeInput.value = apogeeInput.value;
        });
        updateSym(); // init
        // ─────────────────────────────────────────────────────────────────
        // STATION KEEPING TOGGLE
        // ─────────────────────────────────────────────────────────────────
        const skToggle = document.getElementById('sk-toggle');
        const skFields = document.getElementById('sk-fields');
        function updateSK() { skFields.classList.toggle('disabled', !skToggle.checked); }
        skToggle.addEventListener('change', updateSK);
        updateSK();

        // ─────────────────────────────────────────────────────────────────
        // LEFT TAB SWITCHING (Orbit / Payload / Bus)
        // ─────────────────────────────────────────────────────────────────
        document.querySelectorAll('.tab-row .tab:not(.preview-tab-main)').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab-row .tab:not(.preview-tab-main)').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
            });
        });

        // ─────────────────────────────────────────────────────────────────
        // RIGHT TAB SWITCHING (Single Satellite / Orbital View)
        // ─────────────────────────────────────────────────────────────────
        document.querySelectorAll('.preview-tab-main').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.preview-tab-main').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.preview-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const id = 'pview-' + tab.dataset.preview;
                document.getElementById(id).classList.add('active');
                activePreview = tab.dataset.preview;
                if (activePreview === 'orbital' && !orbInit) {
                    setTimeout(() => { initOrbScene(); resizeOrb(); }, 30);
                } else if (activePreview === 'satellite') {
                    resizeSat();
                } else {
                    resizeOrb();
                }
            });
        });

        // ─────────────────────────────────────────────────────────────────
        // SHARED CONSTANTS
        // ─────────────────────────────────────────────────────────────────
        const D = Math.PI / 180;
        const ER_KM = 6371;
        const SC = 0.01;          // scene units per km
        const ER = ER_KM * SC;    // earth radius in scene units
        const MXB = 256;           // max beams
        const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
        const PLANE_COLS = [0xcce971, 0xffcc00, 0xff6b6b, 0x00eeff, 0xaa88ff, 0xff9944, 0x44ffaa, 0xff88cc];

        let activePreview = 'satellite';

        // ─────────────────────────────────────────────────────────────────
        // READ FORM PARAMS
        // ─────────────────────────────────────────────────────────────────
        function fv(id, def) {
            const el = document.getElementById(id);
            return el ? (parseFloat(el.value) || def) : def;
        }
        function fi(id, def) { return Math.max(1, Math.round(fv(id, def))); }
        function getP() {
            return {
                inc: fv('pop-inclination', 53),
                planes: fi('pop-planes', 20),
                sats: fi('pop-sats-per-plane', 22),
                apogee: fv('pop-apogee', 550),
                perigee: fv('pop-perigee', 550),
                beams: fi('pop-beam-quantity', 24),
                gain: fv('pop-gain', 45),
                beamSize: fv('pop-beam-size', 300),  // physical diameter in km
                raan: fv('pop-raan-spread', 180),
            };
        }
        function meanAlt(p) { return (p.apogee + p.perigee) / 2; }

        // ─────────────────────────────────────────────────────────────────
        // TEXTURE LOADING
        // ─────────────────────────────────────────────────────────────────
        const TL = new THREE.TextureLoader();
        let dayTex = null;

        TL.load('/static/icon/textures/8k_earth_daymap.jpg', tex => {
            dayTex = tex;
            [satEarth, orbEarth].forEach(m => {
                if (!m) return;
                m.material.map = tex;
                m.material.color.setHex(0xaaaaaa);
                m.material.needsUpdate = true;
            });
        });

        function applyTex(mesh) {
            if (!dayTex || !mesh) return;
            mesh.material.map = dayTex;
            mesh.material.color.setHex(0xaaaaaa);
            mesh.material.needsUpdate = true;
        }

        // ─────────────────────────────────────────────────────────────────
        // HELPERS
        // ─────────────────────────────────────────────────────────────────
        function llv(lat, lon, r) {
            const phi = (90 - lat) * D;
            const theta = (lon + 180) * D;
            return new THREE.Vector3(
                -(r * Math.sin(phi) * Math.cos(theta)),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
        }
        // beamHalfAngle: physical size takes priority, falls back to gain
        function beamHA(gainDb, beamSizeKm, altKm) {
            if (beamSizeKm > 0 && altKm > 0) return Math.atan((beamSizeKm / 2) / altKm);
            return Math.sqrt(26000 / Math.pow(10, gainDb / 10)) * D;
        }
        function makeStars(n, spread) {
            const g = new THREE.BufferGeometry();
            const v = new Float32Array(n * 3);
            for (let i = 0; i < v.length; i++) v[i] = (Math.random() - 0.5) * spread;
            g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
            return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6 }));
        }
        function makeEarth(segments) {
            return new THREE.Mesh(
                new THREE.SphereGeometry(ER, segments, segments),
                new THREE.MeshPhongMaterial({ color: 0x1a3a5c, emissive: 0x000408, shininess: 6 })
            );
        }
        function makeAtmo(opacity) {
            return new THREE.Mesh(
                new THREE.SphereGeometry(ER * 1.014, 40, 40),
                new THREE.MeshBasicMaterial({ color: 0x3366cc, transparent: true, opacity, side: THREE.BackSide })
            );
        }

        // ─────────────────────────────────────────────────────────────────
        // ── SATELLITE BEAM PREVIEW ────────────────────────────────────────
        // ─────────────────────────────────────────────────────────────────
        let satScene, satCam, satRenderer, satCtrl, satEarth, satModel, satBeamIM, satFpIM;
        const bDum = new THREE.Object3D(), fpDum = new THREE.Object3D();

        function initSatScene() {
            const canvas = document.getElementById('canvas-satellite');
            const W = canvas.parentElement.clientWidth || 380;
            const H = canvas.parentElement.clientHeight || 370;

            satScene = new THREE.Scene();
            satCam = new THREE.PerspectiveCamera(42, W / H, 0.01, 3000);
            satRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            satRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
            satRenderer.setSize(W, H);
            satRenderer.setClearColor(0x050810);

            satCtrl = new THREE.OrbitControls(satCam, canvas);
            satCtrl.enablePan = false;
            satCtrl.minDistance = 0.08;   // close enough to inspect satellite model
            satCtrl.maxDistance = ER * 12;

            // Lighting
            satScene.add(new THREE.AmbientLight(0x202030, 1.4));
            const sun = new THREE.DirectionalLight(0xfff5e8, 1.7);
            sun.position.set(150, 60, 80); satScene.add(sun);

            // Scene objects
            satScene.add(makeStars(4000, 2500));
            satEarth = makeEarth(64); satScene.add(satEarth); applyTex(satEarth);
            satScene.add(makeAtmo(0.055));

            // Satellite model
            satModel = new THREE.Group();
            satModel.add(new THREE.Mesh(
                new THREE.BoxGeometry(0.18, 0.05, 0.1),
                new THREE.MeshPhongMaterial({ color: 0xd0d0d0, emissive: 0x181818 })
            ));
            const panM = new THREE.MeshPhongMaterial({ color: 0x1a3888, emissive: 0x0a1633 });
            [-0.28, 0.28].forEach(x => {
                const p = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.008, 0.09), panM);
                p.position.x = x; satModel.add(p);
            });
            satScene.add(satModel);

            // Instanced beam cones
            const bGeo = new THREE.ConeGeometry(1, 1, 16, 1, true);
            bGeo.translate(0, -0.5, 0); bGeo.rotateX(-Math.PI / 2);
            satBeamIM = new THREE.InstancedMesh(bGeo, new THREE.MeshBasicMaterial({
                color: 0x33aaff, transparent: true, opacity: 0.055,
                side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
            }), MXB);
            satBeamIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            satScene.add(satBeamIM);

            // Instanced ground footprints
            satFpIM = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({
                color: 0x1155bb, transparent: true, opacity: 0.15,
                side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
            }), MXB);
            satFpIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            satScene.add(satFpIM);

            rebuildBeams();
        }

        function rebuildBeams() {
            if (!satScene) return;
            const p = getP();
            const alt = meanAlt(p);
            const satPos = llv(40, -100, ER + alt * SC);

            satModel.position.copy(satPos);
            satModel.lookAt(0, 0, 0);

            // ── Camera: orbit TARGET is the satellite itself ──
            // Place camera offset slightly above+behind in the sat's local "up" direction
            const satDir = satPos.clone().normalize();            // radial unit vector
            // pick a perpendicular "behind" direction in the orbit plane
            const sideDir = new THREE.Vector3(0, 1, 0).cross(satDir).normalize();
            const camPos = satPos.clone()
                .addScaledVector(satDir, 0.6)   // a little further out radially
                .addScaledVector(sideDir, 0.4)   // offset to the side so beams are visible
                .add(new THREE.Vector3(0, 0.25, 0));

            satCam.position.copy(camPos);
            satCtrl.target.copy(satPos);       // ← orbit AROUND the satellite
            satCtrl.update();

            // ── Beam grid ──
            const ha = beamHA(p.gain, p.beamSize, alt);  // physical half-angle
            const sp = ha * 2 * 0.88;                     // spacing with ~12% overlap
            const rH = sp * Math.sqrt(3) / 2;
            const maxA = 35 * D;
            const rings = Math.ceil(maxA / sp) + 2;
            const hexPts = [];
            for (let row = -rings; row <= rings; row++) {
                const y = row * rH;
                const xO = (row & 1) ? sp / 2 : 0;
                for (let col = -(rings + 1); col <= (rings + 1); col++) {
                    const x = col * sp + xO;
                    const r = Math.hypot(x, y);
                    if (r <= maxA) hexPts.push({ x, y, r });
                }
            }
            hexPts.sort((a, b) => a.r - b.r);

            const up = satPos.clone().normalize();
            let east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
            if (east.length() < 0.01) east.set(1, 0, 0).cross(up).normalize();
            const north = up.clone().cross(east).normalize();

            // Colour each beam individually (golden-angle hue distribution, same as orbit_v2)
            let bi = 0;
            const nActual = Math.min(p.beams, MXB, hexPts.length);
            for (let i = 0; i < nActual; i++) {
                const hp = hexPts[i];
                const az = Math.atan2(hp.x, hp.y);
                const sinO = Math.sin(hp.r), cosO = Math.cos(hp.r);
                const dir = new THREE.Vector3()
                    .addScaledVector(up, -cosO)
                    .addScaledVector(north, sinO * Math.cos(az))
                    .addScaledVector(east, sinO * Math.sin(az))
                    .normalize();

                const oc = satPos.dot(dir);
                const det = oc * oc - (satPos.lengthSq() - ER * ER);
                if (det < 0) continue;
                const t = -oc - Math.sqrt(det);
                if (t < 0) continue;

                const gPt = satPos.clone().addScaledVector(dir, t);
                // cone base radius at ground = tan(ha) * slant distance
                const cR = Math.tan(ha) * t;

                // Per-beam colour — golden angle hue steps, same pattern as orbit_v2.js
                const hue = (i * 137.508) % 360;
                const col = new THREE.Color().setHSL(hue / 360, 0.85, 0.58);
                const fpCol = new THREE.Color().setHSL(hue / 360, 0.85, 0.38);

                bDum.position.copy(satPos); bDum.lookAt(gPt);
                bDum.scale.set(cR, cR, t); bDum.updateMatrix();
                satBeamIM.setMatrixAt(bi, bDum.matrix);
                satBeamIM.setColorAt(bi, col);

                const gN = gPt.clone().normalize();
                fpDum.position.copy(gPt.clone().addScaledVector(gN, 0.012));
                fpDum.lookAt(fpDum.position.clone().add(gN));
                fpDum.scale.set(cR, cR, 1); fpDum.updateMatrix();
                satFpIM.setMatrixAt(bi, fpDum.matrix);
                satFpIM.setColorAt(bi, fpCol);

                bi++;
            }
            for (let i = bi; i < MXB; i++) {
                satBeamIM.setMatrixAt(i, HIDE);
                satFpIM.setMatrixAt(i, HIDE);
            }
            satBeamIM.instanceMatrix.needsUpdate = true;
            satFpIM.instanceMatrix.needsUpdate = true;
            if (satBeamIM.instanceColor) satBeamIM.instanceColor.needsUpdate = true;
            if (satFpIM.instanceColor) satFpIM.instanceColor.needsUpdate = true;
        }

        function resizeSat() {
            if (!satRenderer) return;
            const c = document.getElementById('canvas-satellite');
            const W = c.parentElement.clientWidth;
            const H = c.parentElement.clientHeight;
            if (!W || !H) return;
            satCam.aspect = W / H; satCam.updateProjectionMatrix();
            satRenderer.setSize(W, H);
        }

        // ─────────────────────────────────────────────────────────────────
        // ── ORBITAL VIEW ─────────────────────────────────────────────────
        // ─────────────────────────────────────────────────────────────────
        let orbScene, orbCam, orbRenderer, orbCtrl, orbEarth, orbPlaneGroups = [], orbSatDots;
        let orbInit = false;
        let earthAngle = 0;

        function initOrbScene() {
            orbInit = true;
            const canvas = document.getElementById('canvas-orbital');
            const W = canvas.parentElement.clientWidth || 380;
            const H = canvas.parentElement.clientHeight || 370;

            orbScene = new THREE.Scene();
            orbCam = new THREE.PerspectiveCamera(38, W / H, 0.1, 3000);
            orbCam.position.set(0, ER * 4.2, ER * 3.8);

            orbRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            orbRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
            orbRenderer.setSize(W, H);
            orbRenderer.setClearColor(0x040609);

            orbCtrl = new THREE.OrbitControls(orbCam, canvas);
            orbCtrl.enablePan = false;
            orbCtrl.minDistance = ER * 1.3;
            orbCtrl.maxDistance = ER * 24;
            orbCtrl.target.set(0, 0, 0); orbCtrl.update();

            // Lights
            orbScene.add(new THREE.AmbientLight(0x1a1a2e, 1.1));
            const sun = new THREE.DirectionalLight(0xfff8f0, 1.4);
            sun.position.set(250, 80, 120); orbScene.add(sun);

            // Scene objects
            orbScene.add(makeStars(6000, 3000));
            orbEarth = makeEarth(72); orbScene.add(orbEarth); applyTex(orbEarth);
            orbScene.add(makeAtmo(0.04));

            // Equator reference line
            const eqPts = [];
            for (let a = 0; a <= 360; a += 3) eqPts.push(new THREE.Vector3(Math.cos(a * D) * ER, 0, Math.sin(a * D) * ER));
            orbScene.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(eqPts),
                new THREE.LineBasicMaterial({ color: 0x223344, transparent: true, opacity: 0.4 })
            ));

            rebuildOrbits();
        }

        function rebuildOrbits() {
            if (!orbScene) return;
            const p = getP();
            const alt = meanAlt(p);
            const orbitR = ER + alt * SC;
            const inc = p.inc * D;
            const nP = Math.min(p.planes, 60);
            const nS = Math.min(p.sats, 150);

            // Clear previous orbit objects
            orbPlaneGroups.forEach(g => orbScene.remove(g));
            orbPlaneGroups = [];
            if (orbSatDots) { orbScene.remove(orbSatDots); orbSatDots = null; }

            // Build orbit ring points template (XZ plane)
            const ringPtsTemplate = [];
            for (let a = 0; a <= 360; a += 2) {
                ringPtsTemplate.push(new THREE.Vector3(Math.cos(a * D) * orbitR, 0, Math.sin(a * D) * orbitR));
            }

            const allSatPos = [];

            for (let pi = 0; pi < nP; pi++) {
                // Walker delta: RAAN distributed evenly over full 360°
                const raan = nP > 1 ? (pi / nP) * 2 * Math.PI : 0;
                const hex = PLANE_COLS[pi % PLANE_COLS.length];

                const grp = new THREE.Group();
                grp.rotation.order = 'YXZ';
                grp.rotation.y = raan;
                grp.rotation.x = inc;

                // Orbit ring line
                grp.add(new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(ringPtsTemplate),
                    new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.6 })
                ));

                orbScene.add(grp);
                orbPlaneGroups.push(grp);

                // Satellite positions — Walker phasing offset between planes
                const phaseOff = (pi / nP) * (2 * Math.PI / nS);
                for (let si = 0; si < nS; si++) {
                    const theta = (si / nS) * 2 * Math.PI + phaseOff;
                    const localPos = new THREE.Vector3(Math.cos(theta) * orbitR, 0, Math.sin(theta) * orbitR);
                    // Apply same YXZ euler as the group: matrix = Ry(raan) * Rx(inc)
                    localPos.applyEuler(new THREE.Euler(inc, raan, 0, 'YXZ'));
                    allSatPos.push(localPos);
                }
            }

            // Satellite dots as a single Points object (efficient for large constellations)
            const posArr = new Float32Array(allSatPos.length * 3);
            allSatPos.forEach((v, i) => { posArr[i * 3] = v.x; posArr[i * 3 + 1] = v.y; posArr[i * 3 + 2] = v.z; });
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
            orbSatDots = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, sizeAttenuation: true }));
            orbScene.add(orbSatDots);
        }

        function resizeOrb() {
            if (!orbRenderer) return;
            const c = document.getElementById('canvas-orbital');
            const W = c.parentElement.clientWidth;
            const H = c.parentElement.clientHeight;
            if (!W || !H) return;
            orbCam.aspect = W / H; orbCam.updateProjectionMatrix();
            orbRenderer.setSize(W, H);
        }

        // ─────────────────────────────────────────────────────────────────
        // ANIMATION LOOP
        // ─────────────────────────────────────────────────────────────────
        function animate() {
            requestAnimationFrame(animate);
            earthAngle += 0.00025;

            if (activePreview === 'satellite' && satRenderer) {
                satEarth.rotation.y = earthAngle;
                satCtrl.update();
                satRenderer.render(satScene, satCam);
            }
            if (activePreview === 'orbital' && orbRenderer) {
                orbEarth.rotation.y = earthAngle;
                orbCtrl.update();
                orbRenderer.render(orbScene, orbCam);
            }
        }

        // ─────────────────────────────────────────────────────────────────
        // REACTIVE INPUT LISTENERS
        // ─────────────────────────────────────────────────────────────────
        ['pop-inclination', 'pop-planes', 'pop-sats-per-plane', 'pop-apogee', 'pop-perigee', 'pop-raan-spread'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', rebuildOrbits);
        });
        ['pop-beam-quantity', 'pop-gain', 'pop-apogee', 'pop-perigee', 'pop-beam-size'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', rebuildBeams);
        });

        // ─────────────────────────────────────────────────────────────────
        // RESIZE OBSERVER
        // ─────────────────────────────────────────────────────────────────
        const ro = new ResizeObserver(() => { resizeSat(); resizeOrb(); });
        ro.observe(document.getElementById('pview-satellite'));
        ro.observe(document.getElementById('pview-orbital'));

        // ─────────────────────────────────────────────────────────────────
        // INIT
        // ─────────────────────────────────────────────────────────────────
        setTimeout(() => {
            initSatScene();
            animate();
        }, 80);
    
    // --- INTEGRATED ADVANCED SAVE LOGIC ---
    const advancedSaveBtn = document.getElementById('advancedSaveBtn');
    if (advancedSaveBtn) {
        advancedSaveBtn.addEventListener('click', () => {
            const advData = {
                name: document.querySelector('.constellation-name-input').value || 'Untitled',
                orbit: {
                    inclination: document.getElementById('pop-inclination').value || 53,
                    orbital_planes: document.getElementById('pop-planes').value || 20,
                    sats_per_plane: document.getElementById('pop-sats-per-plane').value || 22,
                    apogee: document.getElementById('pop-apogee').value || 550,
                    perigee: document.getElementById('pop-perigee').value || 550,
                    raan_spread: document.getElementById('pop-raan-spread').value || 15
                },
                payload: {
                    beam_quantity: document.getElementById('pop-beam-quantity').value || 24,
                    beam_size: document.getElementById('pop-beam-size').value || 300
                }
            };
            
            const settings = {
                name: advData.name,
                inclination: parseFloat(advData.orbit.inclination),
                planes: parseInt(advData.orbit.orbital_planes),
                satsPerPlane: parseInt(advData.orbit.sats_per_plane),
                apogee: parseFloat(advData.orbit.apogee),
                perigee: parseFloat(advData.orbit.perigee),
                beamQuantity: parseInt(advData.payload.beam_quantity),
                beamSize: parseFloat(advData.payload.beam_size),
                advanced: advData
            };

            // Commit configuration to the current project
            if (window.editingConstellationIndex !== null && window.orbitManager) {
                const c = window.orbitManager.constellations[window.editingConstellationIndex];
                c.settings = Object.assign(c.settings, settings);
                if (window.orbitManager.scene) {
                    window.orbitManager.scene.remove(c.satPoints);
                    window.orbitManager.scene.remove(c.orbitGroup);
                    window.orbitManager.scene.remove(c.beamMesh);
                }
                c.init3D();
                
                // Update ONLY the corresponding DOM element
                const allSections = getAllSections();
                const section = allSections[window.editingConstellationIndex];
                if (section) {
                    section.querySelector('.section-header h3').textContent = settings.name;
                    const values = section.querySelectorAll('.form-value');
                    values[0].textContent = settings.satsPerPlane * settings.planes;
                    values[1].textContent = settings.planes;
                    values[2].textContent = settings.inclination;
                    values[3].textContent = settings.apogee + '/' + settings.perigee + ' km';
                }
            } else {
                if (window.orbitManager) {
                    const constellation = window.orbitManager.addConstellation(settings);
                    addConstellationToList(settings, constellation);
                }
            }

            if (window.SessionManager) {
                window.SessionManager.autoSave();
            }

            const modal = document.getElementById('advancedSettingsModal');
            if (modal) modal.style.display = 'none';
        });
    }

    const cancelBtn = document.querySelector('.btn-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const modal = document.getElementById('advancedSettingsModal');
            if (modal) modal.style.display = 'none';
        });
    }


});
