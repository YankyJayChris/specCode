import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import {
  Spec,
  SpecPhase,
  Task,
  EARS_TEMPLATE,
  DESIGN_TEMPLATE,
  TASKS_TEMPLATE,
  getTemplate,
} from "./specTypes";
import { LLMManager } from "../llm/llmManager";
import { SteeringManager } from "../steering/steeringManager";
import { SpecCodeFolderManager } from "../utils/specCodeFolder";
import { MemoryManager } from "../memory/memoryManager";

export class SpecManager {
  private specs: Map<string, Spec> = new Map();
  private specsFolder: string = "";

  constructor(
    private specCodeFolder: SpecCodeFolderManager,
    private llmManager: LLMManager,
    private steeringManager: SteeringManager,
    private memoryManager: MemoryManager,
  ) {
    this.loadSpecs();
  }

  private async loadSpecs() {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    this.specsFolder = path.join(
      workspaceRoot,
      SpecCodeFolderManager.FOLDER_NAME,
      "specs",
    );

    if (!fs.existsSync(this.specsFolder)) {
      fs.mkdirSync(this.specsFolder, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(this.specsFolder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.loadSpec(entry.name);
      }
    }
  }

  private async loadSpec(name: string) {
    const specPath = path.join(this.specsFolder, name);
    const metadataPath = path.join(specPath, "metadata.json");

    let spec: Spec;

    if (fs.existsSync(metadataPath)) {
      const data = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
      spec = { ...data, path: specPath, tasks: data.tasks || [] };
    } else {
      spec = {
        id: uuidv4(),
        name,
        description: "",
        path: specPath,
        phase: "requirements",
        phaseStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        files: {},
        tasks: [],
        metadata: {},
      };
    }

    const requirementsPath = path.join(specPath, "requirements.md");
    const designPath = path.join(specPath, "design.md");
    const tasksPath = path.join(specPath, "tasks.md");

    if (fs.existsSync(requirementsPath)) {
      spec.files.requirements = requirementsPath;
      if (spec.phase === "requirements") {
        spec.phaseStatus = "ready";
      }
    }

    if (fs.existsSync(designPath)) {
      spec.files.design = designPath;
      if (
        spec.phase === "design" ||
        (spec.phase === "requirements" && spec.files.requirements)
      ) {
        spec.phase = "design";
        spec.phaseStatus = "ready";
      }
    }

    if (fs.existsSync(tasksPath)) {
      spec.files.tasks = tasksPath;
      if (
        spec.phase === "tasks" ||
        (spec.phase === "design" && spec.files.design)
      ) {
        spec.phase = "tasks";
        spec.phaseStatus = "ready";
      }
      spec.tasks = this.parseTasksFromMarkdown(
        fs.readFileSync(tasksPath, "utf-8"),
      );
    }

    this.specs.set(spec.id, spec);
    this.specCodeFolder.setSpec(spec);
  }

  private parseTasksFromMarkdown(content: string): Task[] {
    const tasks: Task[] = [];
    const taskRegex =
      /### Task (\d+): ([^\n]+)\n- \*\*Description\*\*: ([^\n]+)\n- \*\*Expected Outcome\*\*: ([^\n]+)(?:\n- \*\*Dependencies\*\*: ([^\n]+))?/g;

    let match;
    while ((match = taskRegex.exec(content)) !== null) {
      tasks.push({
        id: `task-${match[1]}`,
        description: match[3].trim(),
        expectedOutcome: match[4].trim(),
        dependencies: match[5]
          ? match[5]
              .split(",")
              .map((d) => d.trim())
              .filter((d) => d)
          : [],
        resources: [],
        optional: false,
        status: "pending",
      });
    }

    return tasks;
  }

  async createSpec(
    name: string,
    description: string,
    templateId?: string,
  ): Promise<Spec> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const specPath = path.join(
      workspaceRoot,
      SpecCodeFolderManager.FOLDER_NAME,
      "specs",
      name,
    );

    if (fs.existsSync(specPath)) {
      throw new Error(`Spec "${name}" already exists`);
    }

    fs.mkdirSync(specPath, { recursive: true });

    const template = templateId ? getTemplate(templateId) : undefined;

    const spec: Spec = {
      id: uuidv4(),
      name,
      description: description || (template?.defaultDescription ?? ""),
      path: specPath,
      phase: "requirements",
      phaseStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: {},
      tasks: [],
      metadata: { templateId },
    };

    this.specs.set(spec.id, spec);
    this.specCodeFolder.setSpec(spec);
    await this.saveSpec(spec);

    this.memoryManager.appendSpecMemory(
      spec.id,
      `Spec created: "${name}".${templateId ? ` Template: ${templateId}.` : ""} Description: ${spec.description}`,
      "note",
    );

    return spec;
  }

