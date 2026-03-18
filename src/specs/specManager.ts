import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Spec, SpecPhase, Task, RequirementsData, DesignData, EARS_TEMPLATE, DESIGN_TEMPLATE, TASKS_TEMPLATE } from './specTypes';
import { LLMManager } from '../llm/llmManager';
import { SteeringManager } from '../steering/steeringManager';
import { KiroFolderManager } from '../utils/kiroFolder';

export class SpecManager {
    private specs: Map<string, Spec> = new Map();
    private specsFolder: string = '';

    constructor(
        private kiroFolder: KiroFolderManager,
        private llmManager: LLMManager,
        private steeringManager: SteeringManager
    ) {
        this.loadSpecs();
    }

    private async loadSpecs() {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) return;

        this.specsFolder = path.join(workspaceRoot, '.kiro', 'specs');
        
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
        const metadataPath = path.join(specPath, 'metadata.json');

        let spec: Spec;

        if (fs.existsSync(metadataPath)) {
            const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            spec = {
                ...data,
                path: specPath,
                tasks: data.tasks || []
            };
        } else {
            spec = {
                id: uuidv4(),
                name,
                description: '',
                path: specPath,
                phase: 'requirements',
                phaseStatus: 'pending',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                files: {},
                tasks: [],
                metadata: {}
            };
        }

        // Check which files exist
        const requirementsPath = path.join(specPath, 'requirements.md');
        const designPath = path.join(specPath, 'design.md');
        const tasksPath = path.join(specPath, 'tasks.md');

        if (fs.existsSync(requirementsPath)) {
            spec.files.requirements = requirementsPath;
            if (spec.phase === 'requirements') {
                spec.phaseStatus = 'ready';
            }
        }

        if (fs.existsSync(designPath)) {
            spec.files.design = designPath;
            if (spec.phase === 'design' || (spec.phase === 'requirements' && spec.files.requirements)) {
                spec.phase = 'design';
                spec.phaseStatus = 'ready';
            }
        }

        if (fs.existsSync(tasksPath)) {
            spec.files.tasks = tasksPath;
            if (spec.phase === 'tasks' || (spec.phase === 'design' && spec.files.design)) {
                spec.phase = 'tasks';
                spec.phaseStatus = 'ready';
            }
            
            // Parse tasks
            spec.tasks = this.parseTasksFromMarkdown(fs.readFileSync(tasksPath, 'utf-8'));
        }

