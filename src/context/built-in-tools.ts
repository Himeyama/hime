import * as fs from "fs/promises";
import * as path from "path";
import * as cp from "child_process";
import * as https from "https";
import * as http from "http";
import { MCPTool } from "../types/mcp";

const IS_WINDOWS = process.platform === "win32";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
  ".nuxt",
  "__pycache__",
  ".venv",
  "venv",
]);

const MAX_READ_LINES = 2000;
const MAX_RESULTS = 250;
const MAX_OUTPUT_CHARS = 30000;

export const BUILTIN_TOOL_NAMES = new Set([
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  IS_WINDOWS ? "PowerShell" : "Bash",
  "WebFetch",
  "WebSearch",
]);

export function getBuiltinToolDefinitions(): MCPTool[] {
  const tools: MCPTool[] = [
    {
      name: "Read",
      description: `Reads the content of a file from the local filesystem.

Key Features & Constraints:
- Output is returned in \`cat -n\` format (line numbers starting at 1, tab-separated).
- Reads up to ${MAX_READ_LINES} lines by default.
- For large files, use 'offset' and 'limit' to read specific segments.
- Returns an error message if the file does not exist.`,
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The absolute path to the file to read.",
          },
          offset: {
            type: "integer",
            description: "The line number to start reading from (1-indexed). Defaults to 1.",
            minimum: 1,
            default: 1,
          },
          limit: {
            type: "integer",
            description: `The number of lines to read. Maximum ${MAX_READ_LINES} per call.`,
            exclusiveMinimum: 0,
            default: MAX_READ_LINES,
          },
        },
        required: ["file_path"],
      },
    },
    {
      name: "Write",
      description: `Creates a new file or overwrites an existing one at the specified path.

Key Features & Constraints:
- Automatically creates parent directories if they do not exist.
- Overwrites existing files without warning.
- For partial modifications of existing files, the 'Edit' tool is preferred to minimize data transfer.`,
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The absolute path where the file will be written.",
          },
          content: {
            type: "string",
            description: "The full content to be written to the file.",
          },
        },
        required: ["file_path", "content"],
      },
    },
    {
      name: "Edit",
      description: `Performs string replacement within a file.

Key Features & Constraints:
- By default, 'old_string' MUST be unique within the file. If multiple occurrences exist, the tool will fail unless 'replace_all' is set to true.
- 'old_string' must match the file content exactly, including indentation, whitespace, and newlines.
- Successfully saves the file after replacement.`,
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The absolute path to the file to modify.",
          },
          old_string: {
            type: "string",
            description: "The exact text to be replaced. Must be unique unless replace_all is true.",
          },
          new_string: {
            type: "string",
            description: "The new text to replace the old_string with.",
          },
          replace_all: {
            type: "boolean",
            description: "Whether to replace all occurrences of old_string. Defaults to false.",
            default: false,
          },
        },
        required: ["file_path", "old_string", "new_string"],
      },
    },
    {
      name: "Glob",
      description: `Finds files matching a glob pattern.

Key Features & Constraints:
- Supports standard globbing patterns like '**/*.js' or 'src/**/*.ts'.
- Results are sorted by file modification time in descending order (newest first).
- Standard ignore directories like node_modules and .git are automatically skipped.`,
      inputSchema: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The glob pattern to match (e.g., '**/*.ts').",
          },
          path: {
            type: "string",
            description: "The base directory to start the search. Defaults to the workspace root.",
          },
        },
        required: ["pattern"],
      },
    },
    {
      name: "Grep",
      description: `Searches for a regex pattern within file contents.

Key Features & Constraints:
- Supports full regular expression syntax.
- 'output_mode' controls the result format: matching lines ('content'), file paths only ('files_with_matches'), or match counts ('count').
- Supports context lines (-A, -B, -C) when output_mode is 'content'.
- Allows filtering by file type (e.g., 'ts', 'js', 'py') or glob patterns.
- Returns up to ${MAX_RESULTS} results by default.`,
      inputSchema: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The regular expression pattern to search for.",
          },
          path: {
            type: "string",
            description: "The file or directory to search in. Defaults to the workspace root.",
          },
          glob: {
            type: "string",
            description: "A glob pattern to filter files (e.g., '*.js').",
          },
          output_mode: {
            type: "string",
            enum: ["content", "files_with_matches", "count"],
            description: "Format of the output. Defaults to 'files_with_matches'.",
            default: "files_with_matches",
          },
          "-B": {
            type: "number",
            description: "Number of lines to show before each match (only for 'content' mode).",
          },
          "-A": {
            type: "number",
            description: "Number of lines to show after each match (only for 'content' mode).",
          },
          "-C": {
            type: "number",
            description: "Number of lines to show before and after each match.",
          },
          "-i": {
            type: "boolean",
            description: "Perform case-insensitive matching. Defaults to false.",
            default: false,
          },
          type: {
            type: "string",
            description: "Filter by file type (e.g., 'ts', 'js'). More efficient than glob for common types.",
          },
          head_limit: {
            type: "number",
            description: `Maximum number of results to return. Defaults to ${MAX_RESULTS}. Use 0 for no limit.`,
            default: MAX_RESULTS,
          },
          multiline: {
            type: "boolean",
            description: "Allows the dot (.) to match newlines and patterns to span multiple lines. Defaults to false.",
            default: false,
          },
        },
        required: ["pattern"],
      },
    },
    IS_WINDOWS
      ? {
          name: "PowerShell",
          description: `Executes a PowerShell 7 (pwsh) command.

Key Features & Constraints:
- Maximum execution timeout is 10 minutes (default 2 minutes).
- Captures up to ${MAX_OUTPUT_CHARS} characters of combined stdout and stderr.
- Runs in non-interactive mode; commands requiring user input (e.g., Read-Host) will fail or hang.
- For file operations, prefer using specialized tools like Read, Write, Edit, Glob, and Grep.`,
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The PowerShell command to execute.",
              },
              timeout: {
                type: "number",
                description: "Execution timeout in milliseconds. Max 600,000 (10 mins).",
                default: 120000,
              },
              description: {
                type: "string",
                description: "A brief description of what the command does.",
              },
            },
            required: ["command"],
          },
        }
      : {
          name: "Bash",
          description: `Executes a Bash command.

Key Features & Constraints:
- Maximum execution timeout is 10 minutes (default 2 minutes).
- Captures up to ${MAX_OUTPUT_CHARS} characters of combined stdout and stderr.
- Runs in non-interactive mode.
- For file operations, prefer using specialized tools like Read, Write, Edit, Glob, and Grep.`,
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The Bash command to execute.",
              },
              timeout: {
                type: "number",
                description: "Execution timeout in milliseconds. Max 600,000 (10 mins).",
                default: 120000,
              },
              description: {
                type: "string",
                description: "A brief description of what the command does.",
              },
            },
            required: ["command"],
          },
        },
    {
      name: "WebFetch",
      description: `Fetches content from a URL and converts HTML to plain text.

Key Features & Constraints:
- Does not execute JavaScript (static HTML only).
- Redirects (3xx) are not followed automatically; the tool returns the redirect URL instead.
- Content is truncated at ${MAX_OUTPUT_CHARS} characters.`,
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch content from.",
            format: "uri",
          },
          prompt: {
            type: "string",
            description: "A hint about what specific information to extract from the page.",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "WebSearch",
      description: `Searches the web using DuckDuckGo and returns a list of results with titles, URLs, and snippets.

Key Features & Constraints:
- No API key required.
- Returns up to 10 results per query.
- Use this to discover relevant URLs, then use WebFetch to read specific pages in detail.`,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query string.",
          },
          num_results: {
            type: "number",
            description: "Number of results to return (1-10). Defaults to 5.",
            default: 5,
            minimum: 1,
            maximum: 10,
          },
        },
        required: ["query"],
      },
    },
  ];

  return tools;
}

