import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { KiroFolderManager } from "../utils/kiroFolder";

export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  tokens?: number;
  cost?: number;
  metadata?: {
    model?: string;
    temperature?: number;
    toolCalls?: any[];
    attachments?: string[];
  };
}

export interface Session {
  id: string;
  specId: string;
  taskId?: string;
  phase: string;
  startedAt: number;
  endedAt?: number;
  messages: SessionMessage[];
  totalTokens: number;
  totalCost: number;
  status: "active" | "completed" | "paused" | "error";
  summary?: string;
  metadata: {
    model?: string;
    userAgent?: string;
    tags?: string[];
  };
}

export class SessionManager {
  private folderManager: KiroFolderManager;
  private currentSession: Session | null = null;
  private onSessionChanged: vscode.EventEmitter<Session | null> =
    new vscode.EventEmitter();
  public readonly onDidChangeSession = this.onSessionChanged.event;

  constructor(folderManager: KiroFolderManager) {
    this.folderManager = folderManager;
  }

  // ── Session Lifecycle ─────────────────────────────────────────────────────

  startSession(
    specId: string,
    taskId?: string,
    phase: string = "execution",
  ): Session {
    // End current session if active
    if (this.currentSession && this.currentSession.status === "active") {
      this.endSession(this.currentSession.id);
    }

    const session: Session = {
      id: uuidv4(),
      specId,
      taskId,
      phase,
      startedAt: Date.now(),
      messages: [],
      totalTokens: 0,
      totalCost: 0,
      status: "active",
      metadata: {},
    };

    this.currentSession = session;
    this.saveSession(session);
    this.onSessionChanged.fire(session);

    return session;
  }

  endSession(sessionId: string, summary?: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    session.endedAt = Date.now();
    session.status = "completed";
    if (summary) {
      session.summary = summary;
    }

    this.saveSession(session);

    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
      this.onSessionChanged.fire(null);
    }

