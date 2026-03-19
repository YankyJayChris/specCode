// HTML content for Provider Setup Webview
export const getProviderSetupHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Provider Setup</title>
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
            padding: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }

        .title {
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .toolbar {
            display: flex;
            gap: 8px;
        }

        .btn {
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .section {
            margin-bottom: 32px;
        }

        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .provider-list {
            margin-bottom: 24px;
        }

        .provider-item {
            display: flex;
            align-items: center;
            padding: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            margin-bottom: 8px;
            background: var(--vscode-input-background);
            transition: all 0.2s;
        }

        .provider-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .provider-item.active {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground);
        }

        .provider-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .provider-name {
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .provider-details {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .provider-metrics {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        }

        .metric-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .uptime-bar {
            width: 40px;
            height: 4px;
            background: var(--vscode-panel-border);
            border-radius: 2px;
            overflow: hidden;
        }

        .uptime-fill {
            height: 100%;
            background: var(--vscode-testing-iconPassed);
            transition: width 0.3s ease;
        }

        .uptime-fill.warning {
            background: var(--vscode-testing-iconQueued);
        }

        .uptime-fill.error {
            background: var(--vscode-testing-iconFailed);
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }
        .status-online { background: var(--vscode-testing-iconPassed); }
        .status-offline { background: var(--vscode-descriptionForeground); }
        .status-error { background: var(--vscode-testing-iconFailed); }
        .status-testing { background: var(--vscode-progressBar-background); animation: pulse 1s infinite; }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .provider-actions {
            display: flex;
            gap: 4px;
        }

        .action-btn {
            padding: 4px 8px;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-radius: 3px;
            font-size: 11px;
            transition: background-color 0.2s;
        }

        .action-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .template-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
        }

        .template-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            background: var(--vscode-input-background);
            cursor: pointer;
            transition: all 0.2s;
        }

        .template-card:hover {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-hoverBackground);
        }

        .template-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .template-name {
            font-weight: 600;
            font-size: 14px;
        }
        .template-provider {
            font-size: 11px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
        }

        .template-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
            line-height: 1.4;
        }

        .form-container {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
            display: none;
        }

        .form-container.active {
            display: block;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            font-size: 13px;
        }

        .form-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-family: inherit;
            font-size: inherit;
        }

        .form-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .form-input[type="password"] {
            font-family: monospace;
        }

        .form-select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border-radius: 4px;
        }
        .form-checkbox {
            margin-right: 8px;
        }

        .form-help {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .form-error {
            color: var(--vscode-inputValidation-errorForeground);
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 8px;
            border-radius: 4px;
            margin-top: 8px;
            font-size: 12px;
        }

        .form-warning {
            color: var(--vscode-inputValidation-warningForeground);
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 8px;
            border-radius: 4px;
            margin-top: 8px;
            font-size: 12px;
        }

        .modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .modal.active {
            display: flex;
        }

        .modal-content {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 24px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .modal-title {
            font-size: 16px;
            font-weight: 600;
        }
        .close-btn {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 18px;
            padding: 4px;
        }

        .empty-state {
            text-align: center;
            padding: 48px 24px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state h3 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .loading {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--vscode-descriptionForeground);
        }

        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-descriptionForeground);
            border-top: 2px solid var(--vscode-progressBar-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .success-message {
            background: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
            padding: 12px;
            border-radius: 4px;
            margin: 8px 0;
        }

        .error-message {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 12px;
            border-radius: 4px;
            margin: 8px 0;
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 16px;
        }

        .tab {
            padding: 8px 16px;
            border: none;
            background: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }

        .tab.active {
            border-bottom-color: var(--vscode-focusBorder);
            color: var(--vscode-focusBorder);
        }
        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .setup-instructions {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            margin: 8px 0;
        }

        .setup-instructions ol {
            margin-left: 16px;
        }

        .setup-instructions li {
            margin-bottom: 4px;
            font-size: 12px;
            line-height: 1.4;
        }

        .phase-selector {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }

        .phase-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            background: var(--vscode-input-background);
        }

        .phase-title {
            font-weight: 600;
            margin-bottom: 8px;
        }

        .phase-provider {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <span>⚙️</span>
            <span>Provider Setup</span>
        </div>
        <div class="toolbar">
            <button class="btn" onclick="discoverProviders()">
                <span>🔍</span> Discover
            </button>
            <button class="btn" onclick="importConfig()">
                <span>📥</span> Import
            </button>
            <button class="btn" onclick="exportConfig()">
                <span>📤</span> Export
            </button>
            <button class="btn btn-primary" onclick="showAddProviderModal()">
                <span>➕</span> Add Provider
            </button>
        </div>
    </div>

    <div class="content">
        <div class="tabs">
            <button class="tab active" onclick="showTab('providers')">Providers</button>
            <button class="tab" onclick="showTab('templates')">Templates</button>
            <button class="tab" onclick="showTab('metrics')">Metrics</button>
            <button class="tab" onclick="showTab('settings')">Settings</button>
        </div>
        <!-- Providers Tab -->
        <div id="providers-tab" class="tab-content active">
            <div class="section">
                <div class="section-title">
                    <span>🤖</span>
                    <span>Configured Providers</span>
                </div>
                <div id="provider-list" class="provider-list">
                    <div class="empty-state">
                        <h3>No providers configured</h3>
                        <p>Add your first AI provider to get started</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Templates Tab -->
        <div id="templates-tab" class="tab-content">
            <div class="section">
                <div class="section-title">
                    <span>📋</span>
                    <span>Provider Templates</span>
                </div>
                <div id="template-grid" class="template-grid">
                    <div class="loading">
                        <div class="spinner"></div>
                        <span>Loading templates...</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Metrics Tab -->
        <div id="metrics-tab" class="tab-content">
            <div class="section">
                <div class="section-title">
                    <span>📊</span>
                    <span>Provider Metrics & Analytics</span>
                    <button class="btn" onclick="refreshMetrics()" style="margin-left: auto;">
                        <span>🔄</span> Refresh
                    </button>
                </div>
                <div id="metrics-list" class="provider-list">
                    <div class="empty-state">
                        <h3>No metrics available</h3>
                        <p>Configure providers to see performance metrics</p>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">
                    <span>🧪</span>
                    <span>Concurrent Testing</span>
                </div>
                <div style="margin-bottom: 16px;">
                    <button class="btn btn-primary" onclick="testAllProviders()">
                        <span>⚡</span> Test All Providers
                    </button>
                    <button class="btn" onclick="testSelectedProviders()">
                        <span>🎯</span> Test Selected
                    </button>
                </div>
                <div id="concurrent-test-results" style="display: none;">
                    <h4>Test Results:</h4>
                    <div id="test-results-list"></div>
                </div>
            </div>
        </div>

        <!-- Settings Tab -->
        <div id="settings-tab" class="tab-content">
            <div class="section">
                <div class="section-title">
                    <span>🎯</span>
                    <span>Active Provider</span>
                </div>
                <div id="active-provider-selector">
                    <select id="active-provider-select" class="form-select">
                        <option value="">Select active provider...</option>
                    </select>
                </div>
            </div>

            <div class="section">
                <div class="section-title">
                    <span>🔄</span>
                    <span>Phase-Specific Providers</span>
                </div>
                <div class="phase-selector">
                    <div class="phase-card">
                        <div class="phase-title">Requirements</div>
                        <select id="requirements-provider" class="form-select">
                            <option value="">Use active provider</option>
                        </select>
                    </div>
                    <div class="phase-card">
                        <div class="phase-title">Design</div>
                        <select id="design-provider" class="form-select">
                            <option value="">Use active provider</option>
                        </select>
                    </div>
                    <div class="phase-card">
                        <div class="phase-title">Execution</div>
                        <select id="execution-provider" class="form-select">
                            <option value="">Use active provider</option>
                        </select>
                    </div>
                    <div class="phase-card">
                        <div class="phase-title">Hooks</div>
                        <select id="hooks-provider" class="form-select">
                            <option value="">Use active provider</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- Add/Edit Provider Modal -->
    <div id="provider-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">Add Provider</div>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <form id="provider-form">
                <div class="form-group">
                    <label class="form-label">Provider Name</label>
                    <input type="text" id="provider-name" class="form-input" required>
                    <div class="form-help">A friendly name for this provider</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Provider Type</label>
                    <select id="provider-type" class="form-select" required onchange="updateProviderForm()">
                        <option value="">Select provider type...</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="openai">OpenAI (GPT)</option>
                        <option value="google">Google (Gemini)</option>
                        <option value="qwen">Qwen (Alibaba)</option>
                        <option value="kimi">Kimi (Moonshot)</option>
                        <option value="xai">xAI (Grok)</option>
                        <option value="ollama">Ollama (Local)</option>
                        <option value="lmstudio">LM Studio (Local)</option>
                        <option value="custom">Custom OpenAI-Compatible</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Model Name</label>
                    <input type="text" id="model-name" class="form-input" required>
                    <div class="form-help">The specific model to use (e.g., claude-3-5-sonnet-20241022)</div>
                </div>

                <div class="form-group" id="api-key-group">
                    <label class="form-label">API Key</label>
                    <input type="password" id="api-key" class="form-input">
                    <div class="form-help">Your API key (stored securely)</div>
                </div>

                <div class="form-group" id="base-url-group" style="display: none;">
                    <label class="form-label">Base URL</label>
                    <input type="url" id="base-url" class="form-input">
                    <div class="form-help">Custom API endpoint URL</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Temperature</label>
                    <input type="number" id="temperature" class="form-input" min="0" max="2" step="0.1" value="0.7">
                    <div class="form-help">Controls randomness (0.0 = deterministic, 2.0 = very random)</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Max Tokens</label>
                    <input type="number" id="max-tokens" class="form-input" min="1" max="100000" value="4096">
                    <div class="form-help">Maximum tokens in the response</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="supports-tools" class="form-checkbox" checked>
                        Supports Function Calling
                    </label>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="supports-vision" class="form-checkbox">
                        Supports Vision/Images
                    </label>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="supports-streaming" class="form-checkbox" checked>
                        Supports Streaming
                    </label>
                </div>

                <div id="setup-instructions" class="setup-instructions" style="display: none;">
                    <h4>Setup Instructions:</h4>
                    <ol id="instructions-list"></ol>
                </div>

                <div id="validation-errors" class="form-error" style="display: none;"></div>
                <div id="validation-warnings" class="form-warning" style="display: none;"></div>

                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px;">
                    <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                    <button type="button" class="btn" onclick="testConnection()" id="test-btn">Test Connection</button>
                    <button type="submit" class="btn btn-primary">Save Provider</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Template Modal -->
    <div id="template-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">Create from Template</div>
                <button class="close-btn" onclick="closeTemplateModal()">&times;</button>
            </div>
            <div id="template-details"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let providers = [];
        let templates = [];
        let activeProviderId = null;
        let editingProviderId = null;

        // Tab management
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.querySelector(\`[onclick="showTab('\${tabName}')"]\`).classList.add('active');
            document.getElementById(\`\${tabName}-tab\`).classList.add('active');
        }
        // Provider management
        function showAddProviderModal() {
            editingProviderId = null;
            document.getElementById('provider-modal').classList.add('active');
            document.querySelector('.modal-title').textContent = 'Add Provider';
            resetProviderForm();
        }

        function editProvider(id) {
            const provider = providers.find(p => p.id === id);
            if (!provider) return;

            editingProviderId = id;
            document.getElementById('provider-modal').classList.add('active');
            document.querySelector('.modal-title').textContent = 'Edit Provider';
            
            // Populate form
            document.getElementById('provider-name').value = provider.name;
            document.getElementById('provider-type').value = provider.provider;
            document.getElementById('model-name').value = provider.modelName;
            document.getElementById('api-key').value = ''; // Don't show existing key
            document.getElementById('base-url').value = provider.baseUrl || '';
            document.getElementById('temperature').value = provider.temperature;
            document.getElementById('max-tokens').value = provider.maxTokens;
            document.getElementById('supports-tools').checked = provider.supportsTools;
            document.getElementById('supports-vision').checked = provider.supportsVision;
            document.getElementById('supports-streaming').checked = provider.supportsStreaming;
            
            updateProviderForm();
        }

        function removeProvider(id) {
            if (confirm('Are you sure you want to remove this provider?')) {
                vscode.postMessage({ type: 'removeProvider', data: { id } });
            }
        }

        function testProvider(id) {
            vscode.postMessage({ type: 'testProvider', data: { id } });
        }

        function setActiveProvider(id) {
            vscode.postMessage({ type: 'setActiveProvider', data: { id } });
        }

        function closeModal() {
            document.getElementById('provider-modal').classList.remove('active');
            resetProviderForm();
        }

        function closeTemplateModal() {
            document.getElementById('template-modal').classList.remove('active');
        }

        function resetProviderForm() {
            document.getElementById('provider-form').reset();
            document.getElementById('temperature').value = '0.7';
            document.getElementById('max-tokens').value = '4096';
            document.getElementById('supports-tools').checked = true;
            document.getElementById('supports-streaming').checked = true;
            document.getElementById('validation-errors').style.display = 'none';
            document.getElementById('validation-warnings').style.display = 'none';
            document.getElementById('setup-instructions').style.display = 'none';
        }
        function updateProviderForm() {
            const providerType = document.getElementById('provider-type').value;
            const apiKeyGroup = document.getElementById('api-key-group');
            const baseUrlGroup = document.getElementById('base-url-group');
            const instructionsDiv = document.getElementById('setup-instructions');
            
            // Show/hide fields based on provider type
            if (['ollama', 'lmstudio'].includes(providerType)) {
                apiKeyGroup.style.display = 'none';
                baseUrlGroup.style.display = 'block';
            } else if (providerType === 'custom') {
                apiKeyGroup.style.display = 'block';
                baseUrlGroup.style.display = 'block';
            } else {
                apiKeyGroup.style.display = 'block';
                baseUrlGroup.style.display = 'none';
            }

            // Show setup instructions for the selected provider
            const template = templates.find(t => t.provider === providerType);
            if (template && template.setupInstructions.length > 0) {
                instructionsDiv.style.display = 'block';
                const instructionsList = document.getElementById('instructions-list');
                instructionsList.innerHTML = template.setupInstructions
                    .map(instruction => \`<li>\${instruction}</li>\`)
                    .join('');
            } else {
                instructionsDiv.style.display = 'none';
            }
        }

        function testConnection() {
            const formData = getFormData();
            if (!formData.provider || !formData.modelName) {
                showError('Please fill in provider type and model name first');
                return;
            }

            const testBtn = document.getElementById('test-btn');
            testBtn.textContent = 'Testing...';
            testBtn.disabled = true;

            // Create temporary provider for testing
            const tempId = 'temp-test-' + Date.now();
            vscode.postMessage({ 
                type: 'addProvider', 
                data: { ...formData, id: tempId } 
            });
            
            setTimeout(() => {
                vscode.postMessage({ type: 'testProvider', data: { id: tempId } });
            }, 500);
        }

        function getFormData() {
            return {
                name: document.getElementById('provider-name').value,
                provider: document.getElementById('provider-type').value,
                modelName: document.getElementById('model-name').value,
                apiKey: document.getElementById('api-key').value,
                baseUrl: document.getElementById('base-url').value,
                temperature: parseFloat(document.getElementById('temperature').value),
                maxTokens: parseInt(document.getElementById('max-tokens').value),
                supportsTools: document.getElementById('supports-tools').checked,
                supportsVision: document.getElementById('supports-vision').checked,
                supportsStreaming: document.getElementById('supports-streaming').checked,
            };
        }
        // Form submission
        document.getElementById('provider-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = getFormData();
            
            if (editingProviderId) {
                vscode.postMessage({ 
                    type: 'editProvider', 
                    data: { ...formData, id: editingProviderId } 
                });
            } else {
                vscode.postMessage({ type: 'addProvider', data: formData });
            }
        });

        // Template functions
        function createFromTemplate(templateId) {
            const template = templates.find(t => t.id === templateId);
            if (!template) return;

            const name = prompt(\`Enter a name for this \${template.name} provider:\`, template.name);
            if (!name) return;

            const customConfig = { name };
            
            // For providers that need API keys, prompt for it
            if (template.requiredFields.includes('apiKey')) {
                const apiKey = prompt(\`Enter your \${template.name} API key:\`);
                if (!apiKey) return;
                customConfig.apiKey = apiKey;
            }

            vscode.postMessage({ 
                type: 'createFromTemplate', 
                data: { templateId, customConfig } 
            });
        }

        function showTemplateDetails(templateId) {
            const template = templates.find(t => t.id === templateId);
            if (!template) return;

            const modal = document.getElementById('template-modal');
            const details = document.getElementById('template-details');
            
            details.innerHTML = \`
                <h3>\${template.name}</h3>
                <p><strong>Provider:</strong> \${template.provider}</p>
                <p><strong>Description:</strong> \${template.description}</p>
                
                <h4>Setup Instructions:</h4>
                <ol>
                    \${template.setupInstructions.map(step => \`<li>\${step}</li>\`).join('')}
                </ol>
                
                <div style="margin-top: 16px;">
                    <button class="btn btn-primary" onclick="createFromTemplate('\${template.id}'); closeTemplateModal();">
                        Create Provider
                    </button>
                </div>
            \`;
            
            modal.classList.add('active');
        }

        // Utility functions
        function discoverProviders() {
            vscode.postMessage({ type: 'discoverProviders' });
        }

        function importConfig() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        vscode.postMessage({ 
                            type: 'importConfig', 
                            data: { config: e.target.result } 
                        });
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }
        function exportConfig() {
            vscode.postMessage({ type: 'exportConfig' });
        }

        function refreshMetrics() {
            vscode.postMessage({ type: 'refreshProviderStatus' });
        }

        function showProviderMetrics(id) {
            vscode.postMessage({ type: 'getProviderMetrics', data: { id } });
        }

        function testAllProviders() {
            const providerIds = providers.map(p => p.id);
            if (providerIds.length === 0) {
                showError('No providers configured');
                return;
            }
            
            document.getElementById('concurrent-test-results').style.display = 'block';
            document.getElementById('test-results-list').innerHTML = '<div class="loading"><div class="spinner"></div><span>Testing providers...</span></div>';
            
            vscode.postMessage({ 
                type: 'testProvidersConcurrent', 
                data: { providerIds } 
            });
        }

        function testSelectedProviders() {
            // For now, test all providers. Could be enhanced with checkboxes for selection
            testAllProviders();
        }

        function resetProviderMetrics(id) {
            if (confirm('Are you sure you want to reset metrics for this provider?')) {
                vscode.postMessage({ type: 'resetProviderMetrics', data: { id } });
            }
        }

        function showProviderMetricsModal(data) {
            const provider = providers.find(p => p.id === data.id);
            if (!provider) return;

            const metrics = data.metrics || {};
            const performance = data.performance || {};

            alert(\`Detailed Metrics for \${provider.name}:

Total Requests: \${performance.totalRequests || 0}
Successful Requests: \${metrics.successfulRequests || 0}
Failed Requests: \${metrics.failedRequests || 0}
Success Rate: \${(performance.successRate || 0).toFixed(1)}%
Average Response Time: \${performance.averageResponseTime || 0}ms
Uptime: \${(performance.uptime || 0).toFixed(1)}%
Last Used: \${performance.lastUsed ? new Date(performance.lastUsed).toLocaleString() : 'Never'}\`);
        }

        function renderConcurrentTestResults(results) {
            const container = document.getElementById('test-results-list');
            
            container.innerHTML = results.map(result => {
                const provider = providers.find(p => p.id === result.providerId);
                const providerName = provider ? provider.name : result.providerId;
                const success = result.result.success;
                
                return \`
                    <div class="provider-item" style="margin-bottom: 8px;">
                        <div class="provider-info">
                            <div class="provider-name">
                                <span class="status-indicator status-\${success ? 'online' : 'error'}"></span>
                                \${providerName}
                            </div>
                            <div class="provider-details">
                                \${success 
                                    ? \`✅ Success: \${result.result.response || 'Connection OK'}\`
                                    : \`❌ Failed: \${result.result.error}\`
                                }
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        function showError(message) {
            const errorDiv = document.getElementById('validation-errors');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        function showSuccess(message) {
            // Create temporary success message
            const successDiv = document.createElement('div');
            successDiv.className = 'success-message';
            successDiv.textContent = message;
            document.body.appendChild(successDiv);
            
            setTimeout(() => {
                document.body.removeChild(successDiv);
            }, 3000);
        }

        // Render functions
        function renderProviders() {
            const container = document.getElementById('provider-list');
            
            if (providers.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <h3>No providers configured</h3>
                        <p>Add your first AI provider to get started</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = providers.map(provider => {
                const status = provider.status || { state: 'offline' };
                const performance = provider.performance || {};
                const isActive = provider.id === activeProviderId;
                
                // Format metrics display
                const metricsHtml = performance.totalRequests > 0 ? \`
                    <div class="provider-metrics">
                        <div class="metric-item">
                            <span>Uptime:</span>
                            <div class="uptime-bar">
                                <div class="uptime-fill \${performance.uptime < 50 ? 'error' : performance.uptime < 90 ? 'warning' : ''}" 
                                     style="width: \${performance.uptime || 0}%"></div>
                            </div>
                            <span>\${(performance.uptime || 0).toFixed(1)}%</span>
                        </div>
                        <div class="metric-item">
                            <span>Avg Response:</span>
                            <span>\${performance.averageResponseTime || 0}ms</span>
                        </div>
                        <div class="metric-item">
                            <span>Requests:</span>
                            <span>\${performance.totalRequests || 0}</span>
                        </div>
                    </div>
                \` : '';
                
                return \`
                    <div class="provider-item \${isActive ? 'active' : ''}">
                        <div class="provider-info">
                            <div class="provider-name">
                                \${provider.name}
                                \${isActive ? '<span style="color: var(--vscode-focusBorder);">★</span>' : ''}
                            </div>
                            <div class="provider-details">
                                <span class="status-indicator status-\${status.state}"></span>
                                <span>\${provider.provider} • \${provider.modelName}</span>
                                \${status.responseTime ? \`<span>\${status.responseTime}ms</span>\` : ''}
                                \${status.errorCount > 0 ? \`<span style="color: var(--vscode-testing-iconFailed);">⚠️ \${status.errorCount} errors</span>\` : ''}
                            </div>
                            \${metricsHtml}
                        </div>
                        <div class="provider-actions">
                            <button class="action-btn" onclick="testProvider('\${provider.id}')" title="Test Connection">
                                🔍
                            </button>
                            <button class="action-btn" onclick="showProviderMetrics('\${provider.id}')" title="View Metrics">
                                📊
                            </button>
                            <button class="action-btn" onclick="editProvider('\${provider.id}')" title="Edit">
                                ✏️
                            </button>
                            <button class="action-btn" onclick="setActiveProvider('\${provider.id}')" title="Set Active">
                                ⭐
                            </button>
                            <button class="action-btn" onclick="removeProvider('\${provider.id}')" title="Remove">
                                🗑️
                            </button>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        function renderMetrics() {
            const container = document.getElementById('metrics-list');
            
            if (providers.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <h3>No providers configured</h3>
                        <p>Configure providers to see performance metrics</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = providers.map(provider => {
                const status = provider.status || { state: 'offline' };
                const performance = provider.performance || {};
                const metrics = provider.metrics || {};
                
                const lastUsed = performance.lastUsed ? new Date(performance.lastUsed).toLocaleString() : 'Never';
                
                return \`
                    <div class="provider-item">
                        <div class="provider-info" style="flex: 1;">
                            <div class="provider-name">
                                \${provider.name}
                                <span class="status-indicator status-\${status.state}"></span>
                            </div>
                            <div class="provider-details">
                                <span>\${provider.provider} • \${provider.modelName}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 8px; font-size: 11px;">
                                <div>
                                    <strong>Uptime:</strong> \${(performance.uptime || 0).toFixed(1)}%
                                    <div class="uptime-bar" style="margin-top: 2px;">
                                        <div class="uptime-fill \${performance.uptime < 50 ? 'error' : performance.uptime < 90 ? 'warning' : ''}" 
                                             style="width: \${performance.uptime || 0}%"></div>
                                    </div>
                                </div>
                                <div><strong>Total Requests:</strong> \${performance.totalRequests || 0}</div>
                                <div><strong>Success Rate:</strong> \${(performance.successRate || 0).toFixed(1)}%</div>
                                <div><strong>Avg Response:</strong> \${performance.averageResponseTime || 0}ms</div>
                                <div><strong>Last Used:</strong> \${lastUsed}</div>
                                <div><strong>Error Count:</strong> \${status.errorCount || 0}</div>
                            </div>
                        </div>
                        <div class="provider-actions">
                            <button class="action-btn" onclick="testProvider('\${provider.id}')" title="Test Connection">
                                🔍
                            </button>
                            <button class="action-btn" onclick="resetProviderMetrics('\${provider.id}')" title="Reset Metrics">
                                🔄
                            </button>
                        </div>
                    </div>
                \`;
            }).join('');
        }
        function renderTemplates() {
            const container = document.getElementById('template-grid');
            
            if (templates.length === 0) {
                container.innerHTML = \`
                    <div class="loading">
                        <div class="spinner"></div>
                        <span>Loading templates...</span>
                    </div>
                \`;
                return;
            }

            container.innerHTML = templates.map(template => \`
                <div class="template-card" onclick="showTemplateDetails('\${template.id}')">
                    <div class="template-header">
                        <div class="template-name">\${template.name}</div>
                        <div class="template-provider">\${template.provider}</div>
                    </div>
                    <div class="template-description">\${template.description}</div>
                    <div style="margin-top: auto; padding-top: 8px;">
                        <button class="btn btn-primary" onclick="event.stopPropagation(); createFromTemplate('\${template.id}')">
                            Use Template
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        function updateProviderSelectors() {
            const selectors = [
                'active-provider-select',
                'requirements-provider',
                'design-provider', 
                'execution-provider',
                'hooks-provider'
            ];

            selectors.forEach(selectorId => {
                const select = document.getElementById(selectorId);
                const currentValue = select.value;
                
                // Clear and repopulate options
                select.innerHTML = selectorId === 'active-provider-select' 
                    ? '<option value="">Select active provider...</option>'
                    : '<option value="">Use active provider</option>';
                
                providers.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.id;
                    option.textContent = provider.name;
                    select.appendChild(option);
                });
                
                // Restore previous selection
                select.value = currentValue;
            });

            // Set active provider in selector
            if (activeProviderId) {
                document.getElementById('active-provider-select').value = activeProviderId;
            }
        }

        // Event listeners for phase provider changes
        document.getElementById('active-provider-select').addEventListener('change', (e) => {
            if (e.target.value) {
                setActiveProvider(e.target.value);
            }
        });

        ['requirements-provider', 'design-provider', 'execution-provider', 'hooks-provider'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                const phase = id.replace('-provider', '');
                vscode.postMessage({ 
                    type: 'setPhaseProvider', 
                    data: { phase, id: e.target.value } 
                });
            });
        });
        // Message handler
        window.addEventListener('message', event => {
            const { type, data } = event.data;
            
            switch (type) {
                case 'providersLoaded':
                    providers = data.providers;
                    activeProviderId = data.activeProviderId;
                    renderProviders();
                    renderMetrics();
                    updateProviderSelectors();
                    break;

                case 'templatesLoaded':
                    templates = data.templates;
                    renderTemplates();
                    break;

                case 'providerAdded':
                case 'providerCreated':
                    showSuccess(\`Provider "\${data.name}" added successfully\`);
                    closeModal();
                    break;

                case 'providerUpdated':
                    showSuccess('Provider updated successfully');
                    closeModal();
                    break;

                case 'providerRemoved':
                    showSuccess('Provider removed successfully');
                    break;

                case 'testStarted':
                    // Update UI to show testing state
                    const provider = providers.find(p => p.id === data.id);
                    if (provider && provider.status) {
                        provider.status.state = 'testing';
                        renderProviders();
                    }
                    break;

                case 'testCompleted':
                    const testBtn = document.getElementById('test-btn');
                    if (testBtn) {
                        testBtn.textContent = 'Test Connection';
                        testBtn.disabled = false;
                    }
                    
                    if (data.success) {
                        showSuccess(\`Connection test successful: \${data.response || 'OK'}\`);
                    } else {
                        showError(\`Connection test failed: \${data.error}\`);
                    }
                    
                    // Clean up temporary test provider
                    if (data.id.startsWith('temp-test-')) {
                        vscode.postMessage({ type: 'removeProvider', data: { id: data.id } });
                    }
                    break;

                case 'configExported':
                    // Download the config file
                    const blob = new Blob([data.config], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'provider-config.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    showSuccess('Configuration exported successfully');
                    break;

                case 'configImported':
                    showSuccess('Configuration imported successfully');
                    break;

                case 'providersDiscovered':
                    if (data.providers.length > 0) {
                        showSuccess(\`Discovered \${data.providers.length} local provider(s)\`);
                    } else {
                        showError('No local providers found');
                    }
                    break;

                case 'error':
                    showError(data.message);
                    break;

                case 'providerMetrics':
                    // Show detailed metrics in a modal or expanded view
                    showProviderMetricsModal(data);
                    break;

                case 'metricsReset':
                    showSuccess('Provider metrics reset successfully');
                    break;

                case 'concurrentTestStarted':
                    document.getElementById('concurrent-test-results').style.display = 'block';
                    document.getElementById('test-results-list').innerHTML = '<div class="loading"><div class="spinner"></div><span>Testing providers...</span></div>';
                    break;

                case 'concurrentTestCompleted':
                    renderConcurrentTestResults(data.results);
                    break;

                case 'concurrentTestFailed':
                    document.getElementById('test-results-list').innerHTML = \`<div class="error-message">Test failed: \${data.error}</div>\`;
                    break;
            }
        });

        // Initialize
        vscode.postMessage({ type: 'loadProviders' });
        vscode.postMessage({ type: 'loadTemplates' });
    </script>
</body>
</html>\`;`;