// ─── Tool Executor ───────────────────────────────────────────────────────────

export async function executeBuiltinTool(
  toolName: string,
  args: Record<string, unknown>,
  workspacePath: string
): Promise<string> {
  const resolvePath = (p: string): string =>
    path.isAbsolute(p) ? p : path.join(workspacePath, p);

  switch (toolName) {
    case "Read":
      return executeRead(args, resolvePath);

    case "Write":
      return executeWrite(args, resolvePath);

    case "Edit":
      return executeEdit(args, resolvePath);

    case "Glob":
      return executeGlob(args, workspacePath, resolvePath);

    case "Grep":
      return executeGrep(args, workspacePath, resolvePath);

    case "Bash":
    case "PowerShell":
      return executeCommand(toolName, args, workspacePath);

    case "WebFetch":
      return executeWebFetch(args);

    case "WebSearch":
      return executeWebSearch(args);

    default:
      throw new Error(`Unknown built-in tool: ${toolName}`);
  }
}

// ─── Read ────────────────────────────────────────────────────────────────────

async function executeRead(
  args: Record<string, unknown>,
  resolvePath: (p: string) => string
): Promise<string> {
  const filePath = resolvePath(args.file_path as string);
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }

  const allLines = content.split("\n");
  const startLine = args.offset != null ? Math.max(1, Number(args.offset)) : 1;
  const limit = args.limit != null ? Number(args.limit) : MAX_READ_LINES;
  const startIdx = startLine - 1;
  const endIdx = Math.min(startIdx + limit, allLines.length);

  const selectedLines = allLines.slice(startIdx, endIdx);
  const formatted = selectedLines.map((line, i) => `${startIdx + i + 1}\t${line}`).join("\n");

  if (endIdx < allLines.length) {
    return formatted + `\n\n... (truncated, showing lines ${startLine}-${endIdx} of ${allLines.length})`;
  }
  return formatted;
}

