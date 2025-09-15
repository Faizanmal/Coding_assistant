
import * as vscode from 'vscode';
import { pipeline, env } from '@xenova/transformers';

// The following line is important to ensure that the model is downloaded to the correct location.
env.cacheDir = './.cache';

// Caching the pipeline
let extractor: any;

/**
 * Generates embeddings for a given text.
 * @param text The text to generate embeddings for.
 * @returns A promise that resolves with the embedding.
 */
async function generateEmbedding(text: string): Promise<any> {
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return await extractor(text, { pooling: 'mean', normalize: true });
}

/**
 * Performs a semantic search on the workspace.
 * @param query The natural language query to search for.
 * @returns A promise that resolves with an array of search results.
 */
async function semanticSearch(query: string): Promise<vscode.Uri[]> {
    const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java,go,rb,php,cs,cpp,c,h,hpp,html,css,json,md}', '**/node_modules/**');
    const queryEmbedding = await generateEmbedding(query);

    const results = await Promise.all(files.map(async (file) => {
        const document = await vscode.workspace.openTextDocument(file);
        const text = document.getText();
        const fileEmbedding = await generateEmbedding(text);

        // Using cosine similarity
        let similarity = 0;
        for (let i = 0; i < queryEmbedding.data.length; i++) {
            similarity += queryEmbedding.data[i] * fileEmbedding.data[i];
        }

        return { file, similarity };
    }));

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, 10).map(result => result.file);
}

/**
 * Activates the semantic search feature.
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('coding.semanticSearch', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'Enter your natural language search query',
            placeHolder: 'e.g., "Find where the user authentication happens"',
        });

        if (query) {
            const results = await semanticSearch(query);
            const items = results.map(file => ({
                label: vscode.workspace.asRelativePath(file),
                description: file.fsPath,
                uri: file
            }));

            const selected = await vscode.window.showQuickPick(items, {
                matchOnDescription: true,
                placeHolder: 'Search results',
            });

            if (selected) {
                const document = await vscode.workspace.openTextDocument(selected.uri);
                await vscode.window.showTextDocument(document);
            }
        }
    });

    context.subscriptions.push(disposable);
}
