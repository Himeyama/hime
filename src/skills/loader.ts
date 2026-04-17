import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface SkillDefinition {
  name: string;
  description: string;
  prompt: string;
  source: "local" | "global" | "builtin";
}

// ─── Built-in Skills ─────────────────────────────────────────────────────────

const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    name: "commit",
    description: "ステージ済みの変更を解析してコミットメッセージを生成し、git commit を実行",
    source: "builtin",
    prompt: `ステージング済みの変更を確認し、適切なコミットメッセージを生成してコミットしてください。

手順:
1. \`git diff --staged\` でステージ済みの変更を確認する
2. ステージ済みの変更がなければ \`git status\` を確認して報告する (コミットしない)
3. 変更内容を分析して、Conventional Commits 形式のコミットメッセージを生成する
   - 形式: \`<type>: <description>\`
   - type: feat, fix, docs, style, refactor, test, chore など
   - description は日本語で簡潔に (72文字以内) 
   - 変更が複数ファイル・複数目的にわたる場合は本文も追加
4. \`git commit -m "<message>"\` でコミットを実行する
5. コミット結果 (ハッシュ・変更ファイル数・行数) を報告する

$ARGUMENTS が指定された場合は、その内容をコミットメッセージのヒントとして使用してください。`,
  },
  {
    name: "push",
    description: "現在のブランチをリモートにプッシュ",
    source: "builtin",
    prompt: `現在のブランチをリモートリポジトリにプッシュしてください。

手順：
1. \`git status\` で現在のブランチと未コミット変更の有無を確認する
2. 未コミット変更がある場合は警告してユーザーの意図を確認する
3. \`git remote -v\` でリモートの設定を確認する
4. \`git push origin <現在のブランチ名>\` でプッシュを実行する
   - 初回プッシュ (上流ブランチ未設定) の場合は \`--set-upstream\` を付ける
5. プッシュ結果 (URL・ブランチ名・コミット数) を報告する

$ARGUMENTS が指定された場合は追加の git push オプションとして使用してください。`,
  },
  {
    name: "explain",
    description: "選択コードまたはアクティブファイルを詳しく説明",
    source: "builtin",
    prompt: `以下のコードを詳しく説明してください。

ファイル: {{activeFile}}

\`\`\`
{{selection}}
\`\`\`

$ARGUMENTS

対象コードが選択されていない場合は、Read ツールでアクティブファイルを読み込んで説明してください。

説明の構成：
1. **目的** — このコードが何をするかを 1〜2 文で説明
2. **処理の流れ** — 入力→処理→出力の流れをステップで説明
3. **重要なポイント** — アルゴリズムの特徴・設計上の工夫・注意すべき副作用
4. **依存関係** — 使用している主要な外部ライブラリ・モジュールとその役割

初級〜中級開発者が理解できるレベルで、簡潔かつ正確に説明してください。`,
},
{
  name: "review",
  description: "選択コードまたはアクティブファイルのコードレビューを実施",
  source: "builtin",
  prompt: `以下のコードをレビューしてください。
  
ファイル: {{activeFile}}

\`\`\`
{{selection}}
\`\`\`

$ARGUMENTS

対象コードが選択されていない場合は、Read ツールでアクティブファイルを読み込んでレビューしてください。

レビュー観点 (優先順位順) ：
1. **バグ・ロジックエラー** — 明らかなバグ、エッジケースの未処理、off-by-one エラーなど
2. **セキュリティ** — インジェクション、XSS、認証・認可の欠陥、機密情報の露出など
3. **パフォーマンス** — 不要なループ、N+1 問題、メモリリーク、非効率なアルゴリズムなど
4. **保守性** — 関数の責務分離、命名の明瞭さ、重複コードなど
5. **良い点** — 特に優れた実装があれば言及する

出力形式：
\`\`\`
🔴 Critical   : [ファイル名:行番号] — 説明
🟡 Warning    : [ファイル名:行番号] — 説明
🔵 Info       : [ファイル名:行番号] — 説明
✅ 良い点     : 説明
\`\`\`
問題が一切なければ「✨ 問題なし」とだけ記載してください。`,
  },
  {
    name: "fix",
    description: "選択コードまたはアクティブファイルのバグ・問題を修正",
    source: "builtin",
    prompt: `以下のコードの問題を修正してください。

ファイル: {{activeFile}}

\`\`\`
{{selection}}
\`\`\`

$ARGUMENTS

修正の手順：
1. まず Read ツールで対象ファイルを読み込み、問題の全体像を把握する
2. エラーメッセージや問題の根本原因を特定する (症状ではなく原因を修正すること) 
3. Edit ツールで最小限の変更を行う (関係ない部分は変更しない) 
4. 修正後、関連するテストがあれば実行して回帰がないことを確認する
5. 修正内容を unified diff 形式で簡潔に報告する

選択範囲がない場合は、アクティブファイルで報告されている問題を特定して修正してください。`,
  },
  {
    name: "test",
    description: "選択コードまたはアクティブファイルに対するテストを生成",
    source: "builtin",
    prompt: `以下のコードに対するテストを生成してください。

ファイル: {{activeFile}}

\`\`\`
{{selection}}
\`\`\`

$ARGUMENTS

テスト生成の手順：
1. Read ツールで対象ファイルを読み込み、テスト対象の関数・クラスを把握する
2. プロジェクト内の既存テストファイルを Glob/Read で確認し、テストフレームワーク・命名規則・スタイルに合わせる
3. 以下のケースを網羅するテストを生成する：
   - **正常系** — 典型的な入力での期待通りの動作
   - **異常系** — 不正な入力、エラーケース、例外処理
   - **エッジケース** — 空値・null・undefined・境界値など
4. テストは「汎用的な真偽値チェック」ではなく「具体的な期待値」でアサートすること
5. テストを適切なファイルに Write/Edit し、テストランナーで実行して全件通過を確認する

選択範囲がない場合は、アクティブファイル全体のテストを生成してください。`,
  },
  {
    name: "app",
    description: "React (TSX) による高品質アプリ生成スキル",
    source: "builtin",
    prompt: `以下の要件に基づき、製品品質のデザインでアプリケーションを TSX で作成してください。

## 要件
$ARGUMENTS

## 技術制約 (厳守)
- **出力形式**: 必ず **1つの tsx コードブロック** のみで出力すること
- **スタイリング**: すべてのスタイルを TSX 内に完結させてください。プロジェクトで利用可能な **Tailwind CSS** を優先的に使用すること
- **構成**: 単一のファイルとして動作する React コンポーネントとして実装すること

## 利用可能なライブラリ・コンポーネント
以下のものは、プレビュー環境で既にインポートされており、**インポート文なしで直接使用可能**

- **React Hooks**: \`useState\`, \`useEffect\`, \`useRef\`
- **UI コンポーネント (shadcn/ui ベース)**:
  - \`Button\`, \`Input\`, \`Label\`, \`Switch\`, \`Badge\`, \`Separator\`, \`Textarea\`
  - \`Select\`, \`SelectTrigger\`, \`SelectValue\`, \`SelectContent\`, \`SelectGroup\`, \`SelectItem\`, \`SelectLabel\`, \`SelectSeparator\`
- **アイコン (\`lucide-react\` )**:
  - すべての Lucide アイコンが利用可能 (例: \`<Search />\`, \`<User />\`, \`<ChevronRight />\` 等)
  - \`import\` 文は書かないこと

## デザイン指針 (frontend-design)
**AI 特有の「ありきたりな」デザインを避け**、製品品質のインターフェースを構築する

### 1. デザイン思考
UI/UX を意識し、誰でも見やすく、美しく、操作しやすいデザインとすること。

### 2. 美学的ガイドライン
- 基本的に Radix UI を使用すること
- スマートフォン等のマルチデバイス対応、UX を意識した配置とする
- 日本語フォントは Noto Sans JP を使用すること
- 安易なグラデーションは使用しない
- 文脈に応じた真のデザインを追求する

### 3. コーディング規約
- TSX で記載すること
- CSS は埋め込むこと
- コードブロックを一つのみ出力し、一つのコードでアプリが完結されていること
- アプリの説明、一つのコードブロックの順に生成すること`,
  },
];

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
 * Load all skills.
 * Priority (highest wins): local > global > builtin
 */
export async function loadAllSkills(workspacePath?: string): Promise<SkillDefinition[]> {
  const globalDir = path.join(os.homedir(), ".hime", "skills");
  const globalSkills = await loadSkillsFromDir(globalDir, "global");

  let localSkills: SkillDefinition[] = [];
  if (workspacePath) {
    const localDir = path.join(workspacePath, ".agents", "skills");
    localSkills = await loadSkillsFromDir(localDir, "local");
  }

  // builtin → global → local (後から上書き)
  const skillMap = new Map<string, SkillDefinition>();
  for (const skill of BUILTIN_SKILLS) {
    skillMap.set(skill.name, skill);
  }
  for (const skill of globalSkills) {
    skillMap.set(skill.name, skill);
  }
  for (const skill of localSkills) {
    skillMap.set(skill.name, skill);
  }

  return Array.from(skillMap.values());
}

/**
 * Return only the built-in skills.
 */
export function getBuiltinSkills(): SkillDefinition[] {
  return BUILTIN_SKILLS;
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

  const builtinSkills = skills.filter((s) => s.source === "builtin");
  const userSkills = skills.filter((s) => s.source !== "builtin");

  if (builtinSkills.length > 0) {
    lines.push("");
    lines.push("### 標準スキル");
    lines.push("| コマンド | 説明 |");
    lines.push("|---|---|");
    for (const skill of builtinSkills) {
      lines.push(`| \`/${skill.name}\` | ${skill.description || "-"} |`);
    }
  }

  if (userSkills.length > 0) {
    lines.push("");
    lines.push("### カスタムスキル");
    lines.push("| コマンド | 説明 | ソース |");
    lines.push("|---|---|---|");
    for (const skill of userSkills) {
      const source = skill.source === "local" ? "ローカル" : "グローバル";
      lines.push(`| \`/${skill.name}\` | ${skill.description || "-"} | ${source} |`);
    }
  }

  lines.push("");
  lines.push("### 使い方");
  lines.push("- `/コマンド名` で実行 (例: `/compact`) ");
  lines.push("- `/スキル名 引数` で引数付き実行 (例: `/commit fix: typo`) ");

  return lines.join("\n");
}

