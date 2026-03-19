import * as vscode from "vscode";
import { LLMManager, ModelConfig } from "../llm/llmManager";
import {
  getProviderTemplates,
  ProviderTemplate,
} from "../llm/providerTemplates";
import { getProviderSetupHtml } from "./providerSetupWebview-html";

interface WebviewMessage {
  type: string;
  data?: any;
}

export class ProviderSetupWebviewProvider
  implements vscode.WebviewViewProvider
{
  private view?: vscode.WebviewView;
  private providers: ModelConfig[] = [];
  private templates: ProviderTemplate[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private llmManager: LLMManager,
  ) {
    this.loadProviders();
    this.loadTemplates();
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent();

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      try {
        await this.handleMessage(message);
      } catch (error: any) {
        this.postMessage("error", { message: error.message });
      }
    });

    // Send initial data
    this.sendProviders();
    this.sendTemplates();
  }

  private async handleMessage(message: WebviewMessage) {
    switch (message.type) {
      case "loadProviders":
        await this.loadProviders();
        this.sendProviders();
        break;

      case "loadTemplates":
        await this.loadTemplates();
        this.sendTemplates();
        break;

      case "addProvider":
        await this.handleAddProvider(message.data);
        break;

      case "editProvider":
        await this.handleEditProvider(message.data);
        break;

      case "removeProvider":
        await this.handleRemoveProvider(message.data.id);
        break;

      case "testProvider":
        await this.handleTestProvider(message.data.id);
        break;

      case "createFromTemplate":
        await this.handleCreateFromTemplate(message.data);
        break;

      case "discoverProviders":
        await this.handleDiscoverProviders();
        break;

      case "importConfig":
        await this.handleImportConfig(message.data.config);
        break;

      case "exportConfig":
        await this.handleExportConfig();
        break;

      case "setActiveProvider":
        await this.handleSetActiveProvider(message.data.id);
        break;

      case "setPhaseProvider":
        await this.handleSetPhaseProvider(message.data.phase, message.data.id);
        break;

      case "validateConfig":
        await this.handleValidateConfig(message.data.config);
        break;

      case "refreshProviderStatus":
        await this.handleRefreshProviderStatus();
        break;

      case "getProviderMetrics":
        await this.handleGetProviderMetrics(message.data.id);
        break;

      case "resetProviderMetrics":
        await this.handleResetProviderMetrics(message.data.id);
        break;

      case "getProviderPerformance":
        await this.handleGetProviderPerformance(message.data.id);
        break;

      case "testProvidersConcurrent":
        await this.handleTestProvidersConcurrent(message.data.providerIds);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private async loadProviders() {
    this.providers = this.llmManager.getModels();
  }

  private async loadTemplates() {
    this.templates = getProviderTemplates();
  }

  private async handleAddProvider(data: any) {
    const config: ModelConfig = {
      id: data.id || `provider-${Date.now()}`,
      name: data.name,
      provider: data.provider,
      modelName: data.modelName,
      apiKey: data.apiKey || "",
      baseUrl: data.baseUrl,
      temperature: data.temperature || 0.7,
      maxTokens: data.maxTokens || 4096,
      supportsTools: data.supportsTools ?? true,
      supportsVision: data.supportsVision ?? false,
      supportsStreaming: data.supportsStreaming ?? true,
      supportsSystemMessages: data.supportsSystemMessages ?? true,
      customHeaders: data.customHeaders,
      providerSettings: data.providerSettings,
      costPerToken: data.costPerToken,
      requestsPerMinute: data.requestsPerMinute,
      tags: data.tags,
      description: data.description,
    };

    await this.llmManager.addProvider(config);
    await this.loadProviders();
    this.sendProviders();
    this.postMessage("providerAdded", { id: config.id, name: config.name });
  }

  private async handleEditProvider(data: any) {
    const updates: Partial<ModelConfig> = {
      name: data.name,
      modelName: data.modelName,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      supportsTools: data.supportsTools,
      supportsVision: data.supportsVision,
      supportsStreaming: data.supportsStreaming,
      supportsSystemMessages: data.supportsSystemMessages,
      customHeaders: data.customHeaders,
      providerSettings: data.providerSettings,
      costPerToken: data.costPerToken,
      requestsPerMinute: data.requestsPerMinute,
      tags: data.tags,
      description: data.description,
    };

    await this.llmManager.updateProvider(data.id, updates);
    await this.loadProviders();
    this.sendProviders();
    this.postMessage("providerUpdated", { id: data.id });
  }

  private async handleRemoveProvider(id: string) {
    await this.llmManager.removeProvider(id);
    await this.loadProviders();
    this.sendProviders();
    this.postMessage("providerRemoved", { id });
  }

  private async handleTestProvider(id: string) {
    this.postMessage("testStarted", { id });

    try {
      const result = await this.llmManager.testProviderConnection(id);
      this.postMessage("testCompleted", {
        id,
        success: result.success,
        response: result.response,
        error: result.error,
      });
    } catch (error: any) {
      this.postMessage("testCompleted", {
        id,
        success: false,
        error: error.message,
      });
    }
  }

  private async handleCreateFromTemplate(data: any) {
    const config = await this.llmManager.createFromTemplate(
      data.templateId,
      data.customConfig,
    );

    await this.loadProviders();
    this.sendProviders();
    this.postMessage("providerCreated", { id: config.id, name: config.name });
  }

  private async handleDiscoverProviders() {
    this.postMessage("discoveryStarted");

    try {
      const discovered = await this.llmManager.discoverLocalProviders();
      this.postMessage("providersDiscovered", { providers: discovered });
    } catch (error: any) {
      this.postMessage("discoveryFailed", { error: error.message });
    }
  }

  private async handleImportConfig(configJson: string) {
    await this.llmManager.importConfiguration(configJson);
    await this.loadProviders();
    this.sendProviders();
    this.postMessage("configImported");
  }

  private async handleExportConfig() {
    const config = await this.llmManager.exportConfiguration();
    this.postMessage("configExported", { config });
  }

  private async handleSetActiveProvider(id: string) {
    await this.llmManager.setActiveProvider(id);
    this.postMessage("activeProviderSet", { id });
  }

  private async handleSetPhaseProvider(phase: string, id: string) {
    await this.llmManager.setPhaseProvider(phase, id);
    this.postMessage("phaseProviderSet", { phase, id });
  }

  private async handleValidateConfig(config: ModelConfig) {
    const result = this.llmManager.validateConfiguration(config);
    this.postMessage("configValidated", {
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings,
    });
  }

  private async handleRefreshProviderStatus() {
    await this.llmManager.refreshProviderAvailability();
    await this.loadProviders();
    this.sendProviders();
    this.postMessage("statusRefreshed");
  }

  private async handleGetProviderMetrics(id: string) {
    const metrics = this.llmManager.getProviderMetrics(id);
    const performance = this.llmManager.getProviderPerformanceSummary(id);

    this.postMessage("providerMetrics", {
      id,
      metrics,
      performance,
    });
  }

  private async handleResetProviderMetrics(id: string) {
    this.llmManager.resetProviderMetrics(id);
    await this.loadProviders();
    this.sendProviders();
    this.postMessage("metricsReset", { id });
  }

  private async handleGetProviderPerformance(id: string) {
    const performance = this.llmManager.getProviderPerformanceSummary(id);
    this.postMessage("providerPerformance", { id, performance });
  }

  private async handleTestProvidersConcurrent(providerIds: string[]) {
    this.postMessage("concurrentTestStarted", { providerIds });

    try {
      const results =
        await this.llmManager.testProvidersConcurrent(providerIds);
      this.postMessage("concurrentTestCompleted", { results });
    } catch (error: any) {
      this.postMessage("concurrentTestFailed", { error: error.message });
    }
  }

  private sendProviders() {
    const providersWithStatus = this.providers.map((provider) => {
      const status = this.llmManager.getProviderStatus(provider.id);
      const metrics = this.llmManager.getProviderMetrics(provider.id);
      const performance = this.llmManager.getProviderPerformanceSummary(
        provider.id,
      );

      return {
        ...provider,
        status,
        metrics,
        performance,
      };
    });

    const activeProvider = this.llmManager.getActiveProvider();

    this.postMessage("providersLoaded", {
      providers: providersWithStatus,
      activeProviderId: activeProvider?.id,
    });
  }

  private sendTemplates() {
    this.postMessage("templatesLoaded", { templates: this.templates });
  }

  private postMessage(type: string, data?: any) {
    if (this.view) {
      this.view.webview.postMessage({ type, data });
    }
  }

  public refresh() {
    this.loadProviders();
    this.sendProviders();
  }

  public show() {
    if (this.view) {
      this.view.show();
    }
  }

  private getHtmlContent(): string {
    return getProviderSetupHtml();
  }
}
