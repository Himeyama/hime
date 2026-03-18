import * as vscode from "vscode";

export class ActiveEditorTracker {
  private disposable: vscode.Disposable;
  private onChange: (filePath: string, language: string) => void;

  constructor(onChange: (filePath: string, language: string) => void) {
    this.onChange = onChange;
    this.disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        const filePath = editor.document.uri.fsPath;
        const language = editor.document.languageId;
        this.onChange(filePath, language);
      }
    });
  }

  getContext(): { filePath: string; language: string; content: string } | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }

    return {
      filePath: editor.document.uri.fsPath,
      language: editor.document.languageId,
      content: editor.document.getText(),
    };
  }

  dispose(): void {
    this.disposable.dispose();
  }
}
