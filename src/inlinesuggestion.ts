import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';
import { buildPrompt } from './buildprompts';
 
const suggestionCache = new WeakMap<vscode.TextDocument, { position: vscode.Position; suggestion: string }>();

export function inlinesuggestionCommand(context: vscode.ExtensionContext) {

    const providers: vscode.InlineCompletionItemProvider = {
        provideInlineCompletionItems: async (document, position, context, token) => {
      const cached = suggestionCache.get(document);

      if (cached && cached.position.isEqual(position)) {
            return [];} // Avoid duplicate suggestion at the same spot



      const line = document.lineAt(position);
            const linePrefix = document.lineAt(position).text.slice(0, position.character);
            if (!linePrefix.trim()) { return []; }
//			const linePrefix = document.lineAt(position).text.slice(0, position.character);
            const prompt = buildPrompt(document, position, linePrefix); 
          console.log(prompt);
            const suggestion = (await getLLMCompletion(prompt))?.trim(); 
          if (!suggestion) {return [];}
          

//          const trimmedSuggestion = suggestion.trim();

          const linesuffix = document.lineAt(position).text.slice(position.character).trim();
          if (linesuffix.startsWith(suggestion)) {
            return []; }// already present, don't suggest again		

      suggestionCache.set(document, { position, suggestion});

            const startcharacter = position.character - linePrefix.length;
            const start = new vscode.Position(position.line,  Math.max(0, startcharacter));
            const end = position;
      
      return [
        {
            insertText: suggestion,
            range: new vscode.Range(start, end),
            }
        ];
    },
};

    context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider({ pattern: '**'}, providers)
    );
};
