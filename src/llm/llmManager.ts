import * as vscode from "vscode";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import {
  ProviderStatus,
  ProviderMetrics,
  ValidationResult,
  ProviderTemplate,
  ProviderError,
  CircuitBreakerState,
} from "./providerTypes";
import { getProviderTemplates, getProviderTemplate } from "./providerTemplates";

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
  scope?: "workspace" | "global"; // Configuration scope
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
  private secretStorage: vscode.SecretStorage;

  // Error handling infrastructure
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private errorHistory: Map<string, ProviderError[]> = new Map();
  private outputChannel: vscode.OutputChannel;
  private readonly maxErrorHistory = 50;
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerTimeout = 60000; // 1 minute
  private readonly requestTimeout = 30000; // 30 seconds

  // Performance optimization infrastructure
  private clientPool: Map<
    string,
    { client: any; lastUsed: number; inUse: boolean }
  > = new Map();
  private readonly maxPoolSize = 10;
  private readonly clientIdleTimeout = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | undefined;

  // Health check infrastructure
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private readonly healthCheckIntervalMs = 300000; // 5 minutes
  private readonly healthCheckEnabled = true;

  constructor(private context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
    this.outputChannel = vscode.window.createOutputChannel(
      "SpecCode Provider Manager",
    );
    this.loadModels();

    // Start client pool cleanup
    this.startClientPoolCleanup();

    // Start periodic health checks
    this.startPeriodicHealthChecks();

    // Perform one-time migration of existing credentials
    this.migrateCredentialsToSecureStorage().catch((error) => {
      this.handleSystemError(
        error,
        "credential-migration",
        "Failed to migrate credentials to secure storage",
      );
    });
  }

  private async loadModels() {
    const models = await this.loadProvidersFromConfig();

    for (const model of models) {
      // Load API key from secure storage
      const apiKey = await this.getSecureApiKey(model.id);
      const modelWithKey = { ...model, apiKey: apiKey || "" };

      this.models.set(model.id, modelWithKey);
      this.initializeClient(modelWithKey);
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

  // ==================== SECURE CREDENTIAL MANAGEMENT ====================

  /**
   * Store API key securely using VS Code SecretStorage
   */
  private async storeSecureApiKey(
    providerId: string,
    apiKey: string,
  ): Promise<void> {
    if (!apiKey || apiKey.trim() === "") {
      return;
    }

    const secretKey = `specCode.provider.${providerId}.apiKey`;
    await this.secretStorage.store(secretKey, apiKey);
  }

  /**
   * Retrieve API key securely from VS Code SecretStorage
   */
  private async getSecureApiKey(
    providerId: string,
  ): Promise<string | undefined> {
    const secretKey = `specCode.provider.${providerId}.apiKey`;
    return await this.secretStorage.get(secretKey);
  }

  /**
   * Delete API key from secure storage
   */
  private async deleteSecureApiKey(providerId: string): Promise<void> {
    const secretKey = `specCode.provider.${providerId}.apiKey`;
    await this.secretStorage.delete(secretKey);
  }

  /**
   * Clear all stored API keys (for security/cleanup)
   */
  async clearAllSecureCredentials(): Promise<void> {
    const models = Array.from(this.models.values());
    for (const model of models) {
      await this.deleteSecureApiKey(model.id);
    }
  }

  /**
   * Migrate existing API keys from configuration to secure storage
   */
  async migrateCredentialsToSecureStorage(): Promise<void> {
    const config = vscode.workspace.getConfiguration("specCode");
    const models = config.get<ModelConfig[]>("models", []);
    const migratedModels: ModelConfig[] = [];
    let migrationCount = 0;

    for (const model of models) {
      if (model.apiKey && model.apiKey.trim() !== "") {
        // Store in secure storage
        await this.storeSecureApiKey(model.id, model.apiKey);

        // Remove from configuration
        const sanitizedModel = { ...model, apiKey: "" };
        migratedModels.push(sanitizedModel);
        migrationCount++;
      } else {
        migratedModels.push(model);
      }
    }

    if (migrationCount > 0) {
      // Update configuration without API keys
      await config.update("models", migratedModels, true);

      vscode.window.showInformationMessage(
        `Migrated ${migrationCount} API key(s) to secure storage for enhanced security.`,
      );
    }
  }

  // ==================== WORKSPACE-SPECIFIC CONFIGURATION ====================

  /**
   * Get workspace-specific provider configuration
   */
  private getWorkspaceConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("specCode");
  }

  /**
   * Get global (user-level) provider configuration
   */
  private getGlobalConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("specCode", null);
  }

  /**
   * Save provider configuration with workspace scope preference
   */
  private async saveProviderConfig(
    models: ModelConfig[],
    scope: "workspace" | "global" = "workspace",
  ): Promise<void> {
    const config =
      scope === "workspace"
        ? this.getWorkspaceConfig()
        : this.getGlobalConfig();
    const target =
      scope === "workspace"
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;

    // Remove API keys from configuration (they're stored securely)
    const sanitizedModels = models.map((model) => ({ ...model, apiKey: "" }));

    await config.update("models", sanitizedModels, target);
  }

  /**
   * Load providers from both workspace and global configurations
   */
  private async loadProvidersFromConfig(): Promise<ModelConfig[]> {
    const workspaceConfig = this.getWorkspaceConfig();
    const globalConfig = this.getGlobalConfig();

    const workspaceModels = workspaceConfig.get<ModelConfig[]>("models", []);
    const globalModels = globalConfig.get<ModelConfig[]>("models", []);

    // Workspace models take precedence over global models with same ID
    const allModels = new Map<string, ModelConfig>();

    // Add global models first
    globalModels.forEach((model) => {
      allModels.set(model.id, { ...model, scope: "global" as any });
    });

    // Add workspace models (overriding global ones with same ID)
    workspaceModels.forEach((model) => {
      allModels.set(model.id, { ...model, scope: "workspace" as any });
    });

    return Array.from(allModels.values());
  }

  async addModel(model: ModelConfig): Promise<void> {
    // Store API key securely
    if (model.apiKey && model.apiKey.trim() !== "") {
      await this.storeSecureApiKey(model.id, model.apiKey);
    }

    // Store model configuration without API key
    const sanitizedModel = { ...model, apiKey: "" };
    this.models.set(model.id, model); // Keep full model in memory
    this.initializeClient(model);

    // Save to configuration without API key
    const config = vscode.workspace.getConfiguration("specCode");
    const models = config.get<ModelConfig[]>("models", []);
    models.push(sanitizedModel);
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

    // Store API key securely
    if (config.apiKey && config.apiKey.trim() !== "") {
      await this.storeSecureApiKey(config.id, config.apiKey);
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

    // Save to configuration without API key
    const sanitizedConfig = { ...config, apiKey: "" };
    const vsConfig = vscode.workspace.getConfiguration("specCode");
    const models = vsConfig.get<ModelConfig[]>("models", []);
    models.push(sanitizedConfig);
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

    // Update API key in secure storage if provided
    if (updates.apiKey !== undefined) {
      if (updates.apiKey && updates.apiKey.trim() !== "") {
        await this.storeSecureApiKey(id, updates.apiKey);
      } else {
        await this.deleteSecureApiKey(id);
      }
    }

    this.models.set(id, updated);
    this.initializeClient(updated);

    // Update configuration without API key
    const config = vscode.workspace.getConfiguration("specCode");
    const models = config.get<ModelConfig[]>("models", []);
    const index = models.findIndex((m) => m.id === id);
    if (index >= 0) {
      const sanitizedUpdated = { ...updated, apiKey: "" };
      models[index] = sanitizedUpdated;
      await config.update("models", models, true);
    }
  }

  async removeProvider(id: string): Promise<void> {
    // Remove API key from secure storage
    await this.deleteSecureApiKey(id);

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
    const model = this.models.get(id);
    if (!model) {
      return {
        success: false,
        error: `Provider ${id} not found`,
      };
    }

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
        if (result.success) {
          status.errorCount = 0; // Reset error count on success
          this.updateCircuitBreaker(id, true);
        } else {
          status.errorCount++;
          this.updateCircuitBreaker(id, false);
        }
      }

      // Update metrics
      this.updateProviderMetrics(
        id,
        result.success,
        result.success ? responseTime : undefined,
      );

      return result;
    } catch (error: any) {
      // Use comprehensive error handling
      let handledError: ProviderError;

      if (error.message.includes("timeout")) {
        handledError = await this.handleConnectionError(
          error,
          id,
          "test-connection",
        );
      } else if (
        error.message.includes("configuration") ||
        error.message.includes("api key")
      ) {
        handledError = this.handleConfigurationError(
          error,
          model,
          "test-connection",
        );
      } else {
        handledError = this.handleProviderError(error, id, "test-connection");
      }

      if (status) {
        status.state = "error";
        status.lastError = handledError.userMessage;
        status.errorCount++;
      }

      return {
        success: false,
        error: handledError.userMessage,
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

  // New template-based provider creation methods
  async getProviderTemplates(): Promise<ProviderTemplate[]> {
    return getProviderTemplates();
  }

  async createFromTemplate(
    templateId: string,
    customConfig: Partial<ModelConfig>,
  ): Promise<ModelConfig> {
    const template = getProviderTemplate(templateId);
    if (!template) {
      throw new Error(`Provider template ${templateId} not found`);
    }

    // Generate unique ID if not provided
    const id = customConfig.id || `${template.provider}-${Date.now()}`;

    // Merge template defaults with custom configuration
    const config: ModelConfig = {
      id,
      name: customConfig.name || template.name,
      provider: template.provider,
      modelName: template.defaultSettings.modelName || "",
      apiKey: customConfig.apiKey || "",
      temperature: template.defaultSettings.temperature || 0.7,
      maxTokens: template.defaultSettings.maxTokens || 4096,
      supportsTools: template.defaultSettings.supportsTools || false,
      supportsVision: template.defaultSettings.supportsVision || false,
      ...template.defaultSettings,
      ...customConfig,
      createdAt: Date.now(),
    };

    // Validate the merged configuration
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    // Add the provider
    await this.addProvider(config);

    return config;
  }

  // Configuration import/export functionality
  async exportConfiguration(): Promise<string> {
    const providers = Array.from(this.models.values());

    // Create export data excluding sensitive information
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      providers: providers.map((provider) => {
        // Exclude API keys and other sensitive data
        const { apiKey, ...safeConfig } = provider;
        return {
          ...safeConfig,
          // Mark that API key was excluded
          apiKeyRequired: !!apiKey,
        };
      }),
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importConfiguration(configJson: string): Promise<void> {
    let importData: any;

    try {
      importData = JSON.parse(configJson);
    } catch (error) {
      throw new Error("Invalid JSON format in configuration file");
    }

    // Validate import data structure
    if (!importData.providers || !Array.isArray(importData.providers)) {
      throw new Error("Invalid configuration format: missing providers array");
    }

    const importResults: {
      success: string[];
      failed: { id: string; error: string }[];
    } = {
      success: [],
      failed: [],
    };

    // Import each provider configuration
    for (const providerConfig of importData.providers) {
      try {
        // Restore the structure expected by ModelConfig
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKeyRequired: _apiKeyRequired, ...config } = providerConfig;

        // Generate new ID to avoid conflicts
        const newId = `imported-${config.provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const importConfig: ModelConfig = {
          ...config,
          id: newId,
          apiKey: "", // Will need to be set by user
          createdAt: Date.now(),
        };

        // Validate before importing
        const validation = this.validateConfiguration(importConfig);
        if (!validation.isValid) {
          importResults.failed.push({
            id: config.id || newId,
            error: `Validation failed: ${validation.errors.join(", ")}`,
          });
          continue;
        }

        // Add the provider (this will handle storage)
        await this.addProvider(importConfig);
        importResults.success.push(importConfig.name || importConfig.id);
      } catch (error: any) {
        importResults.failed.push({
          id: providerConfig.id || "unknown",
          error: error.message || String(error),
        });
      }
    }

    // Show results to user
    if (importResults.success.length > 0) {
      vscode.window.showInformationMessage(
        `Successfully imported ${importResults.success.length} provider(s): ${importResults.success.join(", ")}`,
      );
    }

    if (importResults.failed.length > 0) {
      const failedMessage = importResults.failed
        .map((f) => `${f.id}: ${f.error}`)
        .join("; ");
      vscode.window.showWarningMessage(
        `Failed to import ${importResults.failed.length} provider(s): ${failedMessage}`,
      );
    }

    if (
      importResults.success.length === 0 &&
      importResults.failed.length === 0
    ) {
      vscode.window.showWarningMessage(
        "No providers found in configuration file",
      );
    }
  }

  // Provider selection and phase management methods
  async setActiveProvider(id: string): Promise<void> {
    const provider = this.models.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }

    // Test the provider before setting it as active
    const testResult = await this.testProviderConnection(id, 10000); // 10s timeout
    if (!testResult.success) {
      throw new Error(`Cannot set provider as active: ${testResult.error}`);
    }

    // Update the active provider setting
    const config = vscode.workspace.getConfiguration("specCode");
    await config.update("activeProvider", id, true);

    // Update last used timestamp
    provider.lastUsedAt = Date.now();
    await this.updateProvider(id, { lastUsedAt: provider.lastUsedAt });
  }

  getActiveProvider(): ModelConfig | undefined {
    const config = vscode.workspace.getConfiguration("specCode");
    const activeProviderId = config.get<string>("activeProvider", "");

    if (activeProviderId && this.models.has(activeProviderId)) {
      return this.models.get(activeProviderId);
    }

    // Fallback to first available provider
    const firstProvider = this.models.values().next().value;
    return firstProvider;
  }

  async setPhaseProvider(phase: string, providerId: string): Promise<void> {
    const provider = this.models.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const config = vscode.workspace.getConfiguration("specCode");
    const phaseProviders = config.get<Record<string, string>>(
      "phaseProviders",
      {},
    );

    phaseProviders[phase] = providerId;
    await config.update("phaseProviders", phaseProviders, true);
  }

  async getPhaseProvider(phase: string): Promise<string> {
    const config = vscode.workspace.getConfiguration("specCode");
    const phaseProviders = config.get<Record<string, string>>(
      "phaseProviders",
      {},
    );

    const providerId = phaseProviders[phase];
    if (providerId && this.models.has(providerId)) {
      return providerId;
    }

    // Fallback to active provider or first available
    const activeProvider = this.getActiveProvider();
    return activeProvider?.id || "";
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
    // Remove API key from secure storage
    await this.deleteSecureApiKey(modelId);

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

    // Execute with circuit breaker protection and timeout
    return this.executeWithCircuitBreaker(modelId, async () => {
      const startTime = Date.now();

      try {
        // Add timeout to the operation
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Request timeout")),
            this.requestTimeout,
          );
        });

        const generatePromise = this.performGenerate(client, model, messages);
        const result = await Promise.race([generatePromise, timeoutPromise]);

        // Update metrics on success
        const responseTime = Date.now() - startTime;
        this.updateProviderStatus(modelId, {
          state: "online",
          responseTime,
          errorCount: 0,
        });
        this.updateProviderMetrics(modelId, true, responseTime);

        return result;
      } catch (error) {
        // Handle different types of errors
        if (error instanceof Error) {
          if (error.message.includes("timeout")) {
            throw await this.handleConnectionError(error, modelId, "generate");
          } else if (
            error.message.includes("configuration") ||
            error.message.includes("api key")
          ) {
            throw this.handleConfigurationError(error, model, "generate");
          } else {
            throw this.handleProviderError(error, modelId, "generate");
          }
        }
        throw error;
      }
    });
  }

  private async performGenerate(
    client: any,
    model: ModelConfig,
    messages: Message[],
  ): Promise<LLMResponse> {
    // Get client from pool for better performance
    const pooledClient = this.getOrCreateClient(model);

    try {
      let result: LLMResponse;

      switch (model.provider) {
        case "anthropic":
          result = await this.generateAnthropic(pooledClient, model, messages);
          break;
        case "openai":
        case "ollama":
        case "lmstudio":
        case "custom":
        case "xai":
        case "azure":
        case "qwen":
        case "kimi":
          result = await this.generateOpenAI(pooledClient, model, messages);
          break;
        case "google":
          result = await this.generateGoogle(pooledClient, model, messages);
          break;
        default:
          throw new Error(`Unknown provider: ${model.provider}`);
      }

      return result;
    } finally {
      // Release client back to pool
      this.releaseClient(model.id);
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

  // ===== ERROR HANDLING METHODS =====

  /**
   * Handle configuration errors with user-friendly messages
   */
  private handleConfigurationError(
    error: Error,
    config: ModelConfig,
    operation: string,
  ): ProviderError {
    const providerError: ProviderError = {
      type: "configuration",
      code: "CONFIG_ERROR",
      message: error.message,
      details: { config: { ...config, apiKey: "[REDACTED]" }, operation },
      timestamp: Date.now(),
      providerId: config.id,
      retryable: false,
      userMessage: this.getConfigurationErrorMessage(error, config),
    };

    this.logError(providerError);
    this.addToErrorHistory(config.id, providerError);

    // Update provider status
    this.updateProviderStatus(config.id, {
      state: "error",
      lastError: providerError.userMessage,
      errorCount: (this.providerStatuses.get(config.id)?.errorCount || 0) + 1,
    });

    // Show user-friendly error message
    vscode.window
      .showErrorMessage(
        `Configuration error for ${config.name}: ${providerError.userMessage}`,
        "Open Settings",
      )
      .then((selection) => {
        if (selection === "Open Settings") {
          vscode.commands.executeCommand("specCode.openProviderSetup");
        }
      });

    return providerError;
  }

  /**
   * Handle connection errors with retry logic
   */
  private async handleConnectionError(
    error: Error,
    providerId: string,
    operation: string,
  ): Promise<ProviderError> {
    const provider = this.models.get(providerId);
    const providerError: ProviderError = {
      type: "connection",
      code: this.getConnectionErrorCode(error),
      message: error.message,
      details: { providerId, operation, stack: error.stack },
      timestamp: Date.now(),
      providerId,
      retryable: this.isRetryableError(error),
      userMessage: this.getConnectionErrorMessage(
        error,
        provider?.name || providerId,
      ),
    };

    this.logError(providerError);
    this.addToErrorHistory(providerId, providerError);

    // Update circuit breaker
    this.updateCircuitBreaker(providerId, false);

    // Update provider status
    this.updateProviderStatus(providerId, {
      state: "error",
      lastError: providerError.userMessage,
      errorCount: (this.providerStatuses.get(providerId)?.errorCount || 0) + 1,
    });

    // Show contextual error message with troubleshooting
    const actions = ["Retry", "Check Network", "Provider Status"];
    const selection = await vscode.window.showErrorMessage(
      `Connection error for ${provider?.name || providerId}: ${providerError.userMessage}`,
      ...actions,
    );

    if (selection === "Retry" && providerError.retryable) {
      // Implement exponential backoff retry
      await this.retryWithBackoff(providerId, operation);
    } else if (selection === "Check Network") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://docs.specCode.ai/troubleshooting/network"),
      );
    } else if (selection === "Provider Status") {
      vscode.commands.executeCommand("specCode.openProviderSetup");
    }

    return providerError;
  }

  /**
   * Handle provider-specific errors
   */
  private handleProviderError(
    error: Error,
    providerId: string,
    operation: string,
  ): ProviderError {
    const provider = this.models.get(providerId);
    const providerError: ProviderError = {
      type: "provider",
      code: this.getProviderErrorCode(error),
      message: error.message,
      details: { providerId, operation, provider: provider?.provider },
      timestamp: Date.now(),
      providerId,
      retryable: this.isProviderErrorRetryable(error),
      userMessage: this.getProviderErrorMessage(error, provider),
    };

    this.logError(providerError);
    this.addToErrorHistory(providerId, providerError);

    // Update provider metrics
    this.updateProviderMetrics(providerId, false);

    // Show provider-specific error message
    const actions = this.getProviderErrorActions(error);
    vscode.window
      .showErrorMessage(
        `${provider?.name || providerId}: ${providerError.userMessage}`,
        ...actions,
      )
      .then((selection) => {
        this.handleProviderErrorAction(selection, providerId);
      });

    return providerError;
  }

  /**
   * Handle system errors
   */
  private handleSystemError(
    error: Error,
    code: string,
    context: string,
  ): ProviderError {
    const systemError: ProviderError = {
      type: "system",
      code,
      message: error.message,
      details: { context, stack: error.stack },
      timestamp: Date.now(),
      retryable: false,
      userMessage: `System error: ${context}. Please check the output channel for details.`,
    };

    this.logError(systemError);

    vscode.window
      .showErrorMessage(systemError.userMessage, "View Logs")
      .then((selection) => {
        if (selection === "View Logs") {
          this.outputChannel.show();
        }
      });

    return systemError;
  }

  /**
   * Log errors to VS Code output channel
   */
  private logError(error: ProviderError): void {
    const timestamp = new Date(error.timestamp).toISOString();
    const logMessage = [
      `[${timestamp}] ${error.type.toUpperCase()} ERROR`,
      `Provider: ${error.providerId || "system"}`,
      `Code: ${error.code}`,
      `Message: ${error.message}`,
      `Retryable: ${error.retryable}`,
      `Details: ${JSON.stringify(error.details, null, 2)}`,
      "---",
    ].join("\n");

    this.outputChannel.appendLine(logMessage);
  }

  /**
   * Add error to provider error history
   */
  private addToErrorHistory(providerId: string, error: ProviderError): void {
    if (!this.errorHistory.has(providerId)) {
      this.errorHistory.set(providerId, []);
    }

    const history = this.errorHistory.get(providerId)!;
    history.unshift(error);

    // Keep only the most recent errors
    if (history.length > this.maxErrorHistory) {
      history.splice(this.maxErrorHistory);
    }
  }

  /**
   * Get provider error history
   */
  getProviderErrorHistory(providerId: string): ProviderError[] {
    return this.errorHistory.get(providerId) || [];
  }

  /**
   * Clear error history for a provider
   */
  clearProviderErrorHistory(providerId: string): void {
    this.errorHistory.delete(providerId);

    // Reset error count in status
    const status = this.providerStatuses.get(providerId);
    if (status) {
      this.updateProviderStatus(providerId, {
        ...status,
        errorCount: 0,
        lastError: undefined,
      });
    }
  }

  // ===== ERROR MESSAGE HELPERS =====

  private getConfigurationErrorMessage(
    error: Error,
    config: ModelConfig,
  ): string {
    const message = error.message.toLowerCase();

    if (message.includes("api key") || message.includes("apikey")) {
      return "Invalid or missing API key. Please check your API key configuration.";
    }
    if (message.includes("base url") || message.includes("baseurl")) {
      return "Invalid base URL. Please verify the endpoint URL is correct.";
    }
    if (message.includes("model") && message.includes("not found")) {
      return `Model "${config.modelName}" not found. Please check if the model name is correct.`;
    }
    if (message.includes("required field")) {
      return "Missing required configuration fields. Please complete all required settings.";
    }

    return `Configuration validation failed: ${error.message}`;
  }

  private getConnectionErrorMessage(
    error: Error,
    providerName: string,
  ): string {
    const message = error.message.toLowerCase();

    if (message.includes("timeout")) {
      return "Request timed out. Please check your internet connection and try again.";
    }
    if (message.includes("network") || message.includes("enotfound")) {
      return "Network error. Please check your internet connection and firewall settings.";
    }
    if (message.includes("ssl") || message.includes("certificate")) {
      return "SSL certificate error. Please check your network security settings.";
    }
    if (message.includes("proxy")) {
      return "Proxy configuration error. Please check your proxy settings.";
    }
    if (message.includes("401") || message.includes("unauthorized")) {
      return "Authentication failed. Please check your API key.";
    }
    if (message.includes("403") || message.includes("forbidden")) {
      return "Access denied. Please check your API key permissions.";
    }
    if (message.includes("429") || message.includes("rate limit")) {
      return "Rate limit exceeded. Please wait before trying again.";
    }
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503")
    ) {
      return `${providerName} service is temporarily unavailable. Please try again later.`;
    }

    return `Connection failed: ${error.message}`;
  }

  private getProviderErrorMessage(
    error: Error,
    provider?: ModelConfig,
  ): string {
    if (!provider) {
      return error.message;
    }

    const message = error.message.toLowerCase();
    const providerType = provider.provider;

    // Provider-specific error messages
    switch (providerType) {
      case "anthropic":
        if (message.includes("credit")) {
          return "Insufficient credits. Please check your Anthropic account balance.";
        }
        if (message.includes("content policy")) {
          return "Content blocked by safety filters. Please modify your request.";
        }
        break;

      case "openai":
        if (message.includes("quota")) {
          return "API quota exceeded. Please check your OpenAI usage limits.";
        }
        if (message.includes("model not found")) {
          return `Model "${provider.modelName}" not available. Please check your model access.`;
        }
        break;

      case "google":
        if (message.includes("safety")) {
          return "Content blocked by Gemini safety settings. Please adjust your safety configuration.";
        }
        break;

      case "ollama":
        if (message.includes("model not found")) {
          return `Model "${provider.modelName}" not installed in Ollama. Please pull the model first.`;
        }
        if (message.includes("connection refused")) {
          return "Ollama service not running. Please start Ollama and try again.";
        }
        break;

      case "lmstudio":
        if (message.includes("connection refused")) {
          return "LM Studio server not running. Please start the local server.";
        }
        break;
    }

    return error.message;
  }

  // ===== ERROR CODE HELPERS =====

  private getConnectionErrorCode(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes("timeout")) {
      return "TIMEOUT";
    }
    if (message.includes("enotfound")) {
      return "DNS_ERROR";
    }
    if (message.includes("econnrefused")) {
      return "CONNECTION_REFUSED";
    }
    if (message.includes("ssl")) {
      return "SSL_ERROR";
    }
    if (message.includes("401")) {
      return "UNAUTHORIZED";
    }
    if (message.includes("403")) {
      return "FORBIDDEN";
    }
    if (message.includes("429")) {
      return "RATE_LIMITED";
    }
    if (message.includes("500")) {
      return "SERVER_ERROR";
    }
    if (message.includes("502")) {
      return "BAD_GATEWAY";
    }
    if (message.includes("503")) {
      return "SERVICE_UNAVAILABLE";
    }

    return "CONNECTION_ERROR";
  }

  private getProviderErrorCode(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes("credit") || message.includes("quota")) {
      return "INSUFFICIENT_CREDITS";
    }
    if (message.includes("model not found")) {
      return "MODEL_NOT_FOUND";
    }
    if (message.includes("content policy") || message.includes("safety")) {
      return "CONTENT_FILTERED";
    }
    if (message.includes("rate limit")) {
      return "RATE_LIMITED";
    }

    return "PROVIDER_ERROR";
  }

  // ===== ERROR RETRY HELPERS =====

  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Non-retryable errors
    if (message.includes("401") || message.includes("403")) {
      return false;
    }
    if (message.includes("api key")) {
      return false;
    }
    if (message.includes("model not found")) {
      return false;
    }

    // Retryable errors
    if (message.includes("timeout")) {
      return true;
    }
    if (message.includes("429")) {
      return true;
    }
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503")
    ) {
      return true;
    }
    if (message.includes("network")) {
      return true;
    }

    return false;
  }

  private isProviderErrorRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Generally non-retryable provider errors
    if (message.includes("credit") || message.includes("quota")) {
      return false;
    }
    if (message.includes("content policy") || message.includes("safety")) {
      return false;
    }
    if (message.includes("model not found")) {
      return false;
    }

    return this.isRetryableError(error);
  }

  private getProviderErrorActions(error: Error): string[] {
    const message = error.message.toLowerCase();
    const actions: string[] = [];

    if (message.includes("credit") || message.includes("quota")) {
      actions.push("Check Account");
    }
    if (message.includes("model not found")) {
      actions.push("Browse Models");
    }
    if (message.includes("api key")) {
      actions.push("Update API Key");
    }
    if (this.isProviderErrorRetryable(error)) {
      actions.push("Retry");
    }

    actions.push("View Logs");
    return actions;
  }

  private async handleProviderErrorAction(
    action: string | undefined,
    providerId: string,
  ): Promise<void> {
    if (!action) {
      return;
    }

    switch (action) {
      case "Check Account": {
        const provider = this.models.get(providerId);
        if (provider) {
          const template = getProviderTemplate(provider.provider);
          if (template?.documentationUrl) {
            vscode.env.openExternal(
              vscode.Uri.parse(template.documentationUrl),
            );
          }
        }
        break;
      }

      case "Browse Models":
        vscode.commands.executeCommand("specCode.openProviderSetup");
        break;

      case "Update API Key":
        vscode.commands.executeCommand("specCode.editProvider", providerId);
        break;

      case "Retry":
        // Implement retry logic
        await this.retryWithBackoff(providerId, "generate");
        break;

      case "View Logs":
        this.outputChannel.show();
        break;
    }
  }

  // ===== RETRY LOGIC =====

  private async retryWithBackoff(
    providerId: string,
    operation: string,
    attempt: number = 1,
  ): Promise<void> {
    const maxAttempts = 3;
    const baseDelay = 1000; // 1 second

    if (attempt > maxAttempts) {
      vscode.window.showErrorMessage(
        `Failed to ${operation} after ${maxAttempts} attempts`,
      );
      return;
    }

    const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff

    vscode.window.showInformationMessage(
      `Retrying ${operation} for provider (attempt ${attempt}/${maxAttempts})...`,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      // This would be implemented based on the specific operation
      // For now, just test the connection
      await this.testProviderConnection(providerId);
      vscode.window.showInformationMessage(
        `${operation} succeeded on attempt ${attempt}`,
      );
    } catch (error) {
      await this.retryWithBackoff(providerId, operation, attempt + 1);
    }
  }

  // ===== HELPER METHODS =====

  private updateProviderStatus(
    providerId: string,
    updates: Partial<ProviderStatus>,
  ): void {
    const currentStatus = this.providerStatuses.get(providerId) || {
      state: "offline",
      lastChecked: 0,
      responseTime: 0,
      errorCount: 0,
    };

    this.providerStatuses.set(providerId, {
      ...currentStatus,
      ...updates,
      lastChecked: Date.now(),
    });
  }

  private updateProviderMetrics(
    providerId: string,
    success: boolean,
    responseTime?: number,
  ): void {
    const currentMetrics = this.providerMetrics.get(providerId) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
      lastUsed: 0,
    };

    const newTotalRequests = currentMetrics.totalRequests + 1;
    const newSuccessfulRequests = success
      ? currentMetrics.successfulRequests + 1
      : currentMetrics.successfulRequests;
    const newFailedRequests = success
      ? currentMetrics.failedRequests
      : currentMetrics.failedRequests + 1;

    // Calculate new average response time if provided
    let newAverageResponseTime = currentMetrics.averageResponseTime;
    if (responseTime !== undefined && success) {
      if (currentMetrics.totalRequests === 0) {
        newAverageResponseTime = responseTime;
      } else {
        // Weighted average
        newAverageResponseTime =
          (currentMetrics.averageResponseTime *
            currentMetrics.successfulRequests +
            responseTime) /
          newSuccessfulRequests;
      }
    }

    this.providerMetrics.set(providerId, {
      totalRequests: newTotalRequests,
      successfulRequests: newSuccessfulRequests,
      failedRequests: newFailedRequests,
      averageResponseTime: newAverageResponseTime,
      uptime:
        newTotalRequests > 0
          ? (newSuccessfulRequests / newTotalRequests) * 100
          : 0,
      lastUsed: Date.now(),
    });
  }

  // ===== CIRCUIT BREAKER IMPLEMENTATION =====

  /**
   * Update circuit breaker state based on operation success/failure
   */
  private updateCircuitBreaker(providerId: string, success: boolean): void {
    let breaker = this.circuitBreakers.get(providerId);

    if (!breaker) {
      breaker = {
        state: "closed",
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      };
      this.circuitBreakers.set(providerId, breaker);
    }

    if (success) {
      // Reset on success
      breaker.failureCount = 0;
      breaker.state = "closed";
    } else {
      // Increment failure count
      breaker.failureCount++;
      breaker.lastFailureTime = Date.now();

      // Open circuit if threshold exceeded
      if (breaker.failureCount >= this.circuitBreakerThreshold) {
        breaker.state = "open";
        breaker.nextAttemptTime = Date.now() + this.circuitBreakerTimeout;

        vscode.window.showWarningMessage(
          `Circuit breaker opened for provider ${this.models.get(providerId)?.name || providerId}. ` +
            `Will retry in ${this.circuitBreakerTimeout / 1000} seconds.`,
        );
      }
    }
  }

  /**
   * Check if circuit breaker allows operation
   */
  private canExecuteOperation(providerId: string): boolean {
    const breaker = this.circuitBreakers.get(providerId);

    if (!breaker || breaker.state === "closed") {
      return true;
    }

    if (breaker.state === "open") {
      if (Date.now() >= breaker.nextAttemptTime) {
        // Transition to half-open
        breaker.state = "half-open";
        return true;
      }
      return false;
    }

    // Half-open state - allow one attempt
    return true;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  private async executeWithCircuitBreaker<T>(
    providerId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this.canExecuteOperation(providerId)) {
      const breaker = this.circuitBreakers.get(providerId)!;
      const waitTime = Math.ceil((breaker.nextAttemptTime - Date.now()) / 1000);
      throw new Error(
        `Circuit breaker is open for provider ${providerId}. ` +
          `Please wait ${waitTime} seconds before retrying.`,
      );
    }

    try {
      const result = await operation();
      this.updateCircuitBreaker(providerId, true);
      return result;
    } catch (error) {
      this.updateCircuitBreaker(providerId, false);
      throw error;
    }
  }

  /**
   * Get circuit breaker state for a provider
   */
  getCircuitBreakerState(providerId: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(providerId);
  }

  /**
   * Reset circuit breaker for a provider
   */
  resetCircuitBreaker(providerId: string): void {
    this.circuitBreakers.delete(providerId);
    vscode.window.showInformationMessage(
      `Circuit breaker reset for provider ${this.models.get(providerId)?.name || providerId}`,
    );
  }

  /**
   * Get all circuit breaker states
   */
  getAllCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  // ===== HEALTH CHECK METHODS =====

  /**
   * Start periodic health checks for all providers
   */
  private startPeriodicHealthChecks(): void {
    if (!this.healthCheckEnabled) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckIntervalMs);

    // Perform initial health check after a short delay
    setTimeout(() => {
      this.performHealthChecks();
    }, 5000);
  }

  /**
   * Stop periodic health checks
   */
  private stopPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<void> {
    const providers = Array.from(this.models.values());

    for (const provider of providers) {
      try {
        // Skip health check if circuit breaker is open
        if (!this.canExecuteOperation(provider.id)) {
          continue;
        }

        // Perform lightweight health check (shorter timeout)
        await this.testProviderConnection(provider.id, 10000);
      } catch (error) {
        // Health check failure is already handled by testProviderConnection
        this.outputChannel.appendLine(
          `Health check failed for provider ${provider.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Get provider metrics
   */
  getProviderMetrics(id: string): ProviderMetrics | undefined {
    return this.providerMetrics.get(id);
  }

  /**
   * Get all provider metrics
   */
  getAllProviderMetrics(): Map<string, ProviderMetrics> {
    return new Map(this.providerMetrics);
  }

  /**
   * Calculate provider uptime percentage
   */
  calculateProviderUptime(id: string): number {
    const metrics = this.providerMetrics.get(id);
    if (!metrics || metrics.totalRequests === 0) {
      return 0;
    }

    return (metrics.successfulRequests / metrics.totalRequests) * 100;
  }

  /**
   * Get provider performance summary
   */
  getProviderPerformanceSummary(id: string):
    | {
        uptime: number;
        averageResponseTime: number;
        successRate: number;
        totalRequests: number;
        lastUsed: number;
      }
    | undefined {
    const metrics = this.providerMetrics.get(id);
    const status = this.providerStatuses.get(id);

    if (!metrics) {
      return undefined;
    }

    return {
      uptime: this.calculateProviderUptime(id),
      averageResponseTime: status?.responseTime || 0,
      successRate:
        metrics.totalRequests > 0
          ? (metrics.successfulRequests / metrics.totalRequests) * 100
          : 0,
      totalRequests: metrics.totalRequests,
      lastUsed: metrics.lastUsed,
    };
  }

  /**
   * Reset provider metrics
   */
  resetProviderMetrics(id: string): void {
    this.providerMetrics.set(id, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
      lastUsed: 0,
    });

    this.updateProviderStatus(id, {
      errorCount: 0,
      lastError: undefined,
    });
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): Map<string, ProviderStatus> {
    return new Map(this.providerStatuses);
  }

  // ===== CONCURRENT PROVIDER SUPPORT =====

  /**
   * Execute requests concurrently across multiple providers
   */
  async generateConcurrent(
    requests: Array<{ modelId: string; messages: Message[] }>,
  ): Promise<Array<{ modelId: string; result?: LLMResponse; error?: string }>> {
    const promises = requests.map(async (request) => {
      try {
        const result = await this.generate(request.modelId, request.messages);
        return { modelId: request.modelId, result };
      } catch (error) {
        return {
          modelId: request.modelId,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Test multiple providers concurrently
   */
  async testProvidersConcurrent(
    providerIds: string[],
  ): Promise<Array<{ providerId: string; result: TestResult }>> {
    const promises = providerIds.map(async (providerId) => {
      const result = await this.testProviderConnection(providerId);
      return { providerId, result };
    });

    return Promise.all(promises);
  }

  /**
   * Get the fastest responding provider from a list
   */
  async getFastestProvider(
    providerIds: string[],
    testMessage: Message[] = [{ role: "user", content: "ping" }],
  ): Promise<{ providerId: string; responseTime: number } | null> {
    const promises = providerIds.map(async (providerId) => {
      const startTime = Date.now();
      try {
        await this.generate(providerId, testMessage);
        return { providerId, responseTime: Date.now() - startTime };
      } catch (error) {
        return { providerId, responseTime: Infinity };
      }
    });

    const results = await Promise.all(promises);
    const validResults = results.filter((r) => r.responseTime !== Infinity);

    if (validResults.length === 0) {
      return null;
    }

    return validResults.reduce((fastest, current) =>
      current.responseTime < fastest.responseTime ? current : fastest,
    );
  }

  /**
   * Load balance requests across multiple providers
   */
  async generateWithLoadBalancing(
    providerIds: string[],
    messages: Message[],
  ): Promise<LLMResponse> {
    // Filter to only available providers
    const availableProviders = providerIds.filter((id) => {
      const status = this.providerStatuses.get(id);
      return status?.state === "online" && this.canExecuteOperation(id);
    });

    if (availableProviders.length === 0) {
      throw new Error("No available providers for load balancing");
    }

    // Select provider with lowest current load (based on recent usage)
    const providerLoads = availableProviders.map((id) => {
      const metrics = this.providerMetrics.get(id);
      const recentUsage = metrics?.lastUsed || 0;
      const timeSinceLastUse = Date.now() - recentUsage;
      return { id, load: 1 / (timeSinceLastUse + 1) }; // Lower load for providers used less recently
    });

    const selectedProvider = providerLoads.reduce((lowest, current) =>
      current.load < lowest.load ? current : lowest,
    );

    return this.generate(selectedProvider.id, messages);
  }

  // ===== PERFORMANCE OPTIMIZATION =====

  /**
   * Start client pool cleanup interval
   */
  private startClientPoolCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleClients();
    }, 60000); // Run every minute
  }

  /**
   * Stop client pool cleanup interval
   */
  private stopClientPoolCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Clean up idle clients to optimize memory usage
   */
  private cleanupIdleClients(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [providerId, poolEntry] of this.clientPool.entries()) {
      if (
        !poolEntry.inUse &&
        now - poolEntry.lastUsed > this.clientIdleTimeout
      ) {
        toRemove.push(providerId);
      }
    }

    for (const providerId of toRemove) {
      this.clientPool.delete(providerId);
      this.outputChannel.appendLine(
        `Cleaned up idle client for provider: ${providerId}`,
      );
    }

    // Also clean up old clients map entries
    for (const [modelId] of this.clients.entries()) {
      const model = this.models.get(modelId);
      if (!model || !this.clientPool.has(modelId)) {
        this.clients.delete(modelId);
      }
    }
  }

  /**
   * Get or create a client with connection pooling
   */
  private getOrCreateClient(model: ModelConfig): any {
    const poolEntry = this.clientPool.get(model.id);

    if (poolEntry && !poolEntry.inUse) {
      // Reuse existing client
      poolEntry.inUse = true;
      poolEntry.lastUsed = Date.now();
      return poolEntry.client;
    }

    // Create new client if pool is not full
    if (this.clientPool.size < this.maxPoolSize) {
      const client = this.createNewClient(model);
      this.clientPool.set(model.id, {
        client,
        lastUsed: Date.now(),
        inUse: true,
      });
      return client;
    }

    // Pool is full, find least recently used client
    let oldestEntry: { id: string; lastUsed: number } | null = null;
    for (const [id, entry] of this.clientPool.entries()) {
      if (
        !entry.inUse &&
        (!oldestEntry || entry.lastUsed < oldestEntry.lastUsed)
      ) {
        oldestEntry = { id, lastUsed: entry.lastUsed };
      }
    }

    if (oldestEntry) {
      // Replace oldest client
      this.clientPool.delete(oldestEntry.id);
      const client = this.createNewClient(model);
      this.clientPool.set(model.id, {
        client,
        lastUsed: Date.now(),
        inUse: true,
      });
      return client;
    }

    // Fallback: create client without pooling
    return this.createNewClient(model);
  }

  /**
   * Release a client back to the pool
   */
  private releaseClient(modelId: string): void {
    const poolEntry = this.clientPool.get(modelId);
    if (poolEntry) {
      poolEntry.inUse = false;
      poolEntry.lastUsed = Date.now();
    }
  }

  /**
   * Create a new client instance
   */
  private createNewClient(model: ModelConfig): any {
    // Use the existing initializeClient logic
    return this.initializeClient(model);
  }

  /**
   * Get client pool statistics
   */
  getClientPoolStats(): {
    totalClients: number;
    activeClients: number;
    idleClients: number;
    maxPoolSize: number;
  } {
    let activeClients = 0;
    let idleClients = 0;

    for (const entry of this.clientPool.values()) {
      if (entry.inUse) {
        activeClients++;
      } else {
        idleClients++;
      }
    }

    return {
      totalClients: this.clientPool.size,
      activeClients,
      idleClients,
      maxPoolSize: this.maxPoolSize,
    };
  }

  /**
   * Clear all clients from pool
   */
  clearClientPool(): void {
    this.clientPool.clear();
    this.clients.clear();
    vscode.window.showInformationMessage("Client pool cleared");
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopClientPoolCleanup();
    this.stopPeriodicHealthChecks();
    this.clearClientPool();
    this.outputChannel.dispose();
  }
}
