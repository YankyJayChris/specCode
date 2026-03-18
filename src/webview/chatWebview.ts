import * as vscode from 'vscode';
import * as path from 'path';
import { SpecManager } from '../specs/specManager';
import { AgentEngine } from '../agent/agentEngine';
import { LLMManager } from '../llm/llmManager';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    mode?: 'spec-driven' | 'vibe';
    images?: string[];
}

export class ChatWebviewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private messages: ChatMessage[] = [];
    private currentMode: 'spec-driven' | 'vibe' = 'spec-driven';
    private currentSpecId?: string;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private specManager: SpecManager,
        private agentEngine: AgentEngine,
        private llmManager: LLMManager
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlContent(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleUserMessage(data.content, data.images);
                    break;
                case 'setMode':
                    this.currentMode = data.mode;
                    break;
                case 'createSpec':
                    await this.handleCreateSpec(data.prompt);
                    break;
                case 'approvePhase':
                    await this.handleApprovePhase(data.specId, data.phase);
                    break;
                case 'regeneratePhase':
                    await this.handleRegeneratePhase(data.specId, data.phase);
                    break;
                case 'executeTask':
                    await this.handleExecuteTask(data.specId, data.taskId);
                    break;
                case 'toggleTaskOptional':
                    await this.handleToggleTaskOptional(data.specId, data.taskId);
                    break;
                case 'loadSpecs':
                    await this.sendSpecsList();
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('specCode.openSettings');
                    break;
                case 'addModel':
                    vscode.commands.executeCommand('specCode.addModel');
                    break;
            }
        });

        // Send initial data
        this.sendSpecsList();
    }

    show() {
        if (this.view) {
            this.view.show();
        } else {
            vscode.commands.executeCommand('specCode.chat.focus');
        }
    }

    private async handleUserMessage(content: string, images?: string[]) {
        // Add user message
        const userMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content,
            timestamp: Date.now(),
            mode: this.currentMode,
            images
        };
        this.messages.push(userMessage);
        this.postMessage('addMessage', userMessage);

        if (this.currentMode === 'spec-driven') {
            await this.handleSpecDrivenMessage(content);
        } else {
            await this.handleVibeMessage(content);
        }
    }

    private async handleSpecDrivenMessage(content: string) {
        // Check if we have an active spec
        if (!this.currentSpecId) {
            // Suggest creating a new spec
            this.postMessage('suggestCreateSpec', { prompt: content });
            return;
        }

        const spec = this.specManager.getSpec(this.currentSpecId);
        if (!spec) return;

        // Handle based on current phase
        switch (spec.phase) {
            case 'requirements':
                if (spec.phaseStatus === 'pending') {
                    // Generate requirements
                    this.postMessage('setTyping', true);
                    try {
                        await this.specManager.generateRequirements(spec.id, content);
                        this.postMessage('requirementsGenerated', { specId: spec.id });
                        await this.sendSpecsList();
                    } catch (error: any) {
                        this.postMessage('error', { message: error.message });
                    }
                    this.postMessage('setTyping', false);
                }
                break;

            case 'design':
                if (spec.phaseStatus === 'pending') {
                    this.postMessage('setTyping', true);
                    try {
                        await this.specManager.generateDesign(spec.id);
                        this.postMessage('designGenerated', { specId: spec.id });
                        await this.sendSpecsList();
                    } catch (error: any) {
                        this.postMessage('error', { message: error.message });
                    }
                    this.postMessage('setTyping', false);
                }
                break;

            case 'tasks':
                if (spec.phaseStatus === 'pending') {
                    this.postMessage('setTyping', true);
                    try {
                        await this.specManager.generateTasks(spec.id);
                        this.postMessage('tasksGenerated', { specId: spec.id });
                        await this.sendSpecsList();
                    } catch (error: any) {
                        this.postMessage('error', { message: error.message });
                    }
                    this.postMessage('setTyping', false);
                }
                break;

            case 'execution':
                // Provide guidance during execution
                const response: ChatMessage = {
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: `I'm executing the implementation plan for "${spec.name}". You can monitor progress in the Specs panel. Let me know if you'd like to make any adjustments!`,
                    timestamp: Date.now()
                };
                this.messages.push(response);
                this.postMessage('addMessage', response);
                break;
        }
    }

    private async handleVibeMessage(content: string) {
        this.postMessage('setTyping', true);

        try {
            const modelId = await this.llmManager.getDefaultModelForPhase('execution');
            
            // Stream the response
            let fullResponse = '';
            await this.llmManager.streamGenerate(modelId, [
                { role: 'user', content }
            ], (chunk) => {
                fullResponse += chunk;
                this.postMessage('updateStreamingMessage', { content: fullResponse });
            });

            const response: ChatMessage = {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: fullResponse,
                timestamp: Date.now()
            };
            this.messages.push(response);
            this.postMessage('addMessage', response);

        } catch (error: any) {
            this.postMessage('error', { message: error.message });
        }

        this.postMessage('setTyping', false);
    }

    private async handleCreateSpec(prompt: string) {
        const name = prompt.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);

        try {
            const spec = await this.specManager.createSpec(name, prompt);
            this.currentSpecId = spec.id;
            this.postMessage('specCreated', { specId: spec.id, name: spec.name });
            await this.sendSpecsList();

            // Start generating requirements
            await this.handleUserMessage(prompt);
        } catch (error: any) {
            this.postMessage('error', { message: error.message });
        }
    }

    private async handleApprovePhase(specId: string, phase: string) {
        try {
            await this.specManager.approvePhase(specId, phase as any);
            this.postMessage('phaseApproved', { specId, phase });
            await this.sendSpecsList();
        } catch (error: any) {
            this.postMessage('error', { message: error.message });
        }
    }

    private async handleRegeneratePhase(specId: string, phase: string) {
        const feedback = await vscode.window.showInputBox({
            prompt: 'What would you like to change?'
        });

        if (feedback) {
            try {
                this.postMessage('setTyping', true);
                await this.specManager.regeneratePhase(specId, phase as any, feedback);
                this.postMessage('phaseRegenerated', { specId, phase });
                await this.sendSpecsList();
            } catch (error: any) {
                this.postMessage('error', { message: error.message });
            }
            this.postMessage('setTyping', false);
        }
    }

    private async handleExecuteTask(specId: string, taskId: string) {
        try {
            await this.agentEngine.executeTask(specId, taskId);
            this.postMessage('taskExecuted', { specId, taskId });
        } catch (error: any) {
            this.postMessage('error', { message: error.message });
        }
    }

    private async handleToggleTaskOptional(specId: string, taskId: string) {
        await this.specManager.toggleTaskOptional(specId, taskId);
        await this.sendSpecsList();
    }

    private async sendSpecsList() {
        const specs = this.specManager.getSpecs();
        this.postMessage('setSpecs', { specs });
    }

    private postMessage(type: string, data?: any) {
        if (this.view) {
            this.view.webview.postMessage({ type, data });
        }
    }

    private getHtmlContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spec-Code Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .title {
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .mode-toggle {
            display: flex;
            gap: 4px;
            background: var(--vscode-input-background);
            padding: 2px;
            border-radius: 4px;
        }

        .mode-btn {
            padding: 4px 12px;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
        }

        .mode-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .message {
            margin-bottom: 16px;
            animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }

        .message-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }

        .message-avatar.user {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .message-avatar.assistant {
            background: var(--vscode-symbolIcon-colorForeground);
            color: var(--vscode-editor-background);
        }

        .message-sender {
            font-weight: 600;
            font-size: 13px;
        }

        .message-time {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .message-content {
            padding-left: 32px;
            line-height: 1.6;
        }

        .message-content pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
        }

        .message-content code {
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
        }

        .input-container {
            padding: 12px 16px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .input-wrapper {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }

        .message-input {
            flex: 1;
            min-height: 44px;
            max-height: 200px;
            padding: 10px 14px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 8px;
            resize: none;
            font-family: inherit;
            font-size: inherit;
            line-height: 1.5;
        }

        .message-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .send-btn {
            width: 44px;
            height: 44px;
            border: none;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .send-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 12px 16px;
            align-items: center;
        }

        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: var(--vscode-descriptionForeground);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        .suggestion-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 16px;
            margin: 8px 0;
        }

        .suggestion-card h4 {
            margin-bottom: 8px;
        }

        .suggestion-card p {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
        }

        .suggestion-actions {
            display: flex;
            gap: 8px;
        }

        .btn {
            padding: 6px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }

        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .specs-list {
            margin: 8px 0;
        }

        .spec-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
        }

        .spec-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .spec-item.active {
            background: var(--vscode-list-activeSelectionBackground);
        }

        .phase-indicator {
            display: flex;
            gap: 4px;
            margin-top: 4px;
        }

        .phase-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-descriptionForeground);
        }

        .phase-dot.completed {
            background: var(--vscode-testing-iconPassed);
        }

        .phase-dot.current {
            background: var(--vscode-progressBar-background);
        }

        .verification-bar {
            display: flex;
            gap: 8px;
            padding: 12px 16px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-top: 1px solid var(--vscode-panel-border);
        }

        .welcome-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            padding: 32px;
        }

        .welcome-screen h2 {
            margin-bottom: 16px;
        }

        .welcome-screen p {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 24px;
        }

        .quick-actions {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <span>👻</span>
            <span>Spec-Code</span>
        </div>
        <div class="mode-toggle">
            <button class="mode-btn active" data-mode="spec-driven">Spec-Driven</button>
            <button class="mode-btn" data-mode="vibe">Vibe</button>
        </div>
    </div>

    <div class="chat-container" id="chatContainer">
        <div class="welcome-screen" id="welcomeScreen">
            <h2>Welcome to Spec-Code</h2>
            <p>Turn any prompt into production-ready, verifiable code using AI-powered spec-driven development.</p>
            <div class="quick-actions">
                <button class="btn btn-primary" onclick="createNewSpec()">New Spec</button>
                <button class="btn btn-secondary" onclick="openSettings()">Add Model</button>
            </div>
        </div>
    </div>

    <div class="typing-indicator" id="typingIndicator" style="display: none;">
        <span></span>
        <span></span>
        <span></span>
    </div>

    <div class="input-container">
        <div class="input-wrapper">
            <textarea 
                class="message-input" 
                id="messageInput" 
                placeholder="Describe what you want to build..."
                rows="1"
            ></textarea>
            <button class="send-btn" id="sendBtn" onclick="sendMessage()">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 8a.5.5 0 0 1 .5-.5h10.793L8.146 3.854a.5.5 0 1 1 .708-.708l5 5a.5.5 0 0 1 0 .708l-5 5a.5.5 0 0 1-.708-.708L12.793 8.5H2a.5.5 0 0 1-.5-.5z"/>
                </svg>
            </button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentMode = 'spec-driven';
        let currentSpecId = null;
        let streamingMessageId = null;

        // Mode toggle
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
                vscode.postMessage({ type: 'setMode', mode: currentMode });
            });
        });

        // Auto-resize textarea
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
        });

        // Send on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        function sendMessage() {
            const content = messageInput.value.trim();
            if (!content) return;

            vscode.postMessage({ type: 'sendMessage', content });
            messageInput.value = '';
            messageInput.style.height = 'auto';
            
            // Hide welcome screen
            document.getElementById('welcomeScreen').style.display = 'none';
        }

        function createNewSpec() {
            const prompt = messageInput.value.trim() || 'New Feature';
            vscode.postMessage({ type: 'createSpec', prompt });
            document.getElementById('welcomeScreen').style.display = 'none';
        }

        function openSettings() {
            vscode.postMessage({ type: 'openSettings' });
        }

        function addMessage(message) {
            const container = document.getElementById('chatContainer');
            
            const messageEl = document.createElement('div');
            messageEl.className = 'message';
            messageEl.id = message.id;
            
            const avatar = message.role === 'user' ? '👤' : '👻';
            const sender = message.role === 'user' ? 'You' : 'Spec-Code';
            const time = new Date(message.timestamp).toLocaleTimeString();
            
            messageEl.innerHTML = \`
                <div class="message-header">
                    <div class="message-avatar \${message.role}">\${avatar}</div>
                    <span class="message-sender">\${sender}</span>
                    <span class="message-time">\${time}</span>
                </div>
                <div class="message-content">\${formatContent(message.content)}</div>
            \`;
            
            container.appendChild(messageEl);
            container.scrollTop = container.scrollHeight;
        }

        function formatContent(content) {
            // Simple markdown formatting
            return content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\`\`\`([\s\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        }

        function updateStreamingMessage(data) {
            if (streamingMessageId) {
                const messageEl = document.getElementById(streamingMessageId);
                if (messageEl) {
                    messageEl.querySelector('.message-content').innerHTML = formatContent(data.content);
                }
            }
        }

        function setTyping(typing) {
            document.getElementById('typingIndicator').style.display = typing ? 'flex' : 'none';
        }

        function suggestCreateSpec(data) {
            const container = document.getElementById('chatContainer');
            
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.innerHTML = \`
                <h4>🚀 Start Spec-Driven Development</h4>
                <p>"\${data.prompt.substring(0, 100)}..."</p>
                <div class="suggestion-actions">
                    <button class="btn btn-primary" onclick="createNewSpecFromPrompt('\${data.prompt.replace(/'/g, "\\'")}')">Create Spec</button>
                    <button class="btn btn-secondary" onclick="continueVibe()">Continue in Vibe Mode</button>
                </div>
            \`;
            
            container.appendChild(card);
            container.scrollTop = container.scrollHeight;
        }

        function createNewSpecFromPrompt(prompt) {
            vscode.postMessage({ type: 'createSpec', prompt });
        }

        function continueVibe() {
            document.querySelector('[data-mode="vibe"]').click();
        }

        function showSpecsList(specs) {
            const container = document.getElementById('chatContainer');
            
            const specsEl = document.createElement('div');
            specsEl.className = 'specs-list';
            
            specs.forEach(spec => {
                const specEl = document.createElement('div');
                specEl.className = 'spec-item' + (spec.id === currentSpecId ? ' active' : '');
                specEl.onclick = () => selectSpec(spec.id);
                
                const phases = ['requirements', 'design', 'tasks', 'execution'];
                const phaseDots = phases.map(p => {
                    const isCompleted = spec.files[p] || (spec.phase === p && spec.phaseStatus === 'approved');
                    const isCurrent = spec.phase === p && !isCompleted;
                    return \`<span class="phase-dot \${isCompleted ? 'completed' : ''} \${isCurrent ? 'current' : ''}"></span>\`;
                }).join('');
                
                specEl.innerHTML = \`
                    <span>📋</span>
                    <div>
                        <div>\${spec.name}</div>
                        <div class="phase-indicator">\${phaseDots}</div>
                    </div>
                \`;
                
                specsEl.appendChild(specEl);
            });
            
            container.appendChild(specsEl);
            container.scrollTop = container.scrollHeight;
        }

        function selectSpec(specId) {
            currentSpecId = specId;
            vscode.postMessage({ type: 'selectSpec', specId });
        }

        // Message handler
        window.addEventListener('message', event => {
            const { type, data } = event.data;
            
            switch (type) {
                case 'addMessage':
                    addMessage(data);
                    break;
                case 'updateStreamingMessage':
                    updateStreamingMessage(data);
                    break;
                case 'setTyping':
                    setTyping(data);
                    break;
                case 'suggestCreateSpec':
                    suggestCreateSpec(data);
                    break;
                case 'setSpecs':
                    showSpecsList(data.specs);
                    break;
                case 'specCreated':
                    currentSpecId = data.specId;
                    addMessage({
                        id: 'system-' + Date.now(),
                        role: 'assistant',
                        content: \`Created spec "\${data.name}". Starting Phase 1: Requirements...\`,
                        timestamp: Date.now()
                    });
                    break;
                case 'requirementsGenerated':
                    addMessage({
                        id: 'system-' + Date.now(),
                        role: 'assistant',
                        content: \`✅ Requirements generated! Please review the requirements.md file and click **Approve** to proceed to Design phase, or provide feedback to regenerate.\`,
                        timestamp: Date.now()
                    });
                    break;
                case 'designGenerated':
                    addMessage({
                        id: 'system-' + Date.now(),
                        role: 'assistant',
                        content: \`✅ Design generated! Please review the design.md file and click **Approve** to proceed to Implementation Planning.\`,
                        timestamp: Date.now()
                    });
                    break;
                case 'tasksGenerated':
                    addMessage({
                        id: 'system-' + Date.now(),
                        role: 'assistant',
                        content: \`✅ Implementation plan generated! Review the tasks.md file and click **Execute** to start implementation.\`,
                        timestamp: Date.now()
                    });
                    break;
                case 'error':
                    addMessage({
                        id: 'error-' + Date.now(),
                        role: 'assistant',
                        content: \`❌ Error: \${data.message}\`,
                        timestamp: Date.now()
                    });
                    break;
            }
        });

        // Load specs on init
        vscode.postMessage({ type: 'loadSpecs' });
    </script>
</body>
</html>`;
    }
}