  async createSpecFromTemplate(name: string, template: any): Promise<Spec> {
    const spec = await this.createSpec(name, template.defaultDescription);

    // Update spec metadata with template info
    spec.metadata.templateId = template.id;
    spec.metadata.tags = [template.category];

    // Add template-specific steering hints to memory
    this.memoryManager.appendSpecMemory(
      spec.id,
      `Template: ${template.name}\n\nSteering Hints: ${template.steeringHints}`,
      "convention",
    );

    await this.saveSpec(spec);
    return spec;
  }

  async deleteSpec(id: string): Promise<void> {
    const spec = this.specs.get(id);
    if (!spec) {
      return;
    }

    if (fs.existsSync(spec.path)) {
      fs.rmSync(spec.path, { recursive: true });
    }
    this.specs.delete(id);
  }

  private async saveSpec(spec: Spec): Promise<void> {
    const metadataPath = path.join(spec.path, "metadata.json");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { path: _path, ...data } = spec;
    fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
    this.specCodeFolder.setSpec(spec);
  }

  async generateRequirements(specId: string, prompt: string): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      throw new Error("Spec not found");
    }

    spec.phaseStatus = "generating";

    const steering = await this.steeringManager.getCombinedSteering();
    const memory = this.memoryManager.getMemoryContext(specId);
    const modelId =
      await this.llmManager.getDefaultModelForPhase("requirements");
    const template = spec.metadata.templateId
      ? getTemplate(spec.metadata.templateId)
      : undefined;

    const systemPrompt = `You are an expert requirements analyst. Generate comprehensive requirements following the EARS standard.

${steering}
${memory ? `\n## Project Context (Memory)\n${memory}\n` : ""}
${template ? `\n## Template Guidance (${template.name})\n${template.steeringHints}\n` : ""}

Format your response using:\n${EARS_TEMPLATE}`;

    const response = await this.llmManager.generate(modelId, [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Generate requirements for: ${prompt}\n\nSpec: ${spec.name}\nDescription: ${spec.description}`,
      },
    ]);

    const requirementsPath = path.join(spec.path, "requirements.md");
    fs.writeFileSync(requirementsPath, response.content);

    spec.files.requirements = requirementsPath;
    spec.phase = "requirements";
    spec.phaseStatus = "ready";
    spec.updatedAt = Date.now();
    spec.metadata.modelId = modelId;
    if (response.usage) {
      spec.metadata.tokenCount =
        (spec.metadata.tokenCount || 0) + response.usage.totalTokens;
    }

    this.memoryManager.appendSpecMemory(
      specId,
      `Requirements generated (${response.usage?.totalTokens ?? "?"} tokens)`,
      "note",
    );

    await this.saveSpec(spec);
  }

  async generateDesign(specId: string): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      throw new Error("Spec not found");
    }
    if (!spec.files.requirements) {
      throw new Error("Requirements not generated yet");
    }

    spec.phaseStatus = "generating";

    const requirements = fs.readFileSync(spec.files.requirements, "utf-8");
    const steering = await this.steeringManager.getCombinedSteering();
    const memory = this.memoryManager.getMemoryContext(specId);
    const modelId = await this.llmManager.getDefaultModelForPhase("design");
    const template = spec.metadata.templateId
      ? getTemplate(spec.metadata.templateId)
      : undefined;

    const systemPrompt = `You are an expert software architect. Create a detailed technical design.

${steering}
${memory ? `\n## Project Context (Memory)\n${memory}\n` : ""}
${template ? `\n## Template Guidance (${template.name})\n${template.steeringHints}\n` : ""}

