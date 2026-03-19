# Provider Troubleshooting Guide

This guide helps you diagnose and resolve common issues with AI provider configurations in SpecCode.

## Quick Diagnostics

### Provider Status Check

1. **Check Sidebar Status**: Look for status indicators next to provider names
   - 🟢 Online and healthy
   - 🟡 Slow or intermittent issues
   - 🔴 Offline or failing
   - ⚪ Testing in progress

2. **Test Connection**: Use the "Test Connection" button in Provider Setup
3. **Check Output Logs**: Open "SpecCode" output channel for detailed error messages
4. **Review Metrics**: Check response times and error rates in Provider Setup

### Common Error Patterns

| Error Message          | Likely Cause         | Quick Fix                    |
| ---------------------- | -------------------- | ---------------------------- |
| "Invalid API key"      | Wrong or expired key | Regenerate API key           |
| "Model not found"      | Incorrect model name | Check provider documentation |
| "Rate limit exceeded"  | Too many requests    | Wait or upgrade plan         |
| "Connection timeout"   | Network issues       | Check internet/proxy         |
| "Insufficient credits" | Account balance low  | Add billing/credits          |

## Authentication Issues

### Invalid API Key Errors

**Symptoms:**

- "Invalid API key" or "Unauthorized" errors
- 401/403 HTTP status codes
- Provider shows offline status

**Diagnosis:**

1. Verify API key format matches provider requirements
2. Check if key has expired or been revoked
3. Ensure key has necessary permissions

**Solutions:**

#### Anthropic Claude

