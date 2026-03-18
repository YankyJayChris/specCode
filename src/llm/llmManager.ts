import * as vscode from "vscode";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import {
  ProviderStatus,
  ProviderMetrics,
  ValidationResult,
} from "./providerTypes";

export interface ModelConfig {
  id: string;
  name: string;
  provider:
    | "openai"
    | "anthropic"
    | "google"
    | "xai"
    | "ollama"
    | "lmstudio"
    | "azure"
    | "custom"
    | "qwen"
    | "kimi";
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;

  // New fields for enhanced functionality
  supportsStreaming?: boolean;
  supportsSystemMessages?: boolean;
  customHeaders?: Record<string, string>;

  // Provider-specific settings
  providerSettings?: {
    // Claude/Anthropic
    systemPromptHandling?: "separate" | "inline";

    // Gemini/Google
    safetySettings?: {
      harassment: "BLOCK_NONE" | "BLOCK_LOW" | "BLOCK_MEDIUM" | "BLOCK_HIGH";
      hateSpeech: "BLOCK_NONE" | "BLOCK_LOW" | "BLOCK_MEDIUM" | "BLOCK_HIGH";
      sexuallyExplicit:
        | "BLOCK_NONE"
        | "BLOCK_LOW"
        | "BLOCK_MEDIUM"
        | "BLOCK_HIGH";
      dangerousContent:
        | "BLOCK_NONE"
        | "BLOCK_LOW"
        | "BLOCK_MEDIUM"
        | "BLOCK_HIGH";
    };

    // Qwen
    chineseOptimization?: boolean;

    // Kimi
    longContextMode?: boolean;
    maxContextLength?: number;

    // Custom
    authType?: "bearer" | "api-key" | "custom";
    customAuthHeader?: string;
  };

  // Cost & Performance
  costPerToken?: number;
  requestsPerMinute?: number;

  // Metadata
  createdAt?: number;
  lastUsedAt?: number;
  tags?: string[];
  description?: string;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[]; // base64 encoded images
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: any[];
}

export interface TestResult {
  success: boolean;
  response?: string;
  error?: string;
}