        this.specs.set(spec.id, spec);
    }

    private parseTasksFromMarkdown(content: string): Task[] {
        const tasks: Task[] = [];
        const taskRegex = /### Task (\d+): ([^\n]+)\n- \*\*Description\*\*: ([^\n]+)\n- \*\*Expected Outcome\*\*: ([^\n]+)(?:\n- \*\*Dependencies\*\*: ([^\n]+))?/g;
        
        let match;
        while ((match = taskRegex.exec(content)) !== null) {
            tasks.push({
                id: `task-${match[1]}`,
                description: match[3].trim(),
                expectedOutcome: match[4].trim(),
                dependencies: match[5] ? match[5].split(',').map(d => d.trim()).filter(d => d) : [],
                resources: [],
                optional: false,
                status: 'pending'
            });
        }

        return tasks;
    }

    async createSpec(name: string, description: string): Promise<Spec> {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) {
            throw new Error('No workspace open');
        }

        const specPath = path.join(workspaceRoot, '.kiro', 'specs', name);
        
        if (fs.existsSync(specPath)) {
            throw new Error(`Spec "${name}" already exists`);
        }

        fs.mkdirSync(specPath, { recursive: true });

        const spec: Spec = {
            id: uuidv4(),
            name,
            description,
            path: specPath,
            phase: 'requirements',
            phaseStatus: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            files: {},
            tasks: [],
            metadata: {}
        };

        this.specs.set(spec.id, spec);
        await this.saveSpec(spec);

        return spec;
    }

    async deleteSpec(id: string): Promise<void> {
        const spec = this.specs.get(id);
        if (!spec) return;

        if (fs.existsSync(spec.path)) {
            fs.rmSync(spec.path, { recursive: true });
        }

        this.specs.delete(id);
    }

    private async saveSpec(spec: Spec): Promise<void> {
        const metadataPath = path.join(spec.path, 'metadata.json');
        const { path: _, ...data } = spec;
        fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
    }

    async generateRequirements(specId: string, prompt: string): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) throw new Error('Spec not found');

        spec.phaseStatus = 'generating';
        
        const steering = await this.steeringManager.getCombinedSteering();
        const modelId = await this.llmManager.getDefaultModelForPhase('requirements');
        
        const systemPrompt = `You are an expert requirements analyst. Generate comprehensive requirements following the EARS (Easy Approach to Requirements Syntax) standard.

${steering}

Your response must be a complete requirements document with:
1. User stories with acceptance criteria
2. In scope and out of scope items
3. Edge cases
4. Assumptions and dependencies

Use the following format:

${EARS_TEMPLATE}`;

        const response = await this.llmManager.generate(modelId, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate requirements for: ${prompt}\n\nSpec name: ${spec.name}\nDescription: ${spec.description}` }
        ]);

        const requirementsPath = path.join(spec.path, 'requirements.md');
        fs.writeFileSync(requirementsPath, response.content);

        spec.files.requirements = requirementsPath;
        spec.phase = 'requirements';
        spec.phaseStatus = 'ready';
        spec.updatedAt = Date.now();
        spec.metadata.modelId = modelId;
        
        if (response.usage) {
            spec.metadata.tokenCount = (spec.metadata.tokenCount || 0) + response.usage.totalTokens;
        }

        await this.saveSpec(spec);
    }

    async generateDesign(specId: string): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) throw new Error('Spec not found');
        if (!spec.files.requirements) throw new Error('Requirements not generated yet');

        spec.phaseStatus = 'generating';

        const requirements = fs.readFileSync(spec.files.requirements, 'utf-8');
        const steering = await this.steeringManager.getCombinedSteering();
        const modelId = await this.llmManager.getDefaultModelForPhase('design');

        const systemPrompt = `You are an expert software architect. Create a detailed technical design document based on the requirements.

${steering}

Your response must include:
1. Architecture overview
2. Component breakdown with responsibilities
3. Data models
4. API endpoints
5. Sequence diagrams (using Mermaid syntax)
6. Error handling strategy
7. Technology choices with rationale
8. Security considerations

Use the following format:

${DESIGN_TEMPLATE}`;

        const response = await this.llmManager.generate(modelId, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Create a technical design for the following requirements:\n\n${requirements}` }
        ]);

        const designPath = path.join(spec.path, 'design.md');
        fs.writeFileSync(designPath, response.content);

        spec.files.design = designPath;
        spec.phase = 'design';
        spec.phaseStatus = 'ready';
        spec.updatedAt = Date.now();

        if (response.usage) {
            spec.metadata.tokenCount = (spec.metadata.tokenCount || 0) + response.usage.totalTokens;
        }

        await this.saveSpec(spec);
    }

    async generateTasks(specId: string): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) throw new Error('Spec not found');
        if (!spec.files.design) throw new Error('Design not generated yet');

        spec.phaseStatus = 'generating';

        const requirements = spec.files.requirements ? fs.readFileSync(spec.files.requirements, 'utf-8') : '';
        const design = fs.readFileSync(spec.files.design, 'utf-8');
        const steering = await this.steeringManager.getCombinedSteering();
        const modelId = await this.llmManager.getDefaultModelForPhase('execution');

        const systemPrompt = `You are an expert project manager. Break down the design into discrete, trackable implementation tasks.

${steering}

Your response must be a task list where each task includes:
- Clear description
- Expected outcome
- Dependencies on other tasks
- Resources needed
- Optional flag (true/false)

Use the following format:

${TASKS_TEMPLATE}

Create 5-15 tasks depending on complexity. Tasks should be small enough to complete in 15-30 minutes.`;

        const response = await this.llmManager.generate(modelId, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Create an implementation plan based on:\n\n## Requirements\n${requirements}\n\n## Design\n${design}` }
        ]);

        const tasksPath = path.join(spec.path, 'tasks.md');
        fs.writeFileSync(tasksPath, response.content);

        spec.files.tasks = tasksPath;
        spec.phase = 'tasks';
        spec.phaseStatus = 'ready';
        spec.updatedAt = Date.now();
        spec.tasks = this.parseTasksFromMarkdown(response.content);

        if (response.usage) {
            spec.metadata.tokenCount = (spec.metadata.tokenCount || 0) + response.usage.totalTokens;
        }

        await this.saveSpec(spec);
    }

    async approvePhase(specId: string, phase: SpecPhase): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) throw new Error('Spec not found');

        spec.phaseStatus = 'approved';
        
        // Move to next phase
        const phaseOrder: SpecPhase[] = ['requirements', 'design', 'tasks', 'execution'];
        const currentIndex = phaseOrder.indexOf(phase);
        if (currentIndex < phaseOrder.length - 1) {
            spec.phase = phaseOrder[currentIndex + 1];
            spec.phaseStatus = 'pending';
        }

        spec.updatedAt = Date.now();
        await this.saveSpec(spec);
    }

    async regeneratePhase(specId: string, phase: SpecPhase, feedback: string): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) throw new Error('Spec not found');

        // Regenerate based on phase
        switch (phase) {
            case 'requirements':
                const reqPrompt = fs.readFileSync(spec.files.requirements!, 'utf-8');
                await this.generateRequirements(specId, reqPrompt + '\n\nFeedback: ' + feedback);
                break;
            case 'design':
                await this.regenerateDesign(specId, feedback);
                break;
            case 'tasks':
                await this.regenerateTasks(specId, feedback);
                break;
        }
    }

    private async regenerateDesign(specId: string, feedback: string): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) return;

        const requirements = fs.readFileSync(spec.files.requirements!, 'utf-8');
        const currentDesign = fs.readFileSync(spec.files.design!, 'utf-8');
        const steering = await this.steeringManager.getCombinedSteering();
        const modelId = await this.llmManager.getDefaultModelForPhase('design');

        const response = await this.llmManager.generate(modelId, [
            { role: 'system', content: `You are an expert software architect. ${steering}` },
            { role: 'user', content: `Based on these requirements:\n${requirements}\n\nCurrent design:\n${currentDesign}\n\nPlease regenerate the design with the following changes:\n${feedback}` }
        ]);

        fs.writeFileSync(spec.files.design!, response.content);
        spec.updatedAt = Date.now();
        await this.saveSpec(spec);
    }

    private async regenerateTasks(specId: string, feedback: string): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) return;

        const requirements = spec.files.requirements ? fs.readFileSync(spec.files.requirements, 'utf-8') : '';
        const design = fs.readFileSync(spec.files.design!, 'utf-8');
        const currentTasks = fs.readFileSync(spec.files.tasks!, 'utf-8');
        const steering = await this.steeringManager.getCombinedSteering();
        const modelId = await this.llmManager.getDefaultModelForPhase('execution');

        const response = await this.llmManager.generate(modelId, [
            { role: 'system', content: `You are an expert project manager. ${steering}` },
            { role: 'user', content: `Based on:\nRequirements: ${requirements}\nDesign: ${design}\n\nCurrent tasks:\n${currentTasks}\n\nPlease regenerate the task list with these changes:\n${feedback}` }
        ]);

        fs.writeFileSync(spec.files.tasks!, response.content);
        spec.tasks = this.parseTasksFromMarkdown(response.content);
        spec.updatedAt = Date.now();
        await this.saveSpec(spec);
    }

    async toggleTaskOptional(specId: string, taskId: string): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) return;

        const task = spec.tasks.find(t => t.id === taskId);
        if (task) {
            task.optional = !task.optional;
            await this.saveSpec(spec);
        }
    }

    getSpecs(): Spec[] {
        return Array.from(this.specs.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    getSpec(id: string): Spec | undefined {
        return this.specs.get(id);
    }

    async updateTaskStatus(specId: string, taskId: string, status: Task['status']): Promise<void> {
        const spec = this.specs.get(specId);
        if (!spec) return;

        const task = spec.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = status;
            if (status === 'in_progress') {
                task.startedAt = Date.now();
            } else if (status === 'completed' || status === 'skipped') {
                task.completedAt = Date.now();
            }
            await this.saveSpec(spec);
        }
    }
}