// ─── Write ───────────────────────────────────────────────────────────────────

async function executeWrite(
  args: Record<string, unknown>,
  resolvePath: (p: string) => string
): Promise<string> {
  const filePath = resolvePath(args.file_path as string);
  const content = args.content as string;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  return `Successfully wrote ${content.length} characters to ${filePath}`;
}

// ─── Edit ────────────────────────────────────────────────────────────────────

async function executeEdit(
  args: Record<string, unknown>,
  resolvePath: (p: string) => string
): Promise<string> {
  const filePath = resolvePath(args.file_path as string);
  const oldString = args.old_string as string;
  const newString = args.new_string as string;
  const replaceAll = args.replace_all === true;

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (err: any) {
    return `Error reading file: ${err.message}`;
  }

  if (!content.includes(oldString)) {
    return `Error: old_string not found in ${filePath}.\nMake sure the string matches exactly (including indentation and whitespace).`;
  }

  if (replaceAll) {
    const count = content.split(oldString).length - 1;
    const newContent = content.split(oldString).join(newString);
    await fs.writeFile(filePath, newContent, "utf-8");
    return `Successfully replaced ${count} occurrence(s) in ${filePath}`;
  }

  const firstIdx = content.indexOf(oldString);
  const lastIdx = content.lastIndexOf(oldString);
  if (firstIdx !== lastIdx) {
    const count = content.split(oldString).length - 1;
    return (
      `Error: old_string is not unique in ${filePath} (found ${count} occurrences).\n` +
      `Provide more surrounding context to make it unique, or use replace_all: true.`
    );
  }

  const newContent = content.slice(0, firstIdx) + newString + content.slice(firstIdx + oldString.length);
  await fs.writeFile(filePath, newContent, "utf-8");
  return `Successfully edited ${filePath}`;
}

// ─── Glob ────────────────────────────────────────────────────────────────────

async function executeGlob(
  args: Record<string, unknown>,
  workspacePath: string,
  resolvePath: (p: string) => string
): Promise<string> {
  const pattern = args.pattern as string;
  const searchRoot = args.path ? resolvePath(args.path as string) : workspacePath;
  const regex = globToRegex(pattern);

  const results: { filePath: string; mtime: number }[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(searchRoot, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else {
        if (regex.test(rel) || regex.test(entry.name)) {
          try {
            const stat = await fs.stat(fullPath);
            results.push({ filePath: fullPath, mtime: stat.mtimeMs });
          } catch {
            results.push({ filePath: fullPath, mtime: 0 });
          }
        }
      }
    }
  }

  await walk(searchRoot);

  if (results.length === 0) return "(no matching files found)";

  results.sort((a, b) => b.mtime - a.mtime);
  return results.map((r) => r.filePath).join("\n");
}

