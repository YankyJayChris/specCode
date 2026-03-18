import * as vscode from 'vscode';
import * as path from 'path';
import { SpecManager } from '../specs/specManager';
import { Spec, SpecPhase } from '../specs/specTypes';

export class SpecsProvider implements vscode.TreeDataProvider<SpecTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SpecTreeItem | undefined | null | void> = new vscode.EventEmitter<SpecTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SpecTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private specManager: SpecManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SpecTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SpecTreeItem): Thenable<SpecTreeItem[]> {
        if (!element) {
            // Return root specs
            const specs = this.specManager.getSpecs();
            return Promise.resolve(specs.map(spec => new SpecTreeItem(spec)));
        }

        if (element.contextValue === 'spec' || element.contextValue?.startsWith('specWith')) {
            // Return spec phases as children
            return Promise.resolve(this.getPhaseItems(element.spec));
        }

        return Promise.resolve([]);
    }

    private getPhaseItems(spec: Spec): SpecTreeItem[] {
        const phases: { phase: SpecPhase; label: string; icon: string }[] = [
            { phase: 'requirements', label: '1. Requirements', icon: 'notebook' },
            { phase: 'design', label: '2. Design', icon: 'lightbulb' },
            { phase: 'tasks', label: '3. Implementation Plan', icon: 'checklist' },
            { phase: 'execution', label: '4. Execution', icon: 'play' }
        ];

        return phases.map(p => new PhaseTreeItem(spec, p.phase, p.label, p.icon));
    }
}

export class SpecTreeItem extends vscode.TreeItem {
    constructor(public readonly spec: Spec) {
        super(spec.name, vscode.TreeItemCollapsibleState.Collapsed);

        this.tooltip = `${spec.description}\nPhase: ${spec.phase}\nStatus: ${spec.phaseStatus}`;
        this.description = this.getStatusDescription(spec);
        this.contextValue = this.getContextValue(spec);
        
        // Set icon based on status
        this.iconPath = this.getIconPath(spec);
    }

    private getStatusDescription(spec: Spec): string {
        const statusMap: Record<string, string> = {
            'pending': '⏳ Pending',
            'generating': '🔄 Generating...',
            'ready': '✓ Ready for review',
            'approved': '✓ Approved',
            'executing': '▶ Executing...',
            'completed': '✅ Completed',
            'error': '❌ Error'
        };
        return statusMap[spec.phaseStatus] || spec.phaseStatus;
    }

    private getContextValue(spec: Spec): string {
        if (spec.files.tasks) return 'specWithTasks';
        if (spec.files.design) return 'specWithDesign';
        if (spec.files.requirements) return 'specWithRequirements';
        return 'spec';
    }

    private getIconPath(spec: Spec): vscode.ThemeIcon {
        switch (spec.phaseStatus) {
            case 'completed':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            case 'executing':
                return new vscode.ThemeIcon('loading~spin');
            case 'error':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('problemsErrorIcon.foreground'));
            case 'approved':
                return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
            case 'ready':
                return new vscode.ThemeIcon('circle-outline');
            default:
                return new vscode.ThemeIcon('circle-filled');
        }
    }
}

export class PhaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly spec: Spec,
        public readonly phase: SpecPhase,
        label: string,
        icon: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        this.contextValue = `phase-${phase}`;
        this.iconPath = new vscode.ThemeIcon(icon);
        
        // Set command to open the phase file
        const filePath = this.getPhaseFilePath(spec, phase);
        if (filePath) {
            this.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [vscode.Uri.file(filePath)]
            };
        }

        // Show status
        const isCurrentPhase = spec.phase === phase;
        const hasFile = filePath !== undefined;
        
        if (spec.phaseStatus === 'completed') {
            this.description = '✓ Done';
        } else if (isCurrentPhase) {
            if (spec.phaseStatus === 'generating') {
                this.description = '🔄 Generating...';
            } else if (spec.phaseStatus === 'ready') {
                this.description = '👁 Review';
            } else if (spec.phaseStatus === 'approved') {
                this.description = '✓ Approved';
            } else {
                this.description = '⏳ Pending';
            }
        } else if (hasFile) {
            this.description = '✓ Complete';
        } else {
            this.description = '○ Not started';
        }
    }

    private getPhaseFilePath(spec: Spec, phase: SpecPhase): string | undefined {
        switch (phase) {
            case 'requirements':
                return spec.files.requirements;
            case 'design':
                return spec.files.design;
            case 'tasks':
                return spec.files.tasks;
            default:
                return undefined;
        }
    }
}
