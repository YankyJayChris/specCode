import * as vscode from "vscode";
import { SessionManager, Session } from "../session/sessionManager";
import { SpecCodeFolderManager } from "../utils/specCodeFolder";

export class SessionProvider implements vscode.TreeDataProvider<SessionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    SessionItem | undefined | null | void
  > = new vscode.EventEmitter<SessionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    SessionItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(
    private sessionManager: SessionManager,
    private folderManager: SpecCodeFolderManager,
  ) {
    // Listen for session changes
    this.sessionManager.onDidChangeSession(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SessionItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SessionItem): Thenable<SessionItem[]> {
    if (!this.folderManager.specCodeFolderExists()) {
      return Promise.resolve([]);
    }

    if (!element) {
      // Root level - group by spec
      return Promise.resolve(this.getSpecGroups());
    } else if (element.contextValue === "specGroup") {
      // Show sessions for this spec
      return Promise.resolve(this.getSessionsForSpec(element.specId!));
    } else {
      // Session item - no children
      return Promise.resolve([]);
    }
  }

  private getSpecGroups(): SessionItem[] {
    const sessions = this.sessionManager.getAllSessions();
    const specGroups = new Map<string, Session[]>();

    // Group sessions by spec
    for (const session of sessions) {
      if (!specGroups.has(session.specId)) {
        specGroups.set(session.specId, []);
      }
      specGroups.get(session.specId)!.push(session);
    }

    const items: SessionItem[] = [];
    for (const [specId, specSessions] of specGroups) {
      const activeSessions = specSessions.filter(
        (s) => s.status === "active",
      ).length;
      const totalSessions = specSessions.length;

      const item = new SessionItem(
        `${specId} (${totalSessions})`,
        vscode.TreeItemCollapsibleState.Expanded,
        "specGroup",
      );
      item.specId = specId;
      item.description = activeSessions > 0 ? `${activeSessions} active` : "";
      item.iconPath = new vscode.ThemeIcon("folder");
      items.push(item);
    }

    return items.sort((a, b) =>
      a.label!.toString().localeCompare(b.label!.toString()),
    );
  }

  private getSessionsForSpec(specId: string): SessionItem[] {
    const sessions = this.sessionManager.getSessionsForSpec(specId);

    return sessions.map((session) => {
      const duration = session.endedAt
        ? this.formatDuration(session.endedAt - session.startedAt)
        : this.formatDuration(Date.now() - session.startedAt);

      const label = `${session.phase} - ${this.formatDate(session.startedAt)}`;

      const item = new SessionItem(
        label,
        vscode.TreeItemCollapsibleState.None,
        "session",
      );

      item.sessionId = session.id;
      item.description = `${duration} • ${session.totalTokens} tokens`;
      item.tooltip = this.createSessionTooltip(session);

      // Set icon based on status
      switch (session.status) {
        case "active":
          item.iconPath = new vscode.ThemeIcon(
            "play",
            new vscode.ThemeColor("charts.green"),
          );
          break;
        case "completed":
          item.iconPath = new vscode.ThemeIcon(
            "check",
            new vscode.ThemeColor("charts.blue"),
          );
          break;
        case "paused":
          item.iconPath = new vscode.ThemeIcon(
            "debug-pause",
            new vscode.ThemeColor("charts.yellow"),
          );
          break;
        case "error":
          item.iconPath = new vscode.ThemeIcon(
            "error",
            new vscode.ThemeColor("charts.red"),
          );
          break;
      }

      return item;
    });
  }

  private createSessionTooltip(session: Session): string {
    const lines = [
      `Session: ${session.id}`,
      `Spec: ${session.specId}`,
      `Phase: ${session.phase}`,
      `Status: ${session.status}`,
      `Started: ${new Date(session.startedAt).toLocaleString()}`,
    ];

    if (session.endedAt) {
      lines.push(`Ended: ${new Date(session.endedAt).toLocaleString()}`);
      lines.push(
        `Duration: ${this.formatDuration(session.endedAt - session.startedAt)}`,
      );
    } else {
      lines.push(
        `Duration: ${this.formatDuration(Date.now() - session.startedAt)}`,
      );
    }

    lines.push(`Messages: ${session.messages.length}`);
    lines.push(`Tokens: ${session.totalTokens}`);

    if (session.totalCost > 0) {
      lines.push(`Cost: $${session.totalCost.toFixed(4)}`);
    }

    if (session.taskId) {
      lines.push(`Task: ${session.taskId}`);
    }

    if (session.summary) {
      lines.push(`Summary: ${session.summary}`);
    }

    return lines.join("\n");
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

export class SessionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
  ) {
    super(label, collapsibleState);
  }

  specId?: string;
  sessionId?: string;
}