Format your response using:\n${DESIGN_TEMPLATE}`;

    const response = await this.llmManager.generate(modelId, [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Create a technical design for:\n\n${requirements}`,
      },
    ]);

    const designPath = path.join(spec.path, "design.md");
    fs.writeFileSync(designPath, response.content);

    spec.files.design = designPath;
    spec.phase = "design";
    spec.phaseStatus = "ready";
    spec.updatedAt = Date.now();
    if (response.usage) {
      spec.metadata.tokenCount =
        (spec.metadata.tokenCount || 0) + response.usage.totalTokens;
    }

    this.memoryManager.appendSpecMemory(
      specId,
      `Design document generated.`,
      "note",
    );

    await this.saveSpec(spec);
  }

  async generateTasks(specId: string): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      throw new Error("Spec not found");
    }
    if (!spec.files.design) {
      throw new Error("Design not generated yet");
    }

    spec.phaseStatus = "generating";

    const requirements = spec.files.requirements
      ? fs.readFileSync(spec.files.requirements, "utf-8")
      : "";
    const design = fs.readFileSync(spec.files.design, "utf-8");
    const steering = await this.steeringManager.getCombinedSteering();
    const memory = this.memoryManager.getMemoryContext(specId);
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");

    const systemPrompt = `You are an expert project manager. Break down the design into discrete implementation tasks.

${steering}
${memory ? `\n## Project Context (Memory)\n${memory}\n` : ""}

Format your response using:\n${TASKS_TEMPLATE}

