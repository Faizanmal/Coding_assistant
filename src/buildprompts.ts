import * as vscode from 'vscode';
import * as path from 'path';

export function getFileInfo(document: vscode.TextDocument): string {
  const ext = path.extname(document.uri.fsPath);
  const relativePath = vscode.workspace.asRelativePath(document.uri);
  return `File: ${relativePath} (extension: ${ext})`;
}

export function getTopLevelImports(document: vscode.TextDocument): string {
  const text = document.getText();
  const importLines = text
    .split('\n')
    .filter(line =>
      line.trim().startsWith('import') || line.trim().startsWith('from')
    );
  return importLines.join('\n');
}

export function getFileContext(document: vscode.TextDocument): string {
  const fileName = document.fileName;
  const language = document.languageId;
  const imports = getTopLevelImports(document);

  return `Current file: ${fileName}\nLanguage: ${language}\nImports:\n${imports}`;
}

export function buildPrompt(document: vscode.TextDocument, position: vscode.Position, linePrefix: string): string {
  const workspacefolder = vscode.workspace.workspaceFolders;
  const rootpath = workspacefolder?.[0]?.uri.fsPath || '';
  const fileInfo = getFileInfo(document);
  const topimports = getTopLevelImports(document);	
  const fullText = document.getText();
  const beforeCursor = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
  	const prompt = `
You are a helpful AI writing Python code.
Here is the current file content before the cursor:
${beforeCursor}

Now continue from here:
${linePrefix}
	`;

  const maxLines = 20;
  const startLine = Math.max(0, position.line - maxLines);
  const contextLines = [];

  for (let i = startLine; i < position.line; i++) {
    contextLines.push(document.lineAt(i).text);
  }

  contextLines.push(linePrefix);

  const timestamp = new Date().toISOString();

  const language = document.languageId;
	let commentPrefix = '//';
	if (language === 'python') {commentPrefix = '#';}
	else if (language === 'html') {commentPrefix = '<!--';}
	else if (language === 'css') {commentPrefix = '/*';}

	const timestampcomment = `${commentPrefix} Generated on ${new Date().toISOString()}`;
   
  	return [
		`# Context-aware code suggestion`,
		`# ${fileInfo}`,
    prompt.trim(),
    timestamp,
		topimports,
		 contextLines.join('\n'),
		 `${timestampcomment}`
	].join('\n\n');
}
