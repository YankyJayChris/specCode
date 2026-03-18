export type SpecPhase = 'requirements' | 'design' | 'tasks' | 'execution';

export interface Spec {
    id: string;
    name: string;
    description: string;
    path: string;
    phase: SpecPhase;
    phaseStatus: 'pending' | 'generating' | 'ready' | 'approved' | 'executing' | 'completed' | 'error';
    createdAt: number;
    updatedAt: number;
    files: {
        requirements?: string;
        design?: string;
        tasks?: string;
    };
    tasks: Task[];
    metadata: {
        modelId?: string;
        costEstimate?: number;
        tokenCount?: number;
    };
}

export interface Task {
    id: string;
    description: string;
    expectedOutcome: string;
    dependencies: string[];
    resources: string[];
    optional: boolean;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
    startedAt?: number;
    completedAt?: number;
}

export interface RequirementsData {
    userStories: UserStory[];
    acceptanceCriteria: string[];
    inScope: string[];
    outOfScope: string[];
    edgeCases: string[];
    assumptions: string[];
    dependencies: string[];
}

export interface UserStory {
    id: string;
    role: string;
    action: string;
    benefit: string;
    priority: 'must' | 'should' | 'could' | 'wont';
}

export interface DesignData {
    architecture: string;
    components: Component[];
    dataModels: DataModel[];
    apiEndpoints: ApiEndpoint[];
    errorHandling: string;
    techChoices: TechChoice[];
    sequenceDiagrams: string[];
    securityConsiderations: string[];
}

export interface Component {
    name: string;
    description: string;
    responsibilities: string[];
    dependencies: string[];
}

export interface DataModel {
    name: string;
    fields: DataField[];
    relationships: string[];
}

export interface DataField {
    name: string;
    type: string;
    required: boolean;
    description: string;
}

export interface ApiEndpoint {
    method: string;
    path: string;
    description: string;
    requestBody?: string;
    responseBody?: string;
    errors: string[];
}

export interface TechChoice {
    category: string;
    choice: string;
    rationale: string;
    alternatives: string[];
}

export const EARS_TEMPLATE = `# Requirements Document

## User Stories

### US-001: [Role] can [Action] so that [Benefit]
- **Priority**: Must have
- **Acceptance Criteria**:
  1. [Criterion 1]
  2. [Criterion 2]

## Acceptance Criteria

- AC-001: [Specific, testable criterion]

## In Scope

- [Feature or requirement]

## Out of Scope

- [Feature explicitly not included]

## Edge Cases

- [Edge case description and expected behavior]

## Assumptions

- [Assumption made during requirements gathering]

## Dependencies

- [External dependency or prerequisite]
`;

export const DESIGN_TEMPLATE = `# Design Document

## Architecture Overview

[High-level architecture description]

## Components

### [Component Name]
- **Description**: [What this component does]
- **Responsibilities**:
  - [Responsibility 1]
  - [Responsibility 2]
- **Dependencies**: [Other components this depends on]

## Data Models

### [Model Name]
\`\`\`typescript
interface ModelName {
  field1: string;
  field2: number;
}
\`\`\`

## API Endpoints

### [Method] /path
- **Description**: [What this endpoint does]
- **Request**: [Request body schema]
- **Response**: [Response body schema]
- **Errors**: [Possible error responses]

## Sequence Diagrams

\`\`\`mermaid
sequenceDiagram
    participant User
    participant System
    User->>System: Action
    System-->>User: Response
\`\`\`

## Error Handling

[Error handling strategy]

## Technology Choices

### [Category]
- **Choice**: [Technology]
- **Rationale**: [Why this choice]
- **Alternatives**: [Other options considered]

## Security Considerations

- [Security measure or consideration]
`;

export const TASKS_TEMPLATE = `# Implementation Plan

## Task List

### Task 1: [Task Name]
- **Description**: [What needs to be done]
- **Expected Outcome**: [What completion looks like]
- **Dependencies**: [Task IDs this depends on]
- **Resources**: [Files, APIs, or tools needed]
- **Optional**: false

## Progress

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
`;
