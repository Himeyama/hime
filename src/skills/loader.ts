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
    description: "HTML 高品質アプリ生成スキル",
    source: "builtin",
    prompt: `以下の要件に基づき、製品品質のデザインのアプリケーションを **単一の HTML ファイル** として作成してください。

## 要件
$ARGUMENTS

## 技術制約 (厳守)
- **出力形式**: 必ず **1つの html コードブロック** のみで出力すること
- **構成**: CSS・JavaScript をすべて HTML ファイル内に埋め込み、ファイル単体で動作すること
- **確実に動作することを優先する**
- 冗長とならないようにする
- JavaScript の関数はアロー関数を用いる
- {{colorThemeInstruction}}
- **スタイリング**: Tailwind CSS は CDN 経由で読み込むこと
  \`\`\`html
  <script src="https://cdn.tailwindcss.com"></script>
  \`\`\`
- **フォント**: Noto Sans JP を Google Fonts CDN で読み込むこと
  \`\`\`html
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
  \`\`\`
- **外部ライブラリ**: 必要に応じて CDN 経由で追加可 (Alpine.js, Chart.js, etc.)
- **車輪の再発名**: 既存のアプリが既に存在する場合は、その既存アプリを参考にした形で作成すること。ただし、2回目以降にアプリの修正を求められた場合を除く。

## デザイン指針
**AI 特有の「ありきたりな」デザインを避け**、製品品質のインターフェースを構築すること

### レスポンシブ対応 (必須)
- \`<meta name="viewport" content="width=device-width, initial-scale=1">\` を必ず含めること
- **スマートフォンとデスクトップの両方でレイアウトが崩れないこと** を最優先に確認する
- Tailwind のブレークポイント (\`sm:\`, \`md:\`, \`lg:\`) を活用し、幅固定レイアウトを避ける
- 幅は \`max-w-*\` + \`w-full\` の組み合わせで制御し、絶対幅指定は使わない
- タッチ操作を考慮したボタンサイズ (最小タップ領域 44px 以上)
- テキストはモバイルで読みやすいフォントサイズ (最小 14px) を維持すること
- 横スクロールが発生しないこと (隠すのではなく、根本的に崩れない設計にする)

### 美学的ガイドライン — AI っぽくないデザインを徹底すること
ChatGPT や Claude などの AI ツールが出力するようなデザインを **明示的に避ける**。

**禁止 (AI 特有の「ありきたり」な表現)**
- **影**: box-shadow / drop-shadow / text-shadow はカード・ボタン・モーダル等への適用を禁止
- **過度な角丸**: rounded-xl / rounded-2xl / rounded-full はボタン・カード・入力欄に使わない
- **グラデーション**: ヘッダー・カード・ボタンへの linear-gradient / radial-gradient は使わない
- **グラスモーフィズム**: backdrop-filter: blur や rgba 半透明重ねは禁止
- **ネオン・グロー**: カラフルな発光効果は禁止
- **装飾アニメーション**: 情報を伝えない pulse / bounce / spin は使わない

**推奨 (実用的・道具らしい表現)**
- **角丸**: border-radius は 4px (rounded-sm) または 8px (rounded-md) を基本とする。要素の用途に応じて使い分け、それ以上は使わない
- **余白**: padding / margin は必要最小限に抑える。コンテンツが詰まりすぎず、かつ無駄に広くならない程度 (p-2〜p-4 / gap-2〜gap-4 程度を目安)
- フラットで単色ベースの背景
- 影の代わりに 1px border で要素を区切る
- タイポグラフィ・カラーパレットに一貫性を持たせること
- アイコンが必要な場合は SVG インラインまたは絵文字を使用すること

### グリッドレイアウト
- 2列以上のグリッドを使う場合は \`grid\` + \`grid-cols-*\` で列方向を定義し、**行方向も \`grid-rows-*\` または \`auto-rows-*\` で揃える**こと
- セルの高さが揃うよう \`items-start\` / \`items-stretch\` を明示し、コンテンツ量の差でレイアウトが崩れないようにする
- カード等の繰り返し要素は \`grid\` + \`auto-rows-fr\` もしくは Flexbox の \`flex-wrap\` + \`basis-*\` で等幅にする
- モバイルでは 1 列、タブレット以上で複数列に切り替える (\`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3\` 等)
- \`gap-*\` は列・行ともに統一し、\`gap-x-*\` / \`gap-y-*\` を個別指定する場合も両方を明示すること

### UX ガイドライン
- **操作の主導権をユーザーに**: 不可逆な操作 (削除・送信等) には確認ステップまたは取り消し手段を設ける
- **状態の可視化**: ローディング・エラー・空状態の各フィードバックを必ず実装する
- **フォーカス管理**: キーボード操作でタブ順序が自然に流れること。フォーカスリングを消さない
- **インタラクティブ要素の識別**: ボタンやリンクはホバー・アクティブ状態で視覚的に変化させ、クリック可能であることを明示する
- **ボタンの色**: ボタンの役割に応じた色を使い分ける
  - プライマリ操作 (確定・送信・保存等): アクセントカラー (青系)
  - 危険・破壊的操作 (削除・リセット等): 赤系
  - キャンセル・補助操作: ニュートラル (グレー系)
  - 成功・完了を示す操作: 緑系
  - 同一画面に複数ボタンがある場合は、最重要操作だけをアクセントカラーにし、残りは控えめな色にすること
- **テキストの可読性**: 背景とテキストのコントラスト比は WCAG AA 基準 (4.5:1 以上) を満たすこと
- **説明の禁止**: アプリに説明テキストは禁止する。**絶対にこれを使用しない**
- テキストの禁止: アプリ内に入力方法や UI 等の説明テキストは禁止する
- ダミーの使用禁止: 例やダミーとなる項目は用意しない
- ボタンのレイアウト: ボタンの幅が小さく、文字列が 2 行以上とならないように注意する
- alert の禁止: ユーザーに確認する場合でも、alert 関数は使用しない

### コーディング規約
- \`<style>\` タグでカスタム CSS を補足してもよいが、Tailwind クラスを優先すること
- \`<script>\` タグはファイル末尾 (\`</body>\` 直前) に配置すること
- アプリの説明を簡潔に述べた後、html コードブロックを1つだけ出力すること`,
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
    vscodeTheme?: "dark" | "light";
  }
): string {
  let result = prompt;

  // $ARGUMENTS
  result = result.replace(/\$ARGUMENTS/g, variables.arguments || "");

  // {{selection}}
  result = result.replace(/\{\{selection\}\}/g, variables.selection || "(選択範囲なし)");

  // {{activeFile}}
  result = result.replace(/\{\{activeFile\}\}/g, variables.activeFile || "(ファイルなし)");

  // {{colorThemeInstruction}}
  const colorThemeInstruction =
    variables.vscodeTheme === "dark"
      ? "カラーテーマ: ダーク系を使用する (背景: #1e1e1e / #252526、テキスト: #d4d4d4 / #cccccc、アクセント: #007acc / #4fc1ff、ボーダー: #3c3c3c) — 要件に明示がない場合はこれに従うこと"
      : variables.vscodeTheme === "light"
        ? "カラーテーマ: ライト系を使用する (背景: #ffffff / #f3f3f3、テキスト: #1e1e1e / #333333、アクセント: #007acc、ボーダー: #e0e0e0) — 要件に明示がない場合はこれに従うこと"
        : "要件の項目で指定がない場合は、赤テーマを使用する";
  result = result.replace(/\{\{colorThemeInstruction\}\}/g, colorThemeInstruction);

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
