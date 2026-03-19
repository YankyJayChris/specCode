import * as vscode from "vscode";
import { LLMManager, ModelConfig } from "../llm/llmManager";
import { ProviderStatus } from "../llm/providerTypes";

export class ProviderSwitcherProvider implements vscode.TreeDataProvider<ProviderItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ProviderItem | undefined | null | void
  > = new vscode.EventEmitter<ProviderItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ProviderItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private llmManager: LLMManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProviderItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProviderItem): Promise<ProviderItem[]> {
    if (!element) {
      // Root level - show active provider and phase providers
      const items: ProviderItem[] = [];

      // Active Provider section
      const activeProvider = this.llmManager.getActiveProvider();
      if (activeProvider) {
        const status = this.llmManager.getProviderStatus(activeProvider.id);
        items.push(new ActiveProviderItem(activeProvider, status));
      } else {
        items.push(new NoActiveProviderItem());
      }

      // Phase Providers section
      items.push(new PhaseProvidersItem());

      // All Providers section
      items.push(new AllProvidersItem());

      return items;
    } else if (element instanceof PhaseProvidersItem) {
      // Show phase-specific providers
      const phases = ["requirements", "design", "execution", "hooks"];
      const items: ProviderItem[] = [];

      for (const phase of phases) {
        const providerId = await this.llmManager.getPhaseProvider(phase);
        const provider = providerId
          ? this.llmManager.getModel(providerId)
          : undefined;
        const status = providerId
          ? this.llmManager.getProviderStatus(providerId)
          : undefined;
        items.push(new PhaseProviderItem(phase, provider, status));
      }

      return items;
    } else if (element instanceof AllProvidersItem) {
      // Show all configured providers
      const providers = this.llmManager.getModels();
      const activeProvider = this.llmManager.getActiveProvider();

      return providers.map((provider) => {
        const status = this.llmManager.getProviderStatus(provider.id);
        const isActive = activeProvider?.id === provider.id;
        return new ProviderListItem(provider, status, isActive);
      });
    }

    return [];
  }
}

abstract class ProviderItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
  }
}

class ActiveProviderItem extends ProviderItem {
  constructor(
    private provider: ModelConfig,
    private status?: ProviderStatus,
  ) {
    super(`Active: ${provider.name}`, vscode.TreeItemCollapsibleState.None);

    this.description = `${provider.provider} • ${provider.modelName}`;
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.contextValue = "activeProvider";

    // Add command to switch provider
    this.command = {
      command: "specCode.switchProvider",
      title: "Switch Provider",
    };
  }

  private getIcon(): vscode.ThemeIcon {
    if (!this.status) {
      return new vscode.ThemeIcon(
        "circle-outline",
        new vscode.ThemeColor("charts.gray"),
      );
    }

    switch (this.status.state) {
      case "online":
        return new vscode.ThemeIcon(
          "circle-filled",
          new vscode.ThemeColor("charts.green"),
        );
      case "offline":
        return new vscode.ThemeIcon(
          "circle-outline",
          new vscode.ThemeColor("charts.gray"),
        );
      case "error":
        return new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("charts.red"),
        );
      case "testing":
        return new vscode.ThemeIcon(
          "loading~spin",
          new vscode.ThemeColor("charts.yellow"),
        );
      default:
        return new vscode.ThemeIcon(
          "circle-outline",
          new vscode.ThemeColor("charts.gray"),
        );
    }
  }

  private getTooltip(): string {
    let tooltip = `Provider: ${this.provider.name}\n`;
    tooltip += `Type: ${this.provider.provider}\n`;
    tooltip += `Model: ${this.provider.modelName}\n`;

    if (this.status) {
      tooltip += `Status: ${this.status.state}\n`;
      if (this.status.responseTime > 0) {
        tooltip += `Response Time: ${this.status.responseTime}ms\n`;
      }
      if (this.status.lastError) {
        tooltip += `Last Error: ${this.status.lastError}\n`;
      }
      if (this.status.lastChecked > 0) {
        tooltip += `Last Checked: ${new Date(this.status.lastChecked).toLocaleString()}\n`;
      }
    }

    tooltip += "\nClick to switch provider";
    return tooltip;
  }
}

class NoActiveProviderItem extends ProviderItem {
  constructor() {
    super("No Active Provider", vscode.TreeItemCollapsibleState.None);

    this.description = "Click to select";
    this.tooltip = "No provider is currently active. Click to select one.";
    this.iconPath = new vscode.ThemeIcon(
      "warning",
      new vscode.ThemeColor("charts.orange"),
    );
    this.contextValue = "noActiveProvider";

    this.command = {
      command: "specCode.switchProvider",
      title: "Select Provider",
    };
  }
}

class PhaseProvidersItem extends ProviderItem {
  constructor() {
    super("Phase Providers", vscode.TreeItemCollapsibleState.Expanded);

    this.description = "Per-phase provider settings";
    this.tooltip = "Configure different providers for each workflow phase";
    this.iconPath = new vscode.ThemeIcon("gear");
    this.contextValue = "phaseProviders";
  }
}

class PhaseProviderItem extends ProviderItem {
  constructor(
    private phase: string,
    private provider?: ModelConfig,
    private status?: ProviderStatus,
  ) {
    const phaseName = phase.charAt(0).toUpperCase() + phase.slice(1);
    const providerName = provider ? provider.name : "Default";

    super(
      `${phaseName}: ${providerName}`,
      vscode.TreeItemCollapsibleState.None,
    );

    this.description = provider
      ? `${provider.provider} • ${provider.modelName}`
      : "Uses active provider";
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.contextValue = "phaseProvider";

    // Add command to set phase provider
    this.command = {
      command: "specCode.setPhaseProvider",
      title: "Set Phase Provider",
      arguments: [this.phase],
    };
  }

