import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface SkillDefinition {
  name: string;
  description: string;
  prompt: string;
  source: "local" | "global";
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

/**
 * Parse SKILL.md content into frontmatter and body.
 */
function parseSkillFile(content: string, dirName: string): { frontmatter: SkillFrontmatter; body: string } {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    return { frontmatter: { name: dirName }, body: trimmed };
  }

  const endIdx = trimmed.indexOf("---", 3);
  if (endIdx === -1) {
    return { frontmatter: { name: dirName }, body: trimmed };
  }

  const yamlBlock = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trim();

  // Simple YAML parser for flat key-value pairs
  const frontmatter: SkillFrontmatter = {};
  for (const line of yamlBlock.split("\n")) {
    const match = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (match) {
      const key = match[1] as keyof SkillFrontmatter;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      (frontmatter as any)[key] = value;
    }
  }

  if (!frontmatter.name) {
    frontmatter.name = dirName;
  }

  return { frontmatter, body };
}

/**
 * Scan a skills directory and load all SKILL.md files.
 */
async function loadSkillsFromDir(
  dir: string,
  source: "local" | "global"
): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = [];

  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return skills;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillFile = path.join(dir, entry.name, "SKILL.md");
    try {
      const content = await fs.readFile(skillFile, "utf-8");
      const { frontmatter, body } = parseSkillFile(content, entry.name);

      skills.push({
        name: frontmatter.name || entry.name,
        description: frontmatter.description || "",
        prompt: body,
        source,
      });
    } catch {
      // SKILL.md doesn't exist or can't be read — skip
    }
  }

  return skills;
}

/**
 * Load all skills from global (~/.hime/skills/) and local (.agents/skills/) directories.
 * Local skills override global skills with the same name.
 */
export async function loadAllSkills(workspacePath?: string): Promise<SkillDefinition[]> {
  const globalDir = path.join(os.homedir(), ".hime", "skills");
  const globalSkills = await loadSkillsFromDir(globalDir, "global");

  let localSkills: SkillDefinition[] = [];
  if (workspacePath) {
    const localDir = path.join(workspacePath, ".agents", "skills");
    localSkills = await loadSkillsFromDir(localDir, "local");
  }

  // Local overrides global (same name)
  const skillMap = new Map<string, SkillDefinition>();
  for (const skill of globalSkills) {
    skillMap.set(skill.name, skill);
  }
  for (const skill of localSkills) {
    skillMap.set(skill.name, skill);
  }

  return Array.from(skillMap.values());
}

/**
 * Find a skill by name (exact match).
 */
export async function findSkill(
  name: string,
  workspacePath?: string
): Promise<SkillDefinition | undefined> {
  const skills = await loadAllSkills(workspacePath);
  return skills.find((s) => s.name === name);
}

/**
 * Expand variables in a skill prompt.
 */
export function expandSkillPrompt(
  prompt: string,
  variables: {
    arguments?: string;
    selection?: string;
    activeFile?: string;
  }
): string {
  let result = prompt;

  // $ARGUMENTS
  result = result.replace(/\$ARGUMENTS/g, variables.arguments || "");

  // {{selection}}
  result = result.replace(/\{\{selection\}\}/g, variables.selection || "(選択範囲なし)");

  // {{activeFile}}
  result = result.replace(/\{\{activeFile\}\}/g, variables.activeFile || "(ファイルなし)");

  return result.trim();
}

/**
 * Build the help text for /help command (built-in commands + skills).
 */
export function buildHelpText(skills: SkillDefinition[]): string {
  const lines = [
    "## Hime ヘルプ\n",
    "### ビルトインコマンド",
    "| コマンド | 説明 |",
    "|---|---|",
    "| `/help` | このヘルプを表示 |",
    "| `/compact` | 会話を要約してコンテキストを圧縮 |",
    "| `/clear` | コンテキストをクリア |",
    "| `/skills` | スキル一覧を表示 |",
  ];

  if (skills.length > 0) {
    lines.push("");
    lines.push("### スキル");
    lines.push("| コマンド | 説明 | ソース |");
    lines.push("|---|---|---|");
    for (const skill of skills) {
      const source = skill.source === "local" ? "ローカル" : "グローバル";
      lines.push(`| \`/${skill.name}\` | ${skill.description || "-"} | ${source} |`);
    }
  }

  lines.push("");
  lines.push("### 使い方");
  lines.push("- `/コマンド名` で実行（例: `/compact`）");
  lines.push("- `/スキル名 引数` で引数付き実行（例: `/commit fix: typo`）");

  return lines.join("\n");
}

/**
 * Build the help text for /skills command.
 */
export function buildSkillsHelpText(skills: SkillDefinition[]): string {
  if (skills.length === 0) {
    return `## スキル

スキルが見つかりませんでした。

### スキルの追加方法

\`~/.hime/skills/<skill-name>/SKILL.md\` (グローバル) または
\`.agents/skills/<skill-name>/SKILL.md\` (プロジェクト) にファイルを作成してください。

\`\`\`markdown
---
name: my-skill
description: スキルの説明
---

プロンプト本文。$ARGUMENTS で引数を受け取れます。
\`\`\``;
  }

  const lines = [
    "## スキル一覧\n",
    "| コマンド | 説明 | ソース |",
    "|---|---|---|",
  ];

  for (const skill of skills) {
    const source = skill.source === "local" ? "ローカル" : "グローバル";
    lines.push(`| \`/${skill.name}\` | ${skill.description || "-"} | ${source} |`);
  }

  lines.push("");
  lines.push("### 使い方");
  lines.push("- `/スキル名` で実行（例: `/commit`）");
  lines.push("- `/スキル名 引数` で引数付き実行（例: `/commit fix: typo`）");
  lines.push("");
  lines.push("### 変数");
  lines.push("| 変数 | 内容 |");
  lines.push("|---|---|");
  lines.push("| `$ARGUMENTS` | コマンドの後のテキスト |");
  lines.push("| `{{selection}}` | エディタの選択範囲 |");
  lines.push("| `{{activeFile}}` | アクティブファイルのパス |");
  lines.push("");
  lines.push("### スキルの追加");
  lines.push("`~/.hime/skills/<name>/SKILL.md` (グローバル) または `.agents/skills/<name>/SKILL.md` (プロジェクト) に配置");

  return lines.join("\n");
}
