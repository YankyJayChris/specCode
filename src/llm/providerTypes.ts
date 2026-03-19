export interface ProviderStatus {
  state: "online" | "offline" | "error" | "testing";
  lastChecked: number;
  responseTime: number;
  errorCount: number;
  lastError?: string;
}

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  lastUsed: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProviderError {
  type: "configuration" | "connection" | "provider" | "system";
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  providerId?: string;
  retryable: boolean;
  userMessage: string;
}

export interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export interface ProviderTemplate {
  id: string;
  name: string;
  provider: string;
  description: string;
  defaultSettings: Partial<any>;
  requiredFields: string[];
  helpText: string;
  documentationUrl: string;
  setupInstructions: string[];
}