// ─── Grep ────────────────────────────────────────────────────────────────────

async function executeGrep(
  args: Record<string, unknown>,
  workspacePath: string,
  resolvePath: (p: string) => string
): Promise<string> {
  const patternStr = args.pattern as string;
  const searchPath = args.path ? resolvePath(args.path as string) : workspacePath;
  const globPattern = args.glob as string | undefined;
  const outputMode = (args.output_mode as string) || "files_with_matches";
  const caseInsensitive = args["-i"] === true;
  const showLineNumbers = args["-n"] !== false;
  const headLimit = args.head_limit != null ? Number(args.head_limit) : MAX_RESULTS;
  const offsetArg = args.offset != null ? Number(args.offset) : 0;
  const fileType = args.type as string | undefined;
  const multiline = args.multiline === true;

  const contextN = args.context ?? args["-C"];
  const beforeLines = args["-B"] != null ? Number(args["-B"]) : contextN != null ? Number(contextN) : 0;
  const afterLines = args["-A"] != null ? Number(args["-A"]) : contextN != null ? Number(contextN) : 0;

  // Build regex flags
  let flags = caseInsensitive ? "i" : "";
  if (multiline) flags += "s"; // dotAll — . matches newlines
  let regex: RegExp;
  try {
    regex = new RegExp(patternStr, flags);
  } catch {
    regex = new RegExp(patternStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  }

  const allowedExts = fileType ? (TYPE_EXTENSIONS[fileType] ?? [`.${fileType}`]) : null;
  const globRegex = globPattern ? globToRegex(globPattern) : null;

  // Collect files to search
  let stat: import("fs").Stats;
  try {
    stat = await fs.stat(searchPath) as import("fs").Stats;
  } catch {
    return `(path not found: ${searchPath})`;
  }

  const filesToSearch: string[] = [];
  if (stat.isFile()) {
    filesToSearch.push(searchPath);
  } else {
    await collectFiles(searchPath, filesToSearch, allowedExts, globRegex, workspacePath);
  }

  // Search files
  const fileMatches: string[] = [];
  const countLines: string[] = [];
  const contentLines: string[] = [];

  for (const filePath of filesToSearch) {
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    const relPath = path.relative(workspacePath, filePath).replace(/\\/g, "/");

    if (multiline) {
      // Match against full content; find affected line numbers
      const globalRegex = new RegExp(patternStr, flags + "g");
      const matchingLineSet = new Set<number>();
      const lines = content.split("\n");
      let m: RegExpExecArray | null;
      while ((m = globalRegex.exec(content)) !== null) {
        const lineNum = content.slice(0, m.index).split("\n").length - 1;
        matchingLineSet.add(lineNum);
        if (globalRegex.lastIndex === m.index) globalRegex.lastIndex++;
      }

      if (matchingLineSet.size === 0) continue;

      if (outputMode === "files_with_matches") {
        fileMatches.push(filePath);
      } else if (outputMode === "count") {
        countLines.push(`${relPath}: ${matchingLineSet.size}`);
      } else {
        appendContentLines(contentLines, lines, [...matchingLineSet], beforeLines, afterLines, relPath, showLineNumbers);
      }
    } else {
      // Line-by-line matching
      const lines = content.split("\n");
      const matchingLineIndices: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) matchingLineIndices.push(i);
      }

      if (matchingLineIndices.length === 0) continue;

      if (outputMode === "files_with_matches") {
        fileMatches.push(filePath);
      } else if (outputMode === "count") {
        countLines.push(`${relPath}: ${matchingLineIndices.length}`);
      } else {
        appendContentLines(contentLines, lines, matchingLineIndices, beforeLines, afterLines, relPath, showLineNumbers);
      }
    }
  }

  const paginate = (arr: string[]): string[] => {
    const sliced = arr.slice(offsetArg);
    return headLimit > 0 ? sliced.slice(0, headLimit) : sliced;
  };

  if (outputMode === "files_with_matches") {
    const result = paginate(fileMatches);
    return result.length === 0 ? "(no matches found)" : result.join("\n");
  }
  if (outputMode === "count") {
    const result = paginate(countLines);
    return result.length === 0 ? "(no matches found)" : result.join("\n");
  }
  const result = paginate(contentLines);
  return result.length === 0 ? "(no matches found)" : result.join("\n");
}

