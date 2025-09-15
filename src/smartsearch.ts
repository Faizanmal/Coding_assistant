import * as vscode from 'vscode';
import * as path from 'path';

export class SmartSearch {
    private static readonly IGNORE_PATTERNS = [
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/build/**',
        '**/.git/**',
        '**/.vscode/**',
        '**/coverage/**',
        '**/logs/**',
        '**/tmp/**',
        '**/temp/**',
        '**/*.log',
        '**/*.lock',
        '**/*.toml',
        '**/*.pyc',
        '**/__pycache__/**',
        '**/target/**',
        '**/bin/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/vendor/**'
    ];

    private static readonly SEARCH_EXTENSIONS = [
        'ts', 'js', 'tsx', 'jsx', 'py', 'java', 'go', 'rs', 'php', 'rb', 'cpp', 'c', 'cs', 'h', 'hpp',
        'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json', 'yaml', 'yml', 'xml', 'md', 'txt'
    ];

    static async searchFiles(query: string, searchType: 'content' | 'filename' | 'both' = 'both'): Promise<string> {
        const includePattern = `**/*.{${this.SEARCH_EXTENSIONS.join(',')}}`;
        const excludePattern = `{${this.IGNORE_PATTERNS.join(',')}}`;
        
        const files = await vscode.workspace.findFiles(includePattern, excludePattern);
        const results: string[] = [];

        for (const file of files.slice(0, 50)) {
            const relativePath = vscode.workspace.asRelativePath(file);
            
            // Skip if file is too large (>1MB)
            try {
                const stat = await vscode.workspace.fs.stat(file);
                if (stat.size > 1024 * 1024) {continue;}
            } catch { continue; }

            let matches = false;
            let matchInfo = '';

            // Filename search
            if (searchType === 'filename' || searchType === 'both') {
                if (path.basename(file.fsPath).toLowerCase().includes(query.toLowerCase())) {
                    matches = true;
                    matchInfo = `📄 **${relativePath}** (filename match)`;
                }
            }

            // Content search
            if ((searchType === 'content' || searchType === 'both') && !matches) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const text = content.toString();
                    
                    if (text.toLowerCase().includes(query.toLowerCase())) {
                        matches = true;
                        const lines = text.split('\n');
                        const matchingLines = lines
                            .map((line, i) => ({ line: line.trim(), num: i + 1 }))
                            .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()))
                            .slice(0, 3);
                        
                        matchInfo = `📄 **${relativePath}**\n${matchingLines.map(m => `   ${m.num}: ${m.line}`).join('\n')}`;
                    }
                } catch { continue; }
            }

            if (matches) {
                results.push(matchInfo);
            }
        }

        if (results.length === 0) {
            return `🔍 No matches found for "${query}"`;
        }

        return `🔍 **Search Results for "${query}"** (${results.length} matches):\n\n${results.join('\n\n')}`;
    }

    static async searchFolders(query: string): Promise<string> {
        const files = await vscode.workspace.findFiles('**/*', `{${this.IGNORE_PATTERNS.join(',')}}`);
        const folders = new Set<string>();
        
        for (const file of files) {
            const relativePath = vscode.workspace.asRelativePath(file);
            const dirPath = path.dirname(relativePath);
            
            if (dirPath !== '.' && dirPath.toLowerCase().includes(query.toLowerCase())) {
                folders.add(dirPath);
            }
        }

        if (folders.size === 0) {
            return `📁 No folders found matching "${query}"`;
        }

        const sortedFolders = Array.from(folders).sort();
        return `📁 **Folders matching "${query}"** (${sortedFolders.length} found):\n\n${sortedFolders.map(f => `📁 ${f}`).join('\n')}`;
    }

    static isSearchRequest(prompt: string): boolean {
        return /search|find.*file|find.*folder|locate.*file|where.*is/i.test(prompt);
    }

    static async handleSearchRequest(prompt: string): Promise<string> {
        // Extract search query
        const queryMatch = prompt.match(/(?:search|find|locate)\s+(?:for\s+)?["']?([^"']+)["']?/i);
        if (!queryMatch) {
            return '❌ Could not extract search query from request';
        }

        const query = queryMatch[1].trim();
        
        // Determine search type
        if (/folder|directory/i.test(prompt)) {
            return await this.searchFolders(query);
        } else if (/filename|file.*name/i.test(prompt)) {
            return await this.searchFiles(query, 'filename');
        } else if (/content|inside|contains/i.test(prompt)) {
            return await this.searchFiles(query, 'content');
        } else {
            return await this.searchFiles(query, 'both');
        }
    }
}