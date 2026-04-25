import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

export async function readWorkspaceFile(fileName: string): Promise<string | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const filePath = path.join(rootPath, fileName);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch {
    return null;
  }
}

export async function loadProjectContext(): Promise<{
  claudeMd?: string;
  agentsMd?: string;
  geminiMd?: string;
  readmeMd?: string;
}> {
  const [agentsMd, claudeMd, geminiMd, readmeMd] = await Promise.all([
    readWorkspaceFile("AGENTS.md"),
    readWorkspaceFile("CLAUDE.md"),
    readWorkspaceFile("GEMINI.md"),
    readWorkspaceFile("README.md"),
  ]);

  if (agentsMd !== null) {
    return { agentsMd };
  }
  if (claudeMd !== null) {
    return { claudeMd };
  }
  if (geminiMd !== null) {
    return { geminiMd };
  }
  if (readmeMd !== null) {
    return { readmeMd };
  }

  return {};
}