- Key format: `sk-ant-api03-...`
- Generate new key at [console.anthropic.com](https://console.anthropic.com/)
- Ensure account has sufficient credits

#### OpenAI

- Key format: `sk-...` (starts with sk-)
- Generate at [platform.openai.com](https://platform.openai.com/)
- Check organization access if using org keys

#### Google Gemini

- Key format: `AI...` (starts with AI)
- Generate at [aistudio.google.com](https://aistudio.google.com/)
- Enable Generative AI API in Google Cloud Console

#### Qwen (Alibaba)

- Key format: Varies by region
- Generate at [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com/)
- Ensure DashScope service is enabled

#### Kimi (Moonshot)

- Key format: Varies
- Generate at [platform.moonshot.cn](https://platform.moonshot.cn/)
- May require account verification

### Permission Errors

**Symptoms:**

- "Access denied" messages
- Specific model unavailable errors
- Feature restrictions (no tools/vision)

**Solutions:**

1. **Check Account Tier**: Some models require paid plans
2. **Request Access**: Some models need approval (GPT-4, Claude-3)
3. **Verify Permissions**: Ensure API key has model access
4. **Regional Restrictions**: Some models unavailable in certain regions

## Connection Issues

### Network Timeouts

**Symptoms:**

- "Connection timeout" errors
- Slow response times
- Intermittent failures

**Diagnosis:**

1. Test internet connectivity
2. Check if provider service is down
3. Verify firewall/proxy settings
4. Test from different network

**Solutions:**

#### Corporate Networks

```json
{
  "proxy": {
    "host": "proxy.company.com",
    "port": 8080,
    "auth": {
      "username": "your-username",
      "password": "your-password"
    }
  }
}
```

#### Firewall Issues

- Ensure HTTPS (443) is allowed
- Whitelist provider domains:
  - `api.anthropic.com` (Claude)
  - `api.openai.com` (OpenAI)
  - `generativelanguage.googleapis.com` (Gemini)
  - `api.x.ai` (Grok)
  - `dashscope.aliyuncs.com` (Qwen)
  - `api.moonshot.cn` (Kimi)

#### DNS Issues

- Try using IP addresses instead of domains
- Configure alternative DNS servers (8.8.8.8, 1.1.1.1)
- Check corporate DNS restrictions

### SSL Certificate Errors

**Symptoms:**

- "SSL certificate verification failed"
- "Certificate authority invalid"
- HTTPS connection errors

**Solutions:**

1. **Update Certificates**: Ensure system certificates are current
2. **Corporate CA**: Install corporate certificate authority
3. **Bypass Verification**: Only for testing (not recommended for production)

```json
{
  "ssl": {
    "verify": false, // Only for testing!
    "ca": "/path/to/corporate-ca.pem"
  }
}
```

## Rate Limiting Issues

### Quota Exceeded

**Symptoms:**

- "Rate limit exceeded" errors
- 429 HTTP status codes
- Requests being rejected

**Understanding Rate Limits:**

| Provider | Free Tier | Paid Tier | Notes              |
| -------- | --------- | --------- | ------------------ |
| Claude   | 5 RPM     | 50+ RPM   | Based on plan      |
| OpenAI   | 3 RPM     | 60+ RPM   | Model dependent    |
| Gemini   | 15 RPM    | 300+ RPM  | Generous limits    |
| Qwen     | 10 RPM    | 100+ RPM  | Regional variation |
| Kimi     | 5 RPM     | 60+ RPM   | Context dependent  |

**Solutions:**

#### Immediate Fixes

1. **Wait**: Rate limits reset after time window
2. **Reduce Frequency**: Space out requests
3. **Switch Providers**: Use backup provider temporarily

#### Long-term Solutions

1. **Upgrade Plan**: Move to paid tier for higher limits
2. **Load Balancing**: Distribute requests across multiple providers
3. **Request Queuing**: Implement request throttling

#### Configuration Example

```json
{
  "rateLimiting": {
    "requestsPerMinute": 10,
    "burstLimit": 3,
    "backoffStrategy": "exponential"
  }
}
```

### Concurrent Request Limits

**Symptoms:**

- Errors during high-usage periods
- Requests timing out under load
- Inconsistent response times

**Solutions:**

1. **Limit Concurrency**: Reduce simultaneous requests
2. **Queue Requests**: Implement request queuing
3. **Multiple Keys**: Use multiple API keys (where allowed)

## Model-Specific Issues

### Model Not Found

**Symptoms:**

- "Model not found" or "Model not available"
- 404 errors when making requests
- Provider accepts connection but rejects model

**Common Causes:**

1. **Typo in Model Name**: Check exact spelling
2. **Model Deprecated**: Provider removed model
3. **Regional Availability**: Model not available in your region
4. **Access Required**: Model requires special approval

**Solutions:**

#### Verify Model Names

- **Claude**: `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307`
- **OpenAI**: `gpt-4-turbo-preview`, `gpt-4`, `gpt-3.5-turbo`
- **Gemini**: `gemini-pro`, `gemini-pro-vision`
- **Qwen**: `qwen-turbo`, `qwen-max`
- **Kimi**: `moonshot-v1-8k`, `moonshot-v1-32k`

#### Check Provider Documentation

1. Visit provider's API documentation
2. Verify current model availability
3. Check for model updates or changes
4. Review access requirements

### Feature Limitations

**Symptoms:**

- "Tool calling not supported" errors
- Vision features unavailable
- Streaming not working

**Provider Capabilities:**

| Provider    | Tools | Vision | Streaming | System Messages |
| ----------- | ----- | ------ | --------- | --------------- |
| Claude 3.5  | ✅    | ✅     | ✅        | ✅              |
| GPT-4 Turbo | ✅    | ✅     | ✅        | ✅              |
| Gemini Pro  | ✅    | ✅     | ✅        | ✅              |
| Qwen Max    | ✅    | ✅     | ✅        | ✅              |
| Kimi        | ✅    | ❌     | ✅        | ✅              |
| Ollama      | ⚠️    | ❌     | ✅        | ✅              |

**Solutions:**

1. **Check Capabilities**: Verify provider supports required features
2. **Update Model**: Switch to model with needed capabilities
3. **Fallback Logic**: Use alternative approach for unsupported features

## Local Provider Issues

### Ollama Problems

**Common Issues:**

#### Service Not Running

```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# Start Ollama (varies by OS)
ollama serve  # Manual start
systemctl start ollama  # Linux service
```

#### Model Not Available

```bash
# List available models
ollama list

# Download model if missing
ollama pull llama2
ollama pull codellama
```

#### Port Conflicts

```bash
# Check what's using port 11434
lsof -i :11434
netstat -tulpn | grep 11434

# Change Ollama port (if needed)
OLLAMA_HOST=0.0.0.0:11435 ollama serve
```

#### Performance Issues

- **CPU Usage**: Ollama uses significant CPU for inference
- **Memory**: Large models require substantial RAM
- **GPU**: Enable GPU acceleration for better performance

```bash
# Check GPU availability
ollama run llama2 --gpu

# Monitor resource usage
htop
nvidia-smi  # For NVIDIA GPUs
```

### LM Studio Problems

**Common Issues:**

#### Server Not Started

1. Open LM Studio application
2. Go to "Local Server" tab
3. Load a model
4. Click "Start Server"
5. Verify server is running on correct port (usually 1234)

#### Model Loading Issues

1. **Insufficient RAM**: Large models need significant memory
2. **GPU Memory**: Enable GPU acceleration if available
3. **Model Format**: Ensure model is compatible (GGUF format)

#### Connection Issues

```json
{
  "baseUrl": "http://localhost:1234/v1",
  "modelName": "actual-loaded-model-name"
}
```

**Troubleshooting Steps:**

1. Check LM Studio logs for errors
2. Verify model is fully loaded (not just downloaded)
3. Test API endpoint directly:

```bash
curl http://localhost:1234/v1/models
```

## Performance Issues

### Slow Response Times

**Symptoms:**

- Requests taking longer than expected
- Timeouts during normal usage
- Inconsistent response speeds

**Diagnosis:**

1. **Check Provider Status**: Some providers may be experiencing issues
2. **Network Latency**: Test connection speed to provider
3. **Model Complexity**: Larger models are slower
4. **Request Size**: Large prompts take more time

**Solutions:**

#### Optimize Requests

- **Reduce Context**: Trim unnecessary context from prompts
- **Smaller Models**: Use faster models for simple tasks
- **Streaming**: Enable streaming for real-time responses
- **Caching**: Cache responses for repeated requests

#### Provider Selection

- **Geographic Proximity**: Choose providers with nearby servers
- **Performance Tiers**: Use premium tiers for better performance
- **Load Balancing**: Distribute load across multiple providers

### Memory Issues

**Symptoms:**

- VS Code becoming slow or unresponsive
- High memory usage by SpecCode extension
- System running out of memory

**Solutions:**

1. **Limit Concurrent Requests**: Reduce simultaneous API calls
2. **Clear Cache**: Clear provider response cache
3. **Restart Extension**: Reload VS Code window
4. **Provider Cleanup**: Remove unused provider configurations

## Configuration Validation

### Invalid Configuration

**Symptoms:**

- Provider setup fails validation
- Configuration not saving properly
- Unexpected behavior after setup

**Validation Checklist:**

#### Required Fields

- ✅ Provider ID (unique)
- ✅ Provider name
- ✅ Provider type
- ✅ Model name
- ✅ API key (for cloud providers)

#### Optional Fields

- Base URL (for custom endpoints)
- Temperature (0.0 - 2.0)
- Max tokens (positive integer)
- Custom headers (valid JSON)

#### Provider-Specific Validation

```json
{
  "anthropic": {
    "apiKey": "^sk-ant-",
    "modelName": "^claude-"
  },
  "openai": {
    "apiKey": "^sk-",
    "modelName": "^(gpt-|text-)"
  },
  "google": {
    "apiKey": "^AI",
    "modelName": "^gemini-"
  }
}
```

### Configuration Conflicts

**Symptoms:**

- Multiple providers with same ID
- Conflicting settings between providers
- Unexpected provider selection

**Solutions:**

1. **Unique IDs**: Ensure each provider has unique identifier
2. **Clear Conflicts**: Remove duplicate configurations
3. **Reset Settings**: Clear all provider settings and reconfigure
4. **Export/Import**: Use clean configuration export/import

## Advanced Troubleshooting

### Debug Mode

Enable detailed logging for troubleshooting:

1. Open VS Code settings
2. Search for "specCode.debug"
3. Enable debug logging
4. Restart VS Code
5. Check "SpecCode Debug" output channel

### Network Debugging

#### Capture Network Traffic

```bash
# Monitor HTTP requests (Linux/Mac)
sudo tcpdump -i any -A 'host api.anthropic.com'

# Windows: Use Wireshark or Fiddler
```

#### Test API Endpoints Directly

```bash
# Test Claude API
curl -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"model":"claude-3-sonnet-20240229","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'

# Test OpenAI API
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hi"}],"max_tokens":10}'
```

### Configuration Reset

If all else fails, reset provider configurations:

1. **Backup Current Config**: Export existing providers
2. **Clear Settings**: Remove all provider configurations
3. **Clear Secrets**: Clear stored API keys
4. **Restart VS Code**: Reload window
5. **Reconfigure**: Set up providers from scratch

#### Manual Reset Steps

```bash
# Clear VS Code settings (backup first!)
# Location varies by OS:
# Windows: %APPDATA%\Code\User\settings.json
# Mac: ~/Library/Application Support/Code/User/settings.json
# Linux: ~/.config/Code/User/settings.json

# Remove specCode.* settings from settings.json
```

## Getting Help

### Self-Service Resources

1. **Provider Documentation**: Check official API documentation
2. **Status Pages**: Monitor provider service status
3. **Community Forums**: Search existing discussions
4. **Debug Logs**: Review detailed error messages

### Community Support

1. **GitHub Issues**: Report bugs and feature requests
2. **Discord Community**: Real-time help and discussions
3. **Stack Overflow**: Tag questions with "specCode-vscode"

### Provider Support

For provider-specific issues, contact provider support:

- **Anthropic**: [support.anthropic.com](https://support.anthropic.com)
- **OpenAI**: [help.openai.com](https://help.openai.com)
- **Google**: [cloud.google.com/support](https://cloud.google.com/support)
- **Alibaba**: [workorder.console.aliyun.com](https://workorder.console.aliyun.com)
- **Moonshot**: [platform.moonshot.cn](https://platform.moonshot.cn)

### Reporting Issues

When reporting issues, include:

1. **Provider Details**: Which provider and model
2. **Error Messages**: Exact error text from logs
3. **Configuration**: Sanitized provider config (no API keys!)
4. **Steps to Reproduce**: Detailed reproduction steps
5. **Environment**: VS Code version, OS, network setup
6. **Logs**: Relevant entries from SpecCode output channel

---

For additional help, see the [Provider Setup Guide](PROVIDER_SETUP_GUIDE.md) and [Architecture Documentation](ARCHITECTURE.md).