  private getIcon(): vscode.ThemeIcon {
    if (!this.provider || !this.status) {
      return new vscode.ThemeIcon(
        "circle-outline",
        new vscode.ThemeColor("charts.gray"),
      );
    }

    switch (this.status.state) {
      case "online":
        return new vscode.ThemeIcon(
          "circle-filled",
          new vscode.ThemeColor("charts.green"),
        );
      case "offline":
        return new vscode.ThemeIcon(
          "circle-outline",
          new vscode.ThemeColor("charts.gray"),
        );
      case "error":
        return new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("charts.red"),
        );
      case "testing":
        return new vscode.ThemeIcon(
          "loading~spin",
          new vscode.ThemeColor("charts.yellow"),
        );
      default:
        return new vscode.ThemeIcon(
          "circle-outline",
          new vscode.ThemeColor("charts.gray"),
        );
    }
  }

  private getTooltip(): string {
    let tooltip = `Phase: ${this.phase}\n`;

    if (this.provider) {
      tooltip += `Provider: ${this.provider.name}\n`;
      tooltip += `Type: ${this.provider.provider}\n`;
      tooltip += `Model: ${this.provider.modelName}\n`;

      if (this.status) {
        tooltip += `Status: ${this.status.state}\n`;
        if (this.status.responseTime > 0) {
          tooltip += `Response Time: ${this.status.responseTime}ms\n`;
        }
      }
    } else {
      tooltip += "Uses the currently active provider\n";
    }

    tooltip += "\nClick to set a specific provider for this phase";
    return tooltip;
  }
}

class AllProvidersItem extends ProviderItem {
  constructor() {
    super("All Providers", vscode.TreeItemCollapsibleState.Collapsed);

    this.description = "Manage all configured providers";
    this.tooltip = "View and manage all configured providers";
    this.iconPath = new vscode.ThemeIcon("list-unordered");
    this.contextValue = "allProviders";
  }
}

class ProviderListItem extends ProviderItem {
  constructor(
    private provider: ModelConfig,
    private status?: ProviderStatus,
    private isActive: boolean = false,
  ) {
    super(provider.name, vscode.TreeItemCollapsibleState.None);

    this.description = `${provider.provider} • ${provider.modelName}`;
    if (this.isActive) {
      this.description += " (Active)";
    }

    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.contextValue = this.isActive
      ? "activeProviderInList"
      : "providerInList";

    // Add command to activate provider
    if (!this.isActive) {
      this.command = {
        command: "specCode.activateProvider",
        title: "Activate Provider",
        arguments: [this.provider.id],
      };
    }
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.isActive) {
      // Active provider gets a special icon
      if (!this.status) {
        return new vscode.ThemeIcon(
          "star-full",
          new vscode.ThemeColor("charts.blue"),
        );
      }

      switch (this.status.state) {
        case "online":
          return new vscode.ThemeIcon(
            "star-full",
            new vscode.ThemeColor("charts.green"),
          );
        case "offline":
          return new vscode.ThemeIcon(
            "star-full",
            new vscode.ThemeColor("charts.gray"),
          );
        case "error":
          return new vscode.ThemeIcon(
            "star-full",
            new vscode.ThemeColor("charts.red"),
          );
        case "testing":
          return new vscode.ThemeIcon(
            "loading~spin",
            new vscode.ThemeColor("charts.yellow"),
          );
        default:
          return new vscode.ThemeIcon(
            "star-full",
            new vscode.ThemeColor("charts.blue"),
          );
      }
    } else {
      // Non-active providers
      if (!this.status) {
        return new vscode.ThemeIcon(
          "circle-outline",
          new vscode.ThemeColor("charts.gray"),
        );
      }

      switch (this.status.state) {
        case "online":
          return new vscode.ThemeIcon(
            "circle-filled",
            new vscode.ThemeColor("charts.green"),
          );
        case "offline":
          return new vscode.ThemeIcon(
            "circle-outline",
            new vscode.ThemeColor("charts.gray"),
          );
        case "error":
          return new vscode.ThemeIcon(
            "error",
            new vscode.ThemeColor("charts.red"),
          );
        case "testing":
          return new vscode.ThemeIcon(
            "loading~spin",
            new vscode.ThemeColor("charts.yellow"),
          );
        default:
          return new vscode.ThemeIcon(
            "circle-outline",
            new vscode.ThemeColor("charts.gray"),
          );
      }
    }
  }

  private getTooltip(): string {
    let tooltip = `Provider: ${this.provider.name}\n`;
    tooltip += `Type: ${this.provider.provider}\n`;
    tooltip += `Model: ${this.provider.modelName}\n`;

    if (this.provider.baseUrl) {
      tooltip += `Base URL: ${this.provider.baseUrl}\n`;
    }

    if (this.status) {
      tooltip += `Status: ${this.status.state}\n`;
      if (this.status.responseTime > 0) {
        tooltip += `Response Time: ${this.status.responseTime}ms\n`;
      }
      if (this.status.errorCount > 0) {
        tooltip += `Error Count: ${this.status.errorCount}\n`;
      }
      if (this.status.lastError) {
        tooltip += `Last Error: ${this.status.lastError}\n`;
      }
      if (this.status.lastChecked > 0) {
        tooltip += `Last Checked: ${new Date(this.status.lastChecked).toLocaleString()}\n`;
      }
    }

    if (this.isActive) {
      tooltip += "\nThis is the currently active provider";
    } else {
      tooltip += "\nClick to activate this provider";
    }

    return tooltip;
  }
}
