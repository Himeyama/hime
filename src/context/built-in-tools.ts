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
  "Bash",
  "PowerShell",
  "WebFetch",
  // Legacy names for compatibility
  "read_file",
  "list_directory",
  "search_files",
]);

export function getBuiltinToolDefinitions(): MCPTool[] {
  const tools: MCPTool[] = [
    {
      name: "Read",
      description: `Reads a file from the local filesystem.

Usage:
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to ${MAX_READ_LINES} lines starting from the beginning of the file
- When you already know which part of the file you need, only read that part
- Results are returned using cat -n format, with line numbers starting at 1
- It is okay to read a file that does not exist; an error will be returned`,
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The absolute path to the file to read",
          },
          offset: {
            type: "integer",
            description:
              "The line number to start reading from (1-indexed). Only provide if the file is too large to read at once.",
            minimum: 1,
          },
          limit: {
            type: "integer",
            description: "The number of lines to read. Only provide if the file is too large to read at once.",
            exclusiveMinimum: 0,
          },
        },
        required: ["file_path"],
      },
    },
    {
      name: "Write",
      description: `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- Prefer the Edit tool for modifying existing files — it only sends the diff.
- Only use this tool to create new files or for complete rewrites.`,
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The absolute path to the file to write (must be absolute, not relative)",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["file_path", "content"],
      },
    },
    {
      name: "Edit",
      description: `Performs exact string replacements in files.

Usage:
- The edit will FAIL if old_string is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use replace_all to change every instance of old_string.
- Use replace_all for replacing and renaming strings across the file.`,
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The absolute path to the file to modify",
          },
          old_string: {
            type: "string",
            description: "The text to replace",
          },
          new_string: {
            type: "string",
            description: "The text to replace it with (must be different from old_string)",
          },
          replace_all: {
            type: "boolean",
            description: "Replace all occurrences of old_string (default false)",
            default: false,
          },
        },
        required: ["file_path", "old_string", "new_string"],
      },
    },
    {
      name: "Glob",
      description: `Fast file pattern matching tool that works with any codebase size.
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns`,
      inputSchema: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The glob pattern to match files against",
          },
          path: {
            type: "string",
            description:
              "The directory to search in. If not specified, the workspace root will be used. Must be a valid directory path if provided.",
          },
        },
        required: ["pattern"],
      },
    },
    {
      name: "Grep",
      description: `A powerful search tool for file contents.
- Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
- Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "ts")
- Output modes: "content" shows matching lines (default), "files_with_matches" shows only file paths, "count" shows match counts
- Multiline matching: By default patterns match within single lines only. For cross-line patterns, use multiline: true`,
      inputSchema: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The regular expression pattern to search for in file contents",
          },
          path: {
            type: "string",
            description: "File or directory to search in. Defaults to workspace root.",
          },
          glob: {
            type: "string",
            description: 'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}")',
          },
          output_mode: {
            type: "string",
            enum: ["content", "files_with_matches", "count"],
            description:
              '"content" shows matching lines, "files_with_matches" shows only file paths, "count" shows match counts. Defaults to "files_with_matches".',
          },
          "-B": {
            type: "number",
            description: 'Number of lines to show before each match. Requires output_mode: "content".',
          },
          "-A": {
            type: "number",
            description: 'Number of lines to show after each match. Requires output_mode: "content".',
          },
          "-C": {
            type: "number",
            description:
              'Number of lines to show before and after each match. Requires output_mode: "content".',
          },
          context: {
            type: "number",
            description: 'Alias for -C. Requires output_mode: "content".',
          },
          "-n": {
            type: "boolean",
            description: 'Show line numbers in output. Requires output_mode: "content". Defaults to true.',
          },
          "-i": {
            type: "boolean",
            description: "Case insensitive search.",
          },
          type: {
            type: "string",
            description:
              "File type to search (e.g. js, py, ts, go, java). More efficient than glob for standard file types.",
          },
          head_limit: {
            type: "number",
            description: "Limit output to first N lines/entries. Defaults to 250. Pass 0 for unlimited.",
          },
          offset: {
            type: "number",
            description: "Skip first N lines/entries. Defaults to 0.",
          },
          multiline: {
            type: "boolean",
            description: "Enable multiline mode where . matches newlines and patterns can span lines. Default: false.",
          },
        },
        required: ["pattern"],
      },
    },
    IS_WINDOWS
      ? {
          name: "PowerShell",
          description: `Executes a given PowerShell command and returns its output.

IMPORTANT: Use this tool for terminal operations only. For file operations use Read, Write, Edit, Glob, Grep instead.

PowerShell 7+ (pwsh):
- Pipeline chain operators && and || work like bash
- Variables use $ prefix: $myVar = "value"
- Escape character is backtick (\`), not backslash
- Environment variables: $env:NAME
- Never use interactive prompts (Read-Host, Get-Credential, etc.)
- Use -Confirm:$false for destructive cmdlets`,
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The PowerShell command to execute",
              },
              timeout: {
                type: "number",
                description: "Optional timeout in milliseconds (max 600000)",
              },
              description: {
                type: "string",
                description: "Clear, concise description of what this command does",
              },
            },
            required: ["command"],
          },
        }
      : {
          name: "Bash",
          description: `Executes a given bash command and returns its output.

IMPORTANT: Use this tool for terminal operations only. For file operations use Read, Write, Edit, Glob, Grep instead.

- Always quote file paths that contain spaces
- Use && to chain commands that must run sequentially
- Use ; only when you don't care if earlier commands fail`,
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The bash command to execute",
              },
              timeout: {
                type: "number",
                description: "Optional timeout in milliseconds (max 600000)",
              },
              description: {
                type: "string",
                description: "Clear, concise description of what this command does",
              },
            },
            required: ["command"],
          },
        },
    {
      name: "WebFetch",
      description: `Fetches content from a specified URL.
- Fetches the URL content and converts HTML to plain text
- Returns the page content as text
- Use this when you need to retrieve web content`,
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch content from",
            format: "uri",
          },
          prompt: {
            type: "string",
            description: "What specific information you want to extract from the page",
          },
        },
        required: ["url"],
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

    // ── Legacy names ─────────────────────────────────────────────────────────
    case "read_file": {
      const filePath = resolvePath(args.path as string);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      if (lines.length > MAX_READ_LINES) {
        return (
          lines.slice(0, MAX_READ_LINES).join("\n") +
          `\n\n... (truncated, showing ${MAX_READ_LINES}/${lines.length} lines)`
        );
      }
      return content;
    }

    case "list_directory": {
      const dirPath = resolvePath((args.path as string) || ".");
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const lines = entries
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      return lines.join("\n") || "(empty directory)";
    }

    case "search_files":
      return executeGrep(
        {
          pattern: args.pattern,
          path: args.directory,
          glob: args.file_pattern ? `**/*${args.file_pattern}` : undefined,
          output_mode: "content",
        },
        workspacePath,
        resolvePath
      );

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