function appendContentLines(
  out: string[],
  lines: string[],
  matchingIndices: number[],
  before: number,
  after: number,
  relPath: string,
  showLineNumbers: boolean
): void {
  const included = new Set<number>();
  for (const idx of matchingIndices) {
    for (let j = Math.max(0, idx - before); j <= Math.min(lines.length - 1, idx + after); j++) {
      included.add(j);
    }
  }
  const sortedIndices = [...included].sort((a, b) => a - b);
  for (const idx of sortedIndices) {
    out.push(showLineNumbers ? `${relPath}:${idx + 1}: ${lines[idx]}` : `${relPath}: ${lines[idx]}`);
  }
}

async function collectFiles(
  dir: string,
  results: string[],
  allowedExts: string[] | null,
  globRegex: RegExp | null,
  workspacePath: string
): Promise<void> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        await collectFiles(fullPath, results, allowedExts, globRegex, workspacePath);
      }
    } else {
      if (allowedExts && !allowedExts.some((ext) => entry.name.endsWith(ext))) continue;
      if (globRegex) {
        const rel = path.relative(workspacePath, fullPath).replace(/\\/g, "/");
        if (!globRegex.test(rel) && !globRegex.test(entry.name)) continue;
      }
      results.push(fullPath);
    }
  }
}

const TYPE_EXTENSIONS: Record<string, string[]> = {
  js: [".js", ".mjs", ".cjs"],
  ts: [".ts", ".mts", ".cts"],
  tsx: [".tsx"],
  jsx: [".jsx"],
  py: [".py"],
  go: [".go"],
  rust: [".rs"],
  java: [".java"],
  cpp: [".cpp", ".cc", ".cxx", ".h", ".hpp"],
  c: [".c", ".h"],
  cs: [".cs"],
  rb: [".rb"],
  php: [".php"],
  swift: [".swift"],
  kotlin: [".kt"],
  md: [".md", ".mdx"],
  json: [".json"],
  yaml: [".yaml", ".yml"],
  toml: [".toml"],
  xml: [".xml"],
  html: [".html", ".htm"],
  css: [".css", ".scss", ".sass", ".less"],
  sh: [".sh", ".bash"],
  ps1: [".ps1"],
};

// ─── Glob pattern to RegExp ──────────────────────────────────────────────────

function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/");
  return new RegExp(`^${globPatternToRegexStr(normalized)}$`);
}

function globPatternToRegexStr(pattern: string): string {
  let i = 0;
  let re = "";

  while (i < pattern.length) {
    const c = pattern[i];

    if (c === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          // **/ matches zero or more path segments
          re += "(?:[^/]+/)*";
          i += 3;
        } else {
          // ** at end or followed by non-/
          re += ".*";
          i += 2;
        }
      } else {
        // * matches anything except /
        re += "[^/]*";
        i++;
      }
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (c === "{") {
      // Brace expansion {a,b,c}
      let depth = 1;
      let j = i + 1;
      while (j < pattern.length && depth > 0) {
        if (pattern[j] === "{") depth++;
        else if (pattern[j] === "}") depth--;
        j++;
      }
      if (depth === 0) {
        const inner = pattern.slice(i + 1, j - 1);
        const alternatives = splitTopLevel(inner, ",");
        re += "(?:" + alternatives.map(globPatternToRegexStr).join("|") + ")";
        i = j;
      } else {
        re += "\\{";
        i++;
      }
    } else if (c === "[") {
      // Character class — pass through as-is
      const end = pattern.indexOf("]", i + 1);
      if (end !== -1) {
        re += pattern.slice(i, end + 1);
        i = end + 1;
      } else {
        re += "\\[";
        i++;
      }
    } else if (".+^$()|\\".includes(c)) {
      re += "\\" + c;
      i++;
    } else {
      re += c;
      i++;
    }
  }

  return re;
}

