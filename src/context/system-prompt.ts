import * as os from "os";

export function buildSystemPrompt(params: {
  workspacePath: string;
  activeFile?: { filePath: string; language: string; content: string } | null;
  projectContext: { claudeMd?: string; agentsMd?: string; readmeMd?: string };
  userSystemPrompt?: string;
}): string {
  const { workspacePath, activeFile, projectContext, userSystemPrompt } = params;

  const platform = process.platform;
  const osName = platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : "Linux";
  const shell = platform === "win32" ? "PowerShell" : "bash";

  const sections: string[] = [];

  // Base instructions
  sections.push(`あなたは優秀なAIアシスタントです。日本語で応答してください。`);

  // Workspace
  sections.push(`## 作業ディレクトリ\n${workspacePath}`);

  // OS and shell
  sections.push(`## 環境\n- OS: ${osName}\n- シェル: ${shell}\n- コマンド実行時は${shell}のコマンドを使用してください。`);

  // Code editing rules
  sections.push(
    `## コード編集ルール\n` +
      `- コードを編集する際は、まず該当ファイルをReadツールで読み取ってください。\n` +
      `- その後、EditまたはWriteツールで変更を適用してください。\n` +
      `- 変更前に必ず現在の内容を確認してから編集してください。`
  );

  // Active file
  if (activeFile) {
    sections.push(
      `## 現在開いているファイル\n` +
        `- パス: ${activeFile.filePath}\n` +
        `- 言語: ${activeFile.language}\n` +
        `\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``
    );
  }

  // Project context files
  if (projectContext.claudeMd) {
    sections.push(`## CLAUDE.md\n${projectContext.claudeMd}`);
  }
  if (projectContext.agentsMd) {
    sections.push(`## AGENTS.md\n${projectContext.agentsMd}`);
  }
  if (projectContext.readmeMd) {
    sections.push(`## README.md\n${projectContext.readmeMd}`);
  }

  // User system prompt
  if (userSystemPrompt) {
    sections.push(`## ユーザー指示\n${userSystemPrompt}`);
  }

  return sections.join("\n\n");
}