    return true;
  }

  pauseSession(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    session.status = "paused";
    this.saveSession(session);

    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
      this.onSessionChanged.fire(null);
    }

    return true;
  }

  resumeSession(sessionId: string): Session | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    // End current session if active
    if (this.currentSession && this.currentSession.status === "active") {
      this.endSession(this.currentSession.id);
    }

    session.status = "active";
    this.currentSession = session;
    this.saveSession(session);
    this.onSessionChanged.fire(session);

    return session;
  }

  // ── Message Management ────────────────────────────────────────────────────

  addMessage(
    sessionId: string,
    role: "user" | "assistant" | "system",
    content: string,
    metadata?: SessionMessage["metadata"],
  ): SessionMessage | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const message: SessionMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };

    session.messages.push(message);
    this.saveSession(session);

    return message;
  }

  updateMessageTokens(
    sessionId: string,
    messageId: string,
    tokens: number,
    cost?: number,
  ): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const message = session.messages.find((m) => m.id === messageId);
    if (!message) {
      return false;
    }

    message.tokens = tokens;
    if (cost !== undefined) {
      message.cost = cost;
    }

    // Update session totals
    session.totalTokens = session.messages.reduce(
      (sum, m) => sum + (m.tokens || 0),
      0,
    );
    session.totalCost = session.messages.reduce(
      (sum, m) => sum + (m.cost || 0),
      0,
    );

    this.saveSession(session);
    return true;
  }

  // ── Session Persistence ───────────────────────────────────────────────────

  private saveSession(session: Session): boolean {
    const sessionsPath = this.folderManager.getSessionsPath();
    if (!sessionsPath) {
      return false;
    }

    const sessionPath = path.join(sessionsPath, `${session.id}.json`);
    return this.folderManager.safeWriteFile(
      sessionPath,
      JSON.stringify(session, null, 2),
    );
  }

  getSession(sessionId: string): Session | null {
    const sessionsPath = this.folderManager.getSessionsPath();
    if (!sessionsPath) {
      return null;
    }

    const sessionPath = path.join(sessionsPath, `${sessionId}.json`);
    const content = this.folderManager.safeReadFile(sessionPath);
    if (!content) {
      return null;
    }

    try {
      return JSON.parse(content) as Session;
    } catch {
      return null;
    }
  }

  // ── Session Queries ───────────────────────────────────────────────────────

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  getSessionsForSpec(specId: string): Session[] {
    const sessionsPath = this.folderManager.getSessionsPath();
    if (!sessionsPath || !fs.existsSync(sessionsPath)) {
      return [];
    }

    const sessions: Session[] = [];

    try {
      const files = fs.readdirSync(sessionsPath);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const sessionPath = path.join(sessionsPath, file);
          const content = this.folderManager.safeReadFile(sessionPath);
          if (content) {
            try {
              const session = JSON.parse(content) as Session;
              if (session.specId === specId) {
                sessions.push(session);
              }
            } catch {
              // Skip invalid session files
            }
          }
        }
      }
    } catch (error) {
      console.error("Error reading sessions:", error);
    }

    // Sort by start time, newest first
    return sessions.sort((a, b) => b.startedAt - a.startedAt);
  }

  getAllSessions(): Session[] {
    const sessionsPath = this.folderManager.getSessionsPath();
    if (!sessionsPath || !fs.existsSync(sessionsPath)) {
      return [];
    }

    const sessions: Session[] = [];

    try {
      const files = fs.readdirSync(sessionsPath);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const sessionPath = path.join(sessionsPath, file);
          const content = this.folderManager.safeReadFile(sessionPath);
          if (content) {
            try {
              const session = JSON.parse(content) as Session;
              sessions.push(session);
            } catch {
              // Skip invalid session files
            }
          }
        }
      }
    } catch (error) {
      console.error("Error reading sessions:", error);
    }

    // Sort by start time, newest first
    return sessions.sort((a, b) => b.startedAt - a.startedAt);
  }

  getActiveSession(): Session | null {
    const sessions = this.getAllSessions();
    return sessions.find((s) => s.status === "active") || null;
  }

  // ── Session Analytics ─────────────────────────────────────────────────────

  getSessionStats(specId?: string): {
    totalSessions: number;
    totalTokens: number;
    totalCost: number;
    averageSessionLength: number;
    completedSessions: number;
  } {
    const sessions = specId
      ? this.getSessionsForSpec(specId)
      : this.getAllSessions();

    const totalSessions = sessions.length;
    const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalCost = sessions.reduce((sum, s) => sum + s.totalCost, 0);
    const completedSessions = sessions.filter(
      (s) => s.status === "completed",
    ).length;

    const sessionLengths = sessions
      .filter((s) => s.endedAt)
      .map((s) => s.endedAt! - s.startedAt);
    const averageSessionLength =
      sessionLengths.length > 0
        ? sessionLengths.reduce((sum, len) => sum + len, 0) /
          sessionLengths.length
        : 0;

    return {
      totalSessions,
      totalTokens,
      totalCost,
      averageSessionLength,
      completedSessions,
    };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  deleteSession(sessionId: string): boolean {
    const sessionsPath = this.folderManager.getSessionsPath();
    if (!sessionsPath) {
      return false;
    }

    const sessionPath = path.join(sessionsPath, `${sessionId}.json`);
    const success = this.folderManager.safeDeleteFile(sessionPath);

    if (success && this.currentSession?.id === sessionId) {
      this.currentSession = null;
      this.onSessionChanged.fire(null);
    }

    return success;
  }

  cleanupOldSessions(daysOld: number = 30): number {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const sessions = this.getAllSessions();
    let deletedCount = 0;

    for (const session of sessions) {
      if (
        session.status === "completed" &&
        session.endedAt &&
        session.endedAt < cutoffTime
      ) {
        if (this.deleteSession(session.id)) {
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }
}