function splitTopLevel(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const c of str) {
    if (c === "{") depth++;
    else if (c === "}") depth--;
    if (c === delimiter && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  parts.push(current);
  return parts;
}

// ─── Command Execution ───────────────────────────────────────────────────────

async function executeCommand(
  toolName: string,
  args: Record<string, unknown>,
  workspacePath: string
): Promise<string> {
  const command = args.command as string;
  const timeout = args.timeout != null ? Math.min(Number(args.timeout), 600000) : 120000;
  const isPs = toolName === "PowerShell";

  return new Promise<string>((resolve) => {
    const options: cp.ExecOptions = {
      cwd: workspacePath,
      timeout,
      maxBuffer: MAX_OUTPUT_CHARS * 4,
      ...(isPs ? { shell: "pwsh" } : {}),
    };

    // For PowerShell, wrap the command
    const actualCommand = isPs ? `pwsh -NonInteractive -Command "${command.replace(/"/g, '\\"')}"` : command;

    cp.exec(actualCommand, options, (err, stdout, stderr) => {
      const out = stdout || "";
      const errOut = stderr ? `\n[stderr]\n${stderr}` : "";
      let combined = (out + errOut).trim();

      if (combined.length > MAX_OUTPUT_CHARS) {
        combined = combined.slice(0, MAX_OUTPUT_CHARS) + "\n... (output truncated)";
      }

      if (!combined && err) {
        combined = `[Exit code: ${err.code ?? "unknown"}]`;
      }

      resolve(combined || "(no output)");
    });
  });
}

// ─── WebFetch ────────────────────────────────────────────────────────────────

async function executeWebFetch(args: Record<string, unknown>): Promise<string> {
  const url = args.url as string;

  return new Promise<string>((resolve) => {
    const lib = url.startsWith("https") ? https : http;

    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Hime/1.0)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
        timeout: 30000,
      },
      (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(
            `Redirect to: ${res.headers.location}\n` +
              `Please make a new WebFetch request with the redirect URL.`
          );
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          resolve(`HTTP ${res.statusCode}: ${res.statusMessage}`);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          const text = htmlToText(raw);
          if (text.length > MAX_OUTPUT_CHARS) {
            resolve(text.slice(0, MAX_OUTPUT_CHARS) + "\n... (content truncated)");
          } else {
            resolve(text);
          }
        });
        res.on("error", (err: Error) => resolve(`Error reading response: ${err.message}`));
      }
    );

    req.on("error", (err: Error) => resolve(`Error fetching URL: ${err.message}`));
    req.on("timeout", () => {
      req.destroy();
      resolve("Error: Request timed out after 30 seconds");
    });
  });
}

// ─── WebSearch ──────────────────────────────────────────────────────────────

async function executeWebSearch(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;
  const numResults = Math.min(Math.max(Number(args.num_results) || 5, 1), 10);

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  return new Promise<string>((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(`Redirect to: ${res.headers.location}`);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          resolve(`HTTP ${res.statusCode}: ${res.statusMessage}`);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const html = Buffer.concat(chunks).toString("utf-8");
          const results = parseDuckDuckGoResults(html, numResults);
          if (results.length === 0) {
            resolve("(no search results found)");
            return;
          }
          const formatted = results
            .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet}`)
            .join("\n\n");
          resolve(formatted);
        });
        res.on("error", (err: Error) => resolve(`Error reading response: ${err.message}`));
      }
    );

    req.on("error", (err: Error) => resolve(`Error searching: ${err.message}`));
    req.on("timeout", () => {
      req.destroy();
      resolve("Error: Search request timed out");
    });
  });
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo HTML results are in <div class="result ..."> blocks
  const resultBlocks = html.split(/class="result\s/g).slice(1);

  for (const block of resultBlocks) {
    if (results.length >= maxResults) break;

    // Extract title and URL from <a class="result__a" href="...">title</a>
    const linkMatch = block.match(/<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;

    let url = linkMatch[1];
    const titleHtml = linkMatch[2];

    // DuckDuckGo wraps URLs through a redirect — extract the actual URL
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }

    // Extract snippet from <a class="result__snippet" ...>...</a>
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const snippetHtml = snippetMatch ? snippetMatch[1] : "";

    const title = stripHtmlTags(titleHtml).trim();
    const snippet = stripHtmlTags(snippetHtml).trim();

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