Create 5-15 tasks. Each task should take 15-30 minutes.`;

    const response = await this.llmManager.generate(modelId, [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Create implementation plan:\n\n## Requirements\n${requirements}\n\n## Design\n${design}`,
      },
    ]);

    const tasksPath = path.join(spec.path, "tasks.md");
    fs.writeFileSync(tasksPath, response.content);

    spec.files.tasks = tasksPath;
    spec.phase = "tasks";
    spec.phaseStatus = "ready";
    spec.updatedAt = Date.now();
    spec.tasks = this.parseTasksFromMarkdown(response.content);
    if (response.usage) {
      spec.metadata.tokenCount =
        (spec.metadata.tokenCount || 0) + response.usage.totalTokens;
    }

    this.memoryManager.appendSpecMemory(
      specId,
      `${spec.tasks.length} implementation tasks generated.`,
      "note",
    );

    await this.saveSpec(spec);
  }

  async approvePhase(specId: string, phase: SpecPhase): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      throw new Error("Spec not found");
    }

    spec.phaseStatus = "approved";

    this.memoryManager.appendSpecMemory(
      specId,
      `Phase "${phase}" approved by user.`,
      "decision",
    );

    const phaseOrder: SpecPhase[] = [
      "requirements",
      "design",
      "tasks",
      "execution",
    ];
    const currentIndex = phaseOrder.indexOf(phase);
    if (currentIndex < phaseOrder.length - 1) {
      spec.phase = phaseOrder[currentIndex + 1];
      spec.phaseStatus = "pending";
    }

    spec.updatedAt = Date.now();
    await this.saveSpec(spec);
  }

  async regeneratePhase(
    specId: string,
    phase: SpecPhase,
    feedback: string,
  ): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      throw new Error("Spec not found");
    }

    this.memoryManager.appendSpecMemory(
      specId,
      `Phase "${phase}" regeneration requested. Feedback: ${feedback}`,
      "note",
    );

    switch (phase) {
      case "requirements": {
        const reqContent = spec.files.requirements
          ? fs.readFileSync(spec.files.requirements, "utf-8")
          : "";
        await this.generateRequirements(
          specId,
          reqContent + "\n\nFeedback: " + feedback,
        );
        break;
      }
      case "design":
        await this.regenerateDesign(specId, feedback);
        break;
      case "tasks":
        await this.regenerateTasks(specId, feedback);
        break;
    }
  }

  private async regenerateDesign(
    specId: string,
    feedback: string,
  ): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      return;
    }

    const requirements = fs.readFileSync(spec.files.requirements!, "utf-8");
    const currentDesign = fs.readFileSync(spec.files.design!, "utf-8");
    const steering = await this.steeringManager.getCombinedSteering();
    const memory = this.memoryManager.getMemoryContext(specId);
    const modelId = await this.llmManager.getDefaultModelForPhase("design");

    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content: `You are an expert software architect. ${steering}\n\n${memory}`,
      },
      {
        role: "user",
        content: `Requirements:\n${requirements}\n\nCurrent design:\n${currentDesign}\n\nChanges requested:\n${feedback}`,
      },
    ]);

    fs.writeFileSync(spec.files.design!, response.content);
    spec.updatedAt = Date.now();
    await this.saveSpec(spec);
  }

  private async regenerateTasks(
    specId: string,
    feedback: string,
  ): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      return;
    }

    const requirements = spec.files.requirements
      ? fs.readFileSync(spec.files.requirements, "utf-8")
      : "";
    const design = fs.readFileSync(spec.files.design!, "utf-8");
    const currentTasks = fs.readFileSync(spec.files.tasks!, "utf-8");
    const steering = await this.steeringManager.getCombinedSteering();
    const memory = this.memoryManager.getMemoryContext(specId);
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");

    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content: `You are an expert project manager. ${steering}\n\n${memory}`,
      },
      {
        role: "user",
        content: `Requirements:\n${requirements}\nDesign:\n${design}\n\nCurrent tasks:\n${currentTasks}\n\nChanges:\n${feedback}`,
      },
    ]);

    fs.writeFileSync(spec.files.tasks!, response.content);
    spec.tasks = this.parseTasksFromMarkdown(response.content);
    spec.updatedAt = Date.now();
    await this.saveSpec(spec);
  }

  async generateTests(specId: string, filePath: string): Promise<string> {
    const spec = this.specs.get(specId);
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const fullPath = path.join(workspaceRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(fullPath, "utf-8");
    const ext = path.extname(filePath);
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    const steering = await this.steeringManager.getCombinedSteering();
    const memory = this.memoryManager.getMemoryContext(specId);
    const requirements = spec?.files.requirements
      ? fs.readFileSync(spec.files.requirements, "utf-8")
      : "";

    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content: `You are an expert test engineer. Write comprehensive unit tests.
${steering}
${memory}
Detect the testing framework (Jest/Vitest/Mocha/Pytest). Default to Jest for TS/JS.
Generate complete, runnable test files covering edge cases and error conditions.`,
      },
      {
        role: "user",
        content: `Generate tests for:\n\nFile: ${filePath}\n\`\`\`${ext.replace(".", "")}\n${fileContent}\n\`\`\`${requirements ? `\n\nRequirements:\n${requirements}` : ""}`,
      },
    ]);

    const baseName = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    const testPath = path.join(dir, `${baseName}.test${ext}`);
    fs.writeFileSync(path.join(workspaceRoot, testPath), response.content);
    return testPath;
  }

  async generateDocumentation(
    specId: string,
    filePath: string,
  ): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const fullPath = path.join(workspaceRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(fullPath, "utf-8");
    const ext = path.extname(filePath);
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");

    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content: `You are an expert technical writer. Add JSDoc/docstring documentation to all public functions, classes, and interfaces.
Include @param, @returns, @throws, and @example. Return ONLY the updated file content.`,
      },
      {
        role: "user",
        content: `Add documentation to:\n\nFile: ${filePath}\n\`\`\`${ext.replace(".", "")}\n${fileContent}\n\`\`\``,
      },
    ]);

    return response.content;
  }

  async reviewFile(
    specId: string | undefined,
    filePath: string,
  ): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const fullPath = path.join(workspaceRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(fullPath, "utf-8");
    const ext = path.extname(filePath);
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    const steering = await this.steeringManager.getCombinedSteering();
    const spec = specId ? this.specs.get(specId) : undefined;
    const requirements = spec?.files.requirements
      ? fs.readFileSync(spec.files.requirements, "utf-8")
      : "";

    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content: `You are an expert code reviewer. Provide a structured review.
${steering}
Format:
## Code Review: [filename]
### ✅ Strengths
### ⚠️ Issues
### 🔒 Security
### ⚡ Performance
### 💡 Suggestions`,
      },
      {
        role: "user",
        content: `Review:\n\n${filePath}\n\`\`\`${ext.replace(".", "")}\n${fileContent}\n\`\`\`${requirements ? `\n\nRequirements:\n${requirements}` : ""}`,
      },
    ]);

    return response.content;
  }

  async toggleTaskOptional(specId: string, taskId: string): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      return;
    }

    const task = spec.tasks.find((t) => t.id === taskId);
    if (task) {
      task.optional = !task.optional;
      await this.saveSpec(spec);
    }
  }

  getSpecs(): Spec[] {
    return Array.from(this.specs.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  getSpec(id: string): Spec | undefined {
    return this.specs.get(id);
  }

  async updateTaskStatus(
    specId: string,
    taskId: string,
    status: Task["status"],
  ): Promise<void> {
    const spec = this.specs.get(specId);
    if (!spec) {
      return;
    }

    const task = spec.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
      if (status === "in_progress") {
        task.startedAt = Date.now();
      } else if (status === "completed" || status === "skipped") {
        task.completedAt = Date.now();
        if (status === "completed") {
          this.memoryManager.appendSpecMemory(
            specId,
            `Task "${task.description}" completed.`,
            "note",
          );
        }
      }
      await this.saveSpec(spec);
    }
  }
}