export class LLMManager {
  private models: Map<string, ModelConfig> = new Map();
  private clients: Map<string, any> = new Map();
  private providerStatuses: Map<string, ProviderStatus> = new Map();
  private providerMetrics: Map<string, ProviderMetrics> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    this.loadModels();
  }

  private async loadModels() {
    const config = vscode.workspace.getConfiguration("specCode");
    const models = config.get<ModelConfig[]>("models", []);

    for (const model of models) {
      this.models.set(model.id, model);
      this.initializeClient(model);
    }
  }

  private initializeClient(model: ModelConfig) {
    switch (model.provider) {
      case "anthropic":
        this.clients.set(
          model.id,
          new Anthropic({
            apiKey: model.apiKey,
          }),
        );
        break;
      case "openai":
      case "lmstudio":
      case "custom":
        this.clients.set(
          model.id,
          new OpenAI({
            apiKey: model.apiKey || "not-needed",
            baseURL: model.baseUrl,
          }),
        );
        break;
      case "google":
        this.clients.set(model.id, new GoogleGenerativeAI(model.apiKey));
        break;
      case "ollama":
        // Ollama uses OpenAI-compatible API
        this.clients.set(
          model.id,
          new OpenAI({
            apiKey: "ollama",
            baseURL: model.baseUrl || "http://localhost:11434/v1",
          }),
        );
        break;
      case "xai":
        this.clients.set(
          model.id,
          new OpenAI({
            apiKey: model.apiKey,
            baseURL: "https://api.x.ai/v1",
          }),
        );
        break;
      case "azure":
        this.clients.set(
          model.id,
          new OpenAI({
            apiKey: model.apiKey,
            baseURL: model.baseUrl,
          }),
        );
        break;
      case "qwen":
        // Qwen uses OpenAI-compatible API
        this.clients.set(
          model.id,
          new OpenAI({
            apiKey: model.apiKey,
            baseURL: model.baseUrl || "https://dashscope.aliyuncs.com/api/v1",
          }),
        );
        break;
      case "kimi":
        // Kimi uses OpenAI-compatible API
        this.clients.set(
          model.id,
          new OpenAI({
            apiKey: model.apiKey,
            baseURL: model.baseUrl || "https://api.moonshot.cn/v1",
          }),
        );
        break;
    }
  }

  async addModel(model: ModelConfig): Promise<void> {
    this.models.set(model.id, model);
    this.initializeClient(model);

    // Save to configuration
    const config = vscode.workspace.getConfiguration("specCode");
    const models = config.get<ModelConfig[]>("models", []);
    models.push(model);
    await config.update("models", models, true);
  }

  // New provider management methods
  async addProvider(config: ModelConfig): Promise<void> {
    // Set creation timestamp
    config.createdAt = Date.now();

    // Validate configuration
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    this.models.set(config.id, config);
    this.initializeClient(config);

    // Initialize provider status and metrics
    this.providerStatuses.set(config.id, {
      state: "offline",
      lastChecked: 0,
      responseTime: 0,
      errorCount: 0,
    });

    this.providerMetrics.set(config.id, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
      lastUsed: 0,
    });

    // Save to configuration
    const vsConfig = vscode.workspace.getConfiguration("specCode");
    const models = vsConfig.get<ModelConfig[]>("models", []);
    models.push(config);
    await vsConfig.update("models", models, true);
  }

  async updateProvider(
    id: string,
    updates: Partial<ModelConfig>,
  ): Promise<void> {
    const existing = this.models.get(id);
    if (!existing) {
      throw new Error(`Provider ${id} not found`);
    }

    const updated = { ...existing, ...updates };

    // Validate updated configuration
    const validation = this.validateConfiguration(updated);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    this.models.set(id, updated);
    this.initializeClient(updated);

    // Update configuration
    const config = vscode.workspace.getConfiguration("specCode");
    const models = config.get<ModelConfig[]>("models", []);
    const index = models.findIndex((m) => m.id === id);
    if (index >= 0) {
      models[index] = updated;
      await config.update("models", models, true);
    }
  }

  async removeProvider(id: string): Promise<void> {
    this.models.delete(id);
    this.clients.delete(id);
    this.providerStatuses.delete(id);
    this.providerMetrics.delete(id);

    const config = vscode.workspace.getConfiguration("specCode");
    const models = config.get<ModelConfig[]>("models", []);
    const filtered = models.filter((m) => m.id !== id);
    await config.update("models", filtered, true);
  }

  getProviderStatus(id: string): ProviderStatus | undefined {
    return this.providerStatuses.get(id);
  }

  async testProviderConnection(
    id: string,
    timeoutMs: number = 30000,
  ): Promise<TestResult> {
    const status = this.providerStatuses.get(id);
    if (status) {
      status.state = "testing";
      status.lastChecked = Date.now();
    }

    try {
      const startTime = Date.now();

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(new Error(`Connection test timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      });

      // Race the test against the timeout
      const testPromise = this.testModel(id);
      const result = await Promise.race([testPromise, timeoutPromise]);

      const responseTime = Date.now() - startTime;

      if (status) {
        status.state = result.success ? "online" : "error";
        status.responseTime = responseTime;
        status.lastError = result.error;
        if (!result.success) {
          status.errorCount++;
        }
      }

      return result;
    } catch (error: any) {
      if (status) {
        status.state = "error";
        status.lastError = error.message;
        status.errorCount++;
      }

      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  validateConfiguration(config: ModelConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic field validation
    if (!config.id || config.id.trim() === "") {
      errors.push("Provider ID is required");
    }

    if (!config.name || config.name.trim() === "") {
      errors.push("Provider name is required");
    }

    if (!config.provider) {
      errors.push("Provider type is required");
    }

    if (!config.modelName || config.modelName.trim() === "") {
      errors.push("Model name is required");
    }

    // Provider-specific validation
    switch (config.provider) {
      case "anthropic":
        if (!config.apiKey || config.apiKey.trim() === "") {
          errors.push("API key is required for Anthropic");
        }
        break;

      case "openai":
      case "xai":
        if (!config.apiKey || config.apiKey.trim() === "") {
          errors.push("API key is required for OpenAI/xAI");
        }
        break;

      case "google":
        if (!config.apiKey || config.apiKey.trim() === "") {
          errors.push("API key is required for Google");
        }
        break;

      case "qwen":
        if (!config.apiKey || config.apiKey.trim() === "") {
          errors.push("API key is required for Qwen");
        }
        if (!config.baseUrl) {
          warnings.push("Base URL not specified, using default Qwen endpoint");
        }
        break;

      case "kimi":
        if (!config.apiKey || config.apiKey.trim() === "") {
          errors.push("API key is required for Kimi");
        }
        if (!config.baseUrl) {
          warnings.push("Base URL not specified, using default Kimi endpoint");
        }
        break;

      case "ollama":
      case "lmstudio":
        if (!config.baseUrl) {
          warnings.push(
            `Base URL not specified for ${config.provider}, using default`,
          );
        }
        break;

      case "custom":
        if (!config.baseUrl) {
          errors.push("Base URL is required for custom providers");
        }
        break;
    }

    // Numeric field validation
    if (config.temperature < 0 || config.temperature > 2) {
      warnings.push("Temperature should be between 0 and 2");
    }

    if (config.maxTokens <= 0) {
      errors.push("Max tokens must be greater than 0");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Provider discovery and auto-configuration methods
  async discoverLocalProviders(): Promise<ModelConfig[]> {
    const discovered: ModelConfig[] = [];

    // Try to detect Ollama
    try {
      const response = await axios.get("http://localhost:11434/api/tags", {
        timeout: 2000,
      });
      if (response.data && response.data.models) {
        for (const m of response.data.models) {
          discovered.push({
            id: `ollama-${m.name.replace(/[^a-zA-Z0-9-]/g, "-")}`,
            name: `Ollama: ${m.name}`,
            provider: "ollama",
            modelName: m.name,
            apiKey: "",
            baseUrl: "http://localhost:11434/v1",
            temperature: 0.7,
            maxTokens: 4096,
            supportsTools: false,
            supportsVision: false,
            supportsStreaming: true,
            createdAt: Date.now(),
          });
        }
      }
    } catch {
      // Ollama not running or not accessible
    }

    // Try to detect LM Studio
    try {
      const response = await axios.get("http://localhost:1234/v1/models", {
        timeout: 2000,
      });
      if (response.data && response.data.data) {
        for (const m of response.data.data) {
          discovered.push({
            id: `lmstudio-${m.id.replace(/[^a-zA-Z0-9-]/g, "-")}`,
            name: `LM Studio: ${m.id}`,
            provider: "lmstudio",
            modelName: m.id,
            apiKey: "",
            baseUrl: "http://localhost:1234/v1",
            temperature: 0.7,
            maxTokens: 4096,
            supportsTools: false,
            supportsVision: false,
            supportsStreaming: true,
            createdAt: Date.now(),
          });
        }
      }
    } catch {
      // LM Studio not running or not accessible
    }

    return discovered;
  }

  async refreshProviderAvailability(): Promise<void> {
    const providers = Array.from(this.models.values());

    for (const provider of providers) {
      if (provider.provider === "ollama" || provider.provider === "lmstudio") {
        try {
          await this.testProviderConnection(provider.id, 5000); // Quick 5s timeout for local providers
        } catch {
          // Update status will be handled by testProviderConnection
        }
      }
    }
  }

  async autoConfigureProvider(discoveredProvider: ModelConfig): Promise<void> {
    // Check if provider already exists
    const existing = Array.from(this.models.values()).find(
      (p) =>
        p.provider === discoveredProvider.provider &&
        p.modelName === discoveredProvider.modelName,
    );

    if (!existing) {
      await this.addProvider(discoveredProvider);
    }
  }

  async removeModel(modelId: string): Promise<void> {
    this.models.delete(modelId);
    this.clients.delete(modelId);

    const config = vscode.workspace.getConfiguration("specCode");
    const models = config.get<ModelConfig[]>("models", []);
    const filtered = models.filter((m) => m.id !== modelId);
    await config.update("models", filtered, true);
  }

  getModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  getModel(modelId: string): ModelConfig | undefined {
    return this.models.get(modelId);
  }

  async getDefaultModelForPhase(
    phase: "requirements" | "design" | "execution" | "hooks",
  ): Promise<string> {
    const config = vscode.workspace.getConfiguration("specCode");
    const settingKey = `default${phase.charAt(0).toUpperCase() + phase.slice(1)}Model`;
    const modelId = config.get<string>(settingKey, "");

    if (modelId && this.models.has(modelId)) {
      return modelId;
    }

    // Return first available model
    const firstModel = this.models.keys().next().value;
    if (!firstModel) {
      throw new Error(
        "No AI models configured. Please add a model in settings.",
      );
    }
    return firstModel;
  }

  async generate(modelId: string, messages: Message[]): Promise<LLMResponse> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const client = this.clients.get(modelId);
    if (!client) {
      throw new Error(`Client for model ${modelId} not initialized`);
    }

    switch (model.provider) {
      case "anthropic":
        return this.generateAnthropic(client, model, messages);
      case "openai":
      case "ollama":
      case "lmstudio":
      case "custom":
      case "xai":
      case "azure":
      case "qwen":
      case "kimi":
        return this.generateOpenAI(client, model, messages);
      case "google":
        return this.generateGoogle(client, model, messages);
      default:
        throw new Error(`Unknown provider: ${model.provider}`);
    }
  }

  private async generateAnthropic(
    client: Anthropic,
    model: ModelConfig,
    messages: Message[],
  ): Promise<LLMResponse> {
    const systemMessage =
      messages.find((m) => m.role === "system")?.content || "";
    const conversationMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const response = await client.messages.create({
      model: model.modelName,
      max_tokens: model.maxTokens,
      temperature: model.temperature,
      system: systemMessage,
      messages: conversationMessages,
    });

    return {
      content:
        response.content[0]?.type === "text" ? response.content[0].text : "",
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  private async generateOpenAI(
    client: OpenAI,
    model: ModelConfig,
    messages: Message[],
  ): Promise<LLMResponse> {
    const response = await client.chat.completions.create({
      model: model.modelName,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: model.temperature,
      max_tokens: model.maxTokens,
    });

    return {
      content: response.choices[0]?.message?.content || "",
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  private async generateGoogle(
    client: GoogleGenerativeAI,
    model: ModelConfig,
    messages: Message[],
  ): Promise<LLMResponse> {
    const genModel = client.getGenerativeModel({ model: model.modelName });

    const systemMessage =
      messages.find((m) => m.role === "system")?.content || "";
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const chat = genModel.startChat({
      history: conversationMessages.slice(0, -1).map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: model.temperature,
        maxOutputTokens: model.maxTokens,
      },
    });

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const messageContent = systemMessage
      ? `${systemMessage}\n\n${lastMessage.content}`
      : lastMessage.content;
    const result = await chat.sendMessage(messageContent);
    const response = await result.response;

    return {
      content: response.text(),
      usage: {
        promptTokens: 0, // Google doesn't always provide token counts
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  async generateWithTools(
    modelId: string,
    messages: Message[],
    tools: any[],
  ): Promise<LLMResponse> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!model.supportsTools) {
      // Fallback to regular generation
      return this.generate(modelId, messages);
    }

    const client = this.clients.get(modelId);

    // OpenAI-compatible tool calling
    if (
      [
        "openai",
        "ollama",
        "lmstudio",
        "custom",
        "xai",
        "azure",
        "qwen",
        "kimi",
      ].includes(model.provider)
    ) {
      const response = await client.chat.completions.create({
        model: model.modelName,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: tools,
        temperature: model.temperature,
        max_tokens: model.maxTokens,
      });

      return {
        content: response.choices[0]?.message?.content || "",
        toolCalls: response.choices[0]?.message?.tool_calls,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    }

    // Anthropic tool calling
    if (model.provider === "anthropic") {
      const systemMessage =
        messages.find((m) => m.role === "system")?.content || "";
      const conversationMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const response = await client.messages.create({
        model: model.modelName,
        max_tokens: model.maxTokens,
        temperature: model.temperature,
        system: systemMessage,
        messages: conversationMessages,
        tools: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters,
        })),
      });

      return {
        content:
          response.content[0]?.type === "text" ? response.content[0].text : "",
        toolCalls: response.content
          .filter((c: any) => c.type === "tool_use")
          .map((c: any) => ({
            id: c.id,
            function: {
              name: c.name,
              arguments: JSON.stringify(c.input),
            },
          })),
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    }

    throw new Error(
      `Tool calling not supported for provider: ${model.provider}`,
    );
  }

  async testModel(modelId: string): Promise<TestResult> {
    try {
      const response = await this.generate(modelId, [
        {
          role: "user",
          content: 'Say "Spec-Code connection successful!" and nothing else.',
        },
      ]);

      return {
        success: true,
        response: response.content,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  async streamGenerate(
    modelId: string,
    messages: Message[],
    onChunk: (chunk: string) => void,
  ): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const client = this.clients.get(modelId);

    if (
      [
        "openai",
        "ollama",
        "lmstudio",
        "custom",
        "xai",
        "azure",
        "qwen",
        "kimi",
      ].includes(model.provider)
    ) {
      const stream = await client.chat.completions.create({
        model: model.modelName,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: model.temperature,
        max_tokens: model.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk(content);
        }
      }
    } else if (model.provider === "anthropic") {
      const systemMessage =
        messages.find((m) => m.role === "system")?.content || "";
      const conversationMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const stream = await client.messages.create({
        model: model.modelName,
        max_tokens: model.maxTokens,
        temperature: model.temperature,
        system: systemMessage,
        messages: conversationMessages,
        stream: true,
      });

      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta?.type === "text_delta"
        ) {
          onChunk(chunk.delta.text);
        }
      }
    } else {
      // Fallback to non-streaming
      const response = await this.generate(modelId, messages);
      onChunk(response.content);
    }
  }

  estimateCost(modelId: string, tokens: number): number {
    const model = this.models.get(modelId);
    if (!model) {
      return 0;
    }

    // Rough cost estimates per 1K tokens (input + output averaged)
    const costs: Record<string, number> = {
      "gpt-4": 0.03,
      "gpt-4-turbo": 0.01,
      "gpt-3.5-turbo": 0.002,
      "claude-3-opus": 0.015,
      "claude-3-sonnet": 0.003,
      "claude-3-haiku": 0.00025,
      "gemini-pro": 0.0005,
      "gemini-ultra": 0.001,
    };

    const costPer1K = costs[model.modelName] || 0.001;
    return (tokens / 1000) * costPer1K;
  }

  async detectLocalModels(): Promise<ModelConfig[]> {
    // Use the new discoverLocalProviders method for consistency
    return this.discoverLocalProviders();
  }
}
