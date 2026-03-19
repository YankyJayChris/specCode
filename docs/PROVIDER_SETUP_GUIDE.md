# Provider Setup Guide

This guide provides comprehensive instructions for setting up and configuring AI providers in SpecCode.

## Getting Started

### Opening Provider Setup

1. **Via Sidebar**: Click "Provider Setup" in the SpecCode sidebar panel
2. **Via Command Palette**: Press `Ctrl+Shift+P` and search "SpecCode: Open Provider Setup"
3. **Via Menu**: Right-click in the SpecCode sidebar and select "Provider Setup"

### Provider Setup Interface

The Provider Setup interface provides:

- **Provider List**: View all configured providers with status indicators
- **Template Gallery**: Browse 14+ pre-configured provider templates
- **Configuration Forms**: Step-by-step setup with validation
- **Connection Testing**: Real-time provider health checks
- **Import/Export**: Share configurations across teams
- **Discovery Tools**: Auto-detect local AI services

## Cloud Provider Setup

### Anthropic Claude

**Recommended for**: Code generation, complex reasoning, analysis

**Setup Steps**:

1. Visit [console.anthropic.com](https://console.anthropic.com/)
2. Create account or sign in
3. Navigate to "API Keys" section
4. Click "Create Key" and copy the key
5. In SpecCode Provider Setup:
   - Select "Claude 3.5 Sonnet" or "Claude 3 Haiku" template
   - Paste API key in the "API Key" field
   - Click "Test Connection"
   - Click "Save Provider"

**Available Models**:

- **Claude 3.5 Sonnet**: Most capable, best for coding ($15/1M tokens)
- **Claude 3 Haiku**: Fast and efficient ($0.25/1M tokens)

**Features**:

- ✅ Tool calling
- ✅ Vision (image analysis)
- ✅ Streaming responses
- ✅ System messages
- 🔒 Secure API key storage

**Troubleshooting**:

- **Invalid API Key**: Ensure key starts with `sk-ant-`
- **Rate Limits**: Upgrade to paid plan for higher limits
- **Model Access**: Some models require approval

### OpenAI GPT

**Recommended for**: General tasks, creative writing, broad knowledge

**Setup Steps**:

1. Visit [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create new secret key"
5. Copy key immediately (won't be shown again)
6. In SpecCode Provider Setup:
   - Select "GPT-4" or "GPT-4 Turbo" template
   - Paste API key
   - Test and save

**Available Models**:

- **GPT-4 Turbo**: Latest model with updated knowledge ($10/1M tokens)
- **GPT-4**: Most capable OpenAI model ($30/1M tokens)
- **GPT-3.5 Turbo**: Fast and cost-effective ($0.50/1M tokens)

**Features**:

- ✅ Tool calling
- ✅ Vision (GPT-4 Turbo/Vision)
- ✅ Streaming responses
- ✅ Function calling

### Google Gemini

**Recommended for**: Multimodal tasks, fast inference, safety-conscious applications

**Setup Steps**:

1. Visit [aistudio.google.com](https://aistudio.google.com/)
2. Sign in with Google account
3. Click "Get API key"
4. Create new API key
5. In SpecCode Provider Setup:
   - Select "Gemini Pro" template
   - Paste API key
   - Configure safety settings if needed
   - Test and save

**Available Models**:

- **Gemini Pro**: Advanced reasoning and multimodal ($0.50/1M tokens)
- **Gemini Pro Vision**: Enhanced image understanding

**Features**:

- ✅ Tool calling
- ✅ Vision capabilities
- ✅ Streaming responses
- ⚙️ Configurable safety settings

**Safety Settings**:
Configure content filtering levels:

- **Harassment**: BLOCK_NONE | BLOCK_LOW | BLOCK_MEDIUM | BLOCK_HIGH
- **Hate Speech**: BLOCK_NONE | BLOCK_LOW | BLOCK_MEDIUM | BLOCK_HIGH
- **Sexually Explicit**: BLOCK_NONE | BLOCK_LOW | BLOCK_MEDIUM | BLOCK_HIGH
- **Dangerous Content**: BLOCK_NONE | BLOCK_LOW | BLOCK_MEDIUM | BLOCK_HIGH

### Alibaba Qwen

**Recommended for**: Chinese language tasks, multilingual applications, cost-effective solutions

**Setup Steps**:

1. Visit [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com/)
2. Create Alibaba Cloud account
3. Enable DashScope service
4. Generate API key
5. In SpecCode Provider Setup:
   - Select "Qwen Turbo" or "Qwen Max" template
   - Paste API key
   - Enable Chinese optimization if needed
   - Test and save

**Available Models**:

- **Qwen Turbo**: Fast inference, cost-effective ($0.20/1M tokens)
- **Qwen Max**: Most capable Qwen model ($2.00/1M tokens)

**Features**:

- ✅ Tool calling
- ✅ Vision (Qwen Max)
- ✅ Streaming responses
- 🇨🇳 Chinese language optimization
- 🌐 Multilingual support

### Moonshot Kimi

**Recommended for**: Long context tasks, document analysis, extended conversations

**Setup Steps**:

1. Visit [platform.moonshot.cn](https://platform.moonshot.cn/)
2. Create account
3. Navigate to API Keys
4. Generate new key
5. In SpecCode Provider Setup:
   - Select "Kimi Chat" or "Kimi 32K" template
   - Paste API key
   - Configure context length
   - Test and save

**Available Models**:

- **Kimi 8K**: Standard context window ($1.20/1M tokens)
- **Kimi 32K**: Extended context window ($2.40/1M tokens)
- **Kimi 128K**: Long context window ($12.00/1M tokens)

**Features**:

- ✅ Tool calling
- ✅ Streaming responses
- 📄 Long context support (up to 200K tokens)
- 🔍 Document analysis capabilities

### xAI Grok

**Recommended for**: Real-time information, conversational AI, X/Twitter integration

**Setup Steps**:

1. Visit [console.x.ai](https://console.x.ai/)
2. Sign in with X (Twitter) account
3. Navigate to API section
4. Generate API key (may require approval)
5. In SpecCode Provider Setup:
   - Select "xAI Grok" template
   - Paste API key
   - Test and save

**Available Models**:

- **Grok Beta**: Real-time capabilities ($5.00/1M tokens)

**Features**:

- ✅ Tool calling
- ✅ Streaming responses
- 🌐 Real-time information access
- 🐦 X/Twitter integration

## Local Provider Setup

### Ollama

**Recommended for**: Privacy, offline usage, cost-free operation, custom models

**Prerequisites**:

1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Start Ollama service
3. Download models: `ollama pull llama2`

**Setup Steps**:

1. Ensure Ollama is running on `localhost:11434`
2. In SpecCode Provider Setup:
   - Click "Discover Providers" (auto-detects Ollama)
   - Or select "Ollama Llama 2" template manually
   - Verify base URL: `http://localhost:11434/v1`
   - Select model from dropdown
   - Test and save

**Popular Models**:

- **Llama 2**: General purpose, good performance
- **Code Llama**: Specialized for code generation
- **Mistral**: Fast inference, good reasoning
- **Phi-3**: Microsoft's efficient model
- **Gemma**: Google's open model

**Features**:

- ✅ Streaming responses
- ✅ System messages
- 🔒 Complete privacy (local processing)
- 💰 No API costs
- 📱 Offline functionality
- ⚠️ Limited tool calling support

**Troubleshooting**:

- **Connection Failed**: Ensure Ollama service is running
- **Model Not Found**: Run `ollama pull <model-name>`
- **Slow Performance**: Consider GPU acceleration
- **Port Issues**: Check if port 11434 is available

### LM Studio

**Recommended for**: Custom models, advanced local setups, model experimentation

**Prerequisites**:

1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai/)
2. Download and load a model
3. Start local server (usually port 1234)

**Setup Steps**:

1. Load model in LM Studio
2. Start local server
3. In SpecCode Provider Setup:
   - Click "Discover Providers" (auto-detects LM Studio)
   - Or select "LM Studio Local" template
   - Verify base URL: `http://localhost:1234/v1`
   - Enter loaded model name
   - Test and save

**Features**:

- ✅ Streaming responses
- ✅ System messages
- 🔒 Complete privacy
- 💰 No API costs
- 🎛️ Advanced model configuration
- ⚠️ Limited tool calling support

## Advanced Configuration

### Phase-Specific Providers

Configure different providers for different workflow phases:

1. Open Provider Setup
2. Go to "Phase Configuration" tab
3. Set providers for each phase:
   - **Requirements**: Best for understanding (Claude Sonnet)
   - **Design**: Best for architecture (GPT-4 Turbo)
   - **Execution**: Best for coding (Claude Sonnet)
   - **Hooks**: Fast and private (Ollama)

### Provider-Specific Settings

#### Claude Settings

```json
{
  "providerSettings": {
    "systemPromptHandling": "separate" // or "inline"
  }
}
```

#### Gemini Settings

```json
{
  "providerSettings": {
    "safetySettings": {
      "harassment": "BLOCK_MEDIUM",
      "hateSpeech": "BLOCK_MEDIUM",
      "sexuallyExplicit": "BLOCK_MEDIUM",
      "dangerousContent": "BLOCK_MEDIUM"
    }
  }
}
```

#### Qwen Settings

```json
{
  "providerSettings": {
    "chineseOptimization": true
  }
}
```

#### Kimi Settings

```json
{
  "providerSettings": {
    "longContextMode": true,
    "maxContextLength": 32768
  }
}
```

### Custom Headers

For providers requiring custom authentication:

```json
{
  "customHeaders": {
    "Authorization": "Bearer your-token",
    "X-Custom-Header": "value"
  }
}
```

### Proxy Configuration

For corporate environments:

```json
{
  "proxy": {
    "host": "proxy.company.com",
    "port": 8080,
    "auth": {
      "username": "user",
      "password": "pass"
    }
  }
}
```

## Provider Monitoring

### Status Indicators

- 🟢 **Online**: Provider is healthy and responsive
- 🟡 **Slow**: High response times or intermittent issues
- 🔴 **Offline**: Provider is unreachable or failing
- ⚪ **Testing**: Connection test in progress
- ⏸️ **Paused**: Provider temporarily disabled

### Performance Metrics

View detailed metrics in Provider Setup:

- **Response Time**: Average time for API calls
- **Success Rate**: Percentage of successful requests
- **Error Count**: Number of failed requests
- **Uptime**: Percentage of time provider was available
- **Cost Tracking**: Estimated costs based on token usage

### Health Monitoring

SpecCode automatically monitors provider health:

- **Periodic Health Checks**: Configurable interval (default: 5 minutes)
- **Circuit Breaker**: Automatically disables failing providers
- **Automatic Recovery**: Re-enables providers when they recover
- **Failover**: Switches to backup providers when primary fails

## Team Configuration

### Exporting Configurations

Share provider setups with your team:

1. Open Provider Setup
2. Click "Export Configuration"
3. Choose providers to export
4. Save JSON file (API keys excluded for security)
5. Share file with team members

### Importing Configurations

Import team configurations:

1. Open Provider Setup
2. Click "Import Configuration"
3. Select team's JSON file
4. Review imported providers
5. Add your own API keys
6. Test connections

### Workspace Settings

Store team configurations in workspace settings:

```json
{
  "specCode.teamProviders": [
    {
      "id": "team-claude",
      "name": "Team Claude Setup",
      "provider": "anthropic",
      "modelName": "claude-3-5-sonnet-20241022",
      "temperature": 0.7,
      "maxTokens": 4096
      // API key added individually by each team member
    }
  ]
}
```

## Troubleshooting

### Common Issues

#### Authentication Errors

- **Invalid API Key**: Verify key format and permissions
- **Expired Key**: Generate new API key from provider console
- **Insufficient Credits**: Check account balance and billing

#### Connection Issues

- **Network Timeout**: Check internet connection and firewall
- **Proxy Problems**: Configure proxy settings if in corporate environment
- **SSL Errors**: Verify SSL certificates and security settings

#### Rate Limiting

- **Too Many Requests**: Reduce request frequency or upgrade plan
- **Quota Exceeded**: Check usage limits and billing status
- **Concurrent Limits**: Avoid too many simultaneous requests

#### Local Provider Issues

- **Service Not Running**: Start Ollama/LM Studio service
- **Port Conflicts**: Check if ports 11434/1234 are available
- **Model Not Loaded**: Ensure model is downloaded and loaded
- **Performance Issues**: Consider hardware requirements and GPU acceleration

### Getting Help

1. **Test Connection**: Use built-in connection testing
2. **Check Logs**: Review "SpecCode" output channel for detailed errors
3. **Provider Status**: Monitor health indicators in sidebar
4. **Documentation**: Check provider-specific documentation links
5. **Community**: Join Discord or GitHub discussions for support

### Best Practices

1. **Multiple Providers**: Configure backup providers for reliability
2. **Cost Management**: Monitor usage and set up billing alerts
3. **Security**: Never share API keys, use workspace settings for teams
4. **Performance**: Use local providers for frequent, simple tasks
5. **Monitoring**: Regularly check provider health and performance metrics

---

For more detailed information, see the [Architecture Documentation](ARCHITECTURE.md) and [Usage Guide](USAGE.md).