/**
 * Build the help text for /skills command.
 */
export function buildSkillsHelpText(skills: SkillDefinition[]): string {
  const builtinSkills = skills.filter((s) => s.source === "builtin");
  const userSkills = skills.filter((s) => s.source !== "builtin");

  const lines = ["## スキル一覧\n"];

  // Built-in skills section
  lines.push("### 標準スキル");
  lines.push("インストール後すぐに使えるスキルです。\n");
  lines.push("| コマンド | 説明 |");
  lines.push("|---|---|");
  for (const skill of builtinSkills) {
    lines.push(`| \`/${skill.name}\` | ${skill.description || "-"} |`);
  }

  // User-defined skills section
  if (userSkills.length > 0) {
    lines.push("");
    lines.push("### カスタムスキル");
    lines.push("| コマンド | 説明 | ソース |");
    lines.push("|---|---|---|");
    for (const skill of userSkills) {
      const source = skill.source === "local" ? "ローカル" : "グローバル";
      lines.push(`| \`/${skill.name}\` | ${skill.description || "-"} | ${source} |`);
    }
  }

  lines.push("");
  lines.push("### 使い方");
  lines.push("- `/スキル名` で実行 (例: `/commit`)");
  lines.push("- `/スキル名 引数` で引数付き実行 (例: `/commit fix: typo`)");
  lines.push("");
  lines.push("### 変数");
  lines.push("| 変数 | 内容 |");
  lines.push("|---|---|");
  lines.push("| `$ARGUMENTS` | コマンドの後のテキスト |");
  lines.push("| `{{selection}}` | エディタの選択範囲 |");
  lines.push("| `{{activeFile}}` | アクティブファイルのパス |");
  lines.push("");
  lines.push("### カスタムスキルの追加");
  lines.push("`~/.hime/skills/<name>/SKILL.md` (グローバル) または `.agents/skills/<name>/SKILL.md` (プロジェクト) に配置");
  lines.push("標準スキルと同名にすることで上書きも可能です。");

  return lines.join("\n");
}
