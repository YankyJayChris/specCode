import { ModelConfig } from "./llmManager";

export interface ProviderTemplate {
  id: string;
  name: string;
  provider: ModelConfig["provider"];
  description: string;
  defaultSettings: Partial<ModelConfig>;
  requiredFields: string[];
  helpText: string;
  documentationUrl: string;
  setupInstructions: string[];
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    description:
      "Anthropic's most capable model for complex reasoning and coding tasks",
    defaultSettings: {
      modelName: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.000015,
      requestsPerMinute: 50,
      providerSettings: {
        systemPromptHandling: "separate",
      },
    },
    requiredFields: ["apiKey"],
    helpText:
      "Get your API key from the Anthropic Console at console.anthropic.com",
    documentationUrl:
      "https://docs.anthropic.com/claude/reference/getting-started",
    setupInstructions: [
      "Visit https://console.anthropic.com/",
      "Create an account or sign in with your existing account",
      "Navigate to the API Keys section in the dashboard",
      "Click 'Create Key' to generate a new API key",
      "Copy the key and paste it in the API Key field below",
      "Note: Keep your API key secure and never share it publicly",
    ],
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    description:
      "Fast and efficient Claude model for quick tasks and high-volume usage",
    defaultSettings: {
      modelName: "claude-3-haiku-20240307",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.00000025,
      requestsPerMinute: 100,
      providerSettings: {
        systemPromptHandling: "separate",
      },
    },
    requiredFields: ["apiKey"],
    helpText:
      "Get your API key from the Anthropic Console at console.anthropic.com",
    documentationUrl:
      "https://docs.anthropic.com/claude/reference/getting-started",
    setupInstructions: [
      "Visit https://console.anthropic.com/",
      "Create an account or sign in with your existing account",
      "Navigate to the API Keys section in the dashboard",
      "Click 'Create Key' to generate a new API key",
      "Copy the key and paste it in the API Key field below",
    ],
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "google",
    description:
      "Google's advanced AI model with multimodal capabilities and strong reasoning",
    defaultSettings: {
      modelName: "gemini-pro",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.0005,
      requestsPerMinute: 60,
      providerSettings: {
        safetySettings: {
          harassment: "BLOCK_MEDIUM",
          hateSpeech: "BLOCK_MEDIUM",
          sexuallyExplicit: "BLOCK_MEDIUM",
          dangerousContent: "BLOCK_MEDIUM",
        },
      },
    },
    requiredFields: ["apiKey"],
    helpText: "Get your API key from Google AI Studio at aistudio.google.com",
    documentationUrl: "https://ai.google.dev/docs",
    setupInstructions: [
      "Visit https://aistudio.google.com/",
      "Sign in with your Google account",
      "Click 'Get API key' in the top navigation",
      "Create a new API key for your project",
      "Copy the generated key and paste it below",
      "Ensure you have enabled the Generative AI API in Google Cloud Console",
    ],
  },
  {
    id: "qwen-turbo",
    name: "Qwen Turbo",
    provider: "qwen",
    description:
      "Alibaba's Qwen model optimized for Chinese and multilingual tasks with fast inference",
    defaultSettings: {
      modelName: "qwen-turbo",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.0002,
      requestsPerMinute: 100,
      providerSettings: {
        chineseOptimization: true,
      },
    },
    requiredFields: ["apiKey"],
    helpText: "Get your API key from Alibaba Cloud DashScope console",
    documentationUrl: "https://help.aliyun.com/zh/dashscope/",
    setupInstructions: [
      "Visit https://dashscope.console.aliyun.com/",
      "Create an Alibaba Cloud account if you don't have one",
      "Enable the DashScope service in your account",
      "Navigate to API Keys section",
      "Generate a new API key for DashScope",
      "Copy the key and paste it in the field below",
    ],
  },
  {
    id: "qwen-max",
    name: "Qwen Max",
    provider: "qwen",
    description:
      "Alibaba's most capable Qwen model for complex reasoning and advanced tasks",
    defaultSettings: {
      modelName: "qwen-max",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.002,
      requestsPerMinute: 50,
      providerSettings: {
        chineseOptimization: true,
      },
    },
    requiredFields: ["apiKey"],
    helpText: "Get your API key from Alibaba Cloud DashScope console",
    documentationUrl: "https://help.aliyun.com/zh/dashscope/",
    setupInstructions: [
      "Visit https://dashscope.console.aliyun.com/",
      "Create an Alibaba Cloud account if you don't have one",
      "Enable the DashScope service in your account",
      "Navigate to API Keys section",
      "Generate a new API key for DashScope",
      "Copy the key and paste it in the field below",
    ],
  },
  {
    id: "kimi-chat",
    name: "Kimi Chat",
    provider: "kimi",
    description:
      "Moonshot AI's Kimi model with exceptional long context capabilities up to 200K tokens",
    defaultSettings: {
      modelName: "moonshot-v1-8k",
      baseUrl: "https://api.moonshot.cn/v1",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.0012,
      requestsPerMinute: 60,
      providerSettings: {
        longContextMode: true,
        maxContextLength: 8192,
      },
    },
    requiredFields: ["apiKey"],
    helpText:
      "Get your API key from Moonshot AI platform at platform.moonshot.cn",
    documentationUrl: "https://platform.moonshot.cn/docs",
    setupInstructions: [
      "Visit https://platform.moonshot.cn/",
      "Create an account with your email or phone number",
      "Complete the account verification process",
      "Navigate to the API Keys section in your dashboard",
      "Generate a new API key",
      "Copy the key and paste it in the field below",
    ],
  },
  {
    id: "kimi-32k",
    name: "Kimi 32K",
    provider: "kimi",
    description:
      "Moonshot AI's Kimi model with 32K context window for longer conversations",
    defaultSettings: {
      modelName: "moonshot-v1-32k",
      baseUrl: "https://api.moonshot.cn/v1",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.0024,
      requestsPerMinute: 60,
      providerSettings: {
        longContextMode: true,
        maxContextLength: 32768,
      },
    },
    requiredFields: ["apiKey"],
    helpText:
      "Get your API key from Moonshot AI platform at platform.moonshot.cn",
    documentationUrl: "https://platform.moonshot.cn/docs",
    setupInstructions: [
      "Visit https://platform.moonshot.cn/",
      "Create an account with your email or phone number",
      "Complete the account verification process",
      "Navigate to the API Keys section in your dashboard",
      "Generate a new API key",
      "Copy the key and paste it in the field below",
    ],
  },
  {
    id: "openai-gpt-4",
    name: "GPT-4",
    provider: "openai",
    description:
      "OpenAI's most capable model for complex reasoning, coding, and creative tasks",
    defaultSettings: {
      modelName: "gpt-4",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.03,
      requestsPerMinute: 40,
    },
    requiredFields: ["apiKey"],
    helpText: "Get your API key from OpenAI platform at platform.openai.com",
    documentationUrl: "https://platform.openai.com/docs/introduction",
    setupInstructions: [
      "Visit https://platform.openai.com/",
      "Sign up or log in to your OpenAI account",
      "Navigate to the API Keys section",
      "Click 'Create new secret key'",
      "Copy the generated key immediately (it won't be shown again)",
      "Paste the key in the field below",
    ],
  },
  {
    id: "openai-gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    description:
      "OpenAI's faster and more cost-effective GPT-4 variant with updated knowledge",
    defaultSettings: {
      modelName: "gpt-4-turbo-preview",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.01,
      requestsPerMinute: 60,
    },
    requiredFields: ["apiKey"],
    helpText: "Get your API key from OpenAI platform at platform.openai.com",
    documentationUrl: "https://platform.openai.com/docs/introduction",
    setupInstructions: [
      "Visit https://platform.openai.com/",
      "Sign up or log in to your OpenAI account",
      "Navigate to the API Keys section",
      "Click 'Create new secret key'",
      "Copy the generated key immediately (it won't be shown again)",
      "Paste the key in the field below",
    ],
  },
  {
    id: "xai-grok",
    name: "Grok",
    provider: "xai",
    description:
      "xAI's Grok model with real-time information access and conversational AI capabilities",
    defaultSettings: {
      modelName: "grok-beta",
      baseUrl: "https://api.x.ai/v1",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0.005,
      requestsPerMinute: 50,
    },
    requiredFields: ["apiKey"],
    helpText: "Get your API key from xAI console at console.x.ai",
    documentationUrl: "https://docs.x.ai/",
    setupInstructions: [
      "Visit https://console.x.ai/",
      "Sign up or log in with your X (Twitter) account",
      "Navigate to the API section",
      "Generate a new API key",
      "Copy the key and paste it below",
      "Note: xAI API access may require approval or waitlist",
    ],
  },
  {
    id: "ollama-llama2",
    name: "Ollama Llama 2",
    provider: "ollama",
    description:
      "Meta's Llama 2 model running locally via Ollama for privacy and offline usage",
    defaultSettings: {
      modelName: "llama2",
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0,
      requestsPerMinute: 1000,
    },
    requiredFields: [],
    helpText:
      "Requires Ollama to be installed and running locally with the llama2 model",
    documentationUrl: "https://ollama.ai/",
    setupInstructions: [
      "Install Ollama from https://ollama.ai/",
      "Start Ollama service on your machine",
      "Run 'ollama pull llama2' to download the model",
      "Verify the model is available with 'ollama list'",
      "The default configuration should work if Ollama is running on localhost:11434",
    ],
  },
  {
    id: "ollama-codellama",
    name: "Ollama Code Llama",
    provider: "ollama",
    description:
      "Meta's Code Llama model optimized for code generation and programming tasks",
    defaultSettings: {
      modelName: "codellama",
      baseUrl: "http://localhost:11434/v1",
      apiKey: "",
      temperature: 0.1,
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0,
      requestsPerMinute: 1000,
    },
    requiredFields: [],
    helpText:
      "Requires Ollama to be installed and running locally with the codellama model",
    documentationUrl: "https://ollama.ai/",
    setupInstructions: [
      "Install Ollama from https://ollama.ai/",
      "Start Ollama service on your machine",
      "Run 'ollama pull codellama' to download the model",
      "Verify the model is available with 'ollama list'",
      "The default configuration should work if Ollama is running on localhost:11434",
    ],
  },
  {
    id: "lmstudio-local",
    name: "LM Studio Local",
    provider: "lmstudio",
    description: "Local model running via LM Studio with OpenAI-compatible API",
    defaultSettings: {
      modelName: "local-model",
      baseUrl: "http://localhost:1234/v1",
      apiKey: "",
      temperature: 0.7,
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsSystemMessages: true,
      costPerToken: 0,
      requestsPerMinute: 1000,
    },
    requiredFields: ["modelName"],
    helpText:
      "Requires LM Studio to be running with a loaded model and local server enabled",
    documentationUrl: "https://lmstudio.ai/",
    setupInstructions: [
      "Download and install LM Studio from https://lmstudio.ai/",
      "Download a model in LM Studio (e.g., Llama 2, Mistral, etc.)",
      "Load the model in LM Studio",
      "Start the local server in LM Studio (usually on port 1234)",
      "Update the model name to match the loaded model",
      "Verify the server is accessible at http://localhost:1234",
    ],
  },
];

/**
 * Get all available provider templates
 */
export function getProviderTemplates(): ProviderTemplate[] {
  return PROVIDER_TEMPLATES;
}

/**
 * Get a specific provider template by ID
 */
export function getProviderTemplate(id: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((template) => template.id === id);
}

/**
 * Get provider templates filtered by provider type
 */
export function getProviderTemplatesByType(
  provider: ModelConfig["provider"],
): ProviderTemplate[] {
  return PROVIDER_TEMPLATES.filter(
    (template) => template.provider === provider,
  );
}

/**
 * Get provider templates that don't require API keys (local providers)
 */
export function getLocalProviderTemplates(): ProviderTemplate[] {
  return PROVIDER_TEMPLATES.filter(
    (template) =>
      template.requiredFields.length === 0 ||
      !template.requiredFields.includes("apiKey"),
  );
}

/**
 * Get provider templates that require API keys (cloud providers)
 */
export function getCloudProviderTemplates(): ProviderTemplate[] {
  return PROVIDER_TEMPLATES.filter((template) =>
    template.requiredFields.includes("apiKey"),
  );
}
