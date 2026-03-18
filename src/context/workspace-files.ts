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
  readmeMd?: string;
}> {
  const [claudeMd, agentsMd, readmeMd] = await Promise.all([
    readWorkspaceFile("CLAUDE.md"),
    readWorkspaceFile("AGENTS.md"),
    readWorkspaceFile("README.md"),
  ]);

  const result: { claudeMd?: string; agentsMd?: string; readmeMd?: string } = {};

  if (claudeMd !== null) {
    result.claudeMd = claudeMd;
  }
  if (agentsMd !== null) {
    result.agentsMd = agentsMd;
  }
  if (readmeMd !== null) {
    result.readmeMd = readmeMd;
  }

  return result;
}
