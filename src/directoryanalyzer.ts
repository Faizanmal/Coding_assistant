import * as vscode from 'vscode';
import * as path from 'path';
import { callAI } from './cli-api';

interface DirectoryNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: DirectoryNode[];
    size?: number;
    language?: string;
}

export class DirectoryAnalyzer {
    static async getDirectoryStructure(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return 'No workspace open';
        }

        const tree = await this.buildDirectoryTree(workspaceFolder.uri.fsPath);
        const analysis = await this.analyzeStructure(tree);
        
        return `📁 **Directory Structure Analysis:**\n\n${this.formatTree(tree)}\n\n${analysis}`;
    }

    private static async buildDirectoryTree(rootPath: string, maxDepth = 3, currentDepth = 0): Promise<DirectoryNode> {
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
        const structure: DirectoryNode = {
            name: path.basename(rootPath),
            type: 'directory',
            path: rootPath,
            children: []
        };

        const pathMap = new Map<string, DirectoryNode>();
        pathMap.set(rootPath, structure);

        for (const file of files.slice(0, 100)) {
            const relativePath = vscode.workspace.asRelativePath(file);
            const parts = relativePath.split(path.sep);
            
            let currentNode = structure;
            let currentPath = rootPath;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                currentPath = path.join(currentPath, part);
                
                if (!currentNode.children) {
                    currentNode.children = [];
                }
                
                let childNode = currentNode.children.find(child => child.name === part);
                
                if (!childNode) {
                    const isFile = i === parts.length - 1;
                    childNode = {
                        name: part,
                        type: isFile ? 'file' : 'directory',
                        path: currentPath,
                        language: isFile ? this.getLanguage(part) : undefined
                    };
                    
                    if (!isFile) {
                        childNode.children = [];
                    }
                    currentNode.children.push(childNode);
                }
                
                currentNode = childNode;
            }
        }

        return structure;
    }

    private static formatTree(node: DirectoryNode, indent = ''): string {
        let result = `${indent}${node.type === 'directory' ? '📁' : '📄'} ${node.name}`;
        
        if (node.language) {
            result += ` (${node.language})`;
        }
        result += '\n';

        if (node.children) {
            const sortedChildren = node.children.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            for (let i = 0; i < sortedChildren.length && i < 10; i++) {
                const child = sortedChildren[i];
                const isLast = i === Math.min(sortedChildren.length, 10) - 1;
                const newIndent = indent + (isLast ? '└── ' : '├── ');
                result += this.formatTree(child, newIndent);
            }
            
            if (sortedChildren.length > 10) {
                result += `${indent}└── ... (${sortedChildren.length - 10} more items)\n`;
            }
        }

        return result;
    }

    private static async analyzeStructure(tree: DirectoryNode): Promise<string> {
        const stats = this.getStructureStats(tree);
        
        const analysisPrompt = `Analyze this project structure and provide insights:

STRUCTURE STATS:
- Total directories: ${stats.directories}
- Total files: ${stats.files}
- Languages: ${stats.languages.join(', ')}
- Max depth: ${stats.maxDepth}

KEY DIRECTORIES: ${stats.keyDirs.join(', ')}

Provide:
1. Project type identification
2. Architecture pattern
3. Recommendations for organization
4. Missing standard directories`;

        return await callAI(analysisPrompt);
    }

    private static getStructureStats(node: DirectoryNode, depth = 0): {
        directories: number;
        files: number;
        languages: string[];
        maxDepth: number;
        keyDirs: string[];
    } {
        let stats = {
            directories: node.type === 'directory' ? 1 : 0,
            files: node.type === 'file' ? 1 : 0,
            languages: node.language ? [node.language] : [],
            maxDepth: depth,
            keyDirs: this.isKeyDirectory(node.name) ? [node.name] : []
        };

        if (node.children) {
            for (const child of node.children) {
                const childStats = this.getStructureStats(child, depth + 1);
                stats.directories += childStats.directories;
                stats.files += childStats.files;
                stats.languages.push(...childStats.languages);
                stats.maxDepth = Math.max(stats.maxDepth, childStats.maxDepth);
                stats.keyDirs.push(...childStats.keyDirs);
            }
        }

        stats.languages = [...new Set(stats.languages)];
        stats.keyDirs = [...new Set(stats.keyDirs)];
        
        return stats;
    }

    private static isKeyDirectory(name: string): boolean {
        const keyDirs = ['src', 'lib', 'components', 'pages', 'api', 'utils', 'services', 'models', 'controllers', 'views', 'public', 'assets', 'tests', '__tests__', 'spec'];
        return keyDirs.includes(name.toLowerCase());
    }

    private static getLanguage(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const langMap: { [key: string]: string } = {
            '.js': 'JavaScript', '.ts': 'TypeScript', '.py': 'Python',
            '.java': 'Java', '.go': 'Go', '.rs': 'Rust',
            '.php': 'PHP', '.rb': 'Ruby', '.cpp': 'C++',
            '.c': 'C', '.cs': 'C#', '.html': 'HTML',
            '.css': 'CSS', '.json': 'JSON', '.md': 'Markdown'
        };
        return langMap[ext] || 'Unknown';
    }

    static isDirectoryRequest(prompt: string): boolean {
        return /directory|structure|folder|organization|architecture|project.*layout/i.test(prompt);
    }
}
