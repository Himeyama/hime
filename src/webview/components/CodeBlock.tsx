import { useState, useEffect, useRef } from "react";
import { Check, Copy, Play, Code as CodeIcon, Link } from "lucide-react";
import hljs from "highlight.js";
import mermaid from "mermaid";
import { Button } from "./ui/button";

interface CodeBlockProps {
  language: string;
  code: string;
}

function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const isDark = document.body.classList.contains("vscode-dark") ||
                   document.body.classList.contains("vscode-high-contrast");

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "var(--vscode-editor-font-family)",
    });

    const renderMermaid = async () => {
      if (!ref.current) return;
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      try {
        const { svg } = await mermaid.render(id, code);
        if (isMounted) {
          setSvg(svg);
          setError(null);
        }
      } catch (err: any) {
        const errorElement = document.getElementById("d" + id);
        if (errorElement) errorElement.remove();
        console.error("Mermaid rendering failed:", err);
        if (isMounted) {
          setError("Mermaid diagram rendering failed. Please check your syntax.");
        }
      }
    };

    renderMermaid();
    return () => { isMounted = false; };
  }, [code]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-destructive/5 rounded-md border border-destructive/20 my-2">
        <div className="text-destructive font-semibold text-xs mb-1 flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Render Error
        </div>
        <div className="text-muted-foreground text-[11px] font-mono whitespace-pre-wrap text-center opacity-80">{error}</div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="flex justify-center p-4 bg-background/50 rounded-md overflow-x-auto shadow-inner"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// sandbox="allow-scripts" without allow-same-origin makes localStorage/sessionStorage
// throw SecurityError, crashing the entire script before event listeners attach.
// Inject an in-memory polyfill that silently catches the error.
const STORAGE_POLYFILL = `<script>(function(){function m(){var s={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null},setItem:function(k,v){s[k]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}},key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}};try{localStorage.getItem('')}catch(e){Object.defineProperty(window,'localStorage',{value:m(),configurable:true})};try{sessionStorage.getItem('')}catch(e){Object.defineProperty(window,'sessionStorage',{value:m(),configurable:true})}})();<\/script>`;

function injectStoragePolyfill(html: string): string {
  const idx = html.indexOf("</head>");
  if (idx !== -1) return html.slice(0, idx) + STORAGE_POLYFILL + html.slice(idx);
  const bodyIdx = html.indexOf("<body");
  if (bodyIdx !== -1) return html.slice(0, bodyIdx) + STORAGE_POLYFILL + html.slice(bodyIdx);
  return STORAGE_POLYFILL + html;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [copiedDataUri, setCopiedDataUri] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const isMermaid = language?.toLowerCase() === "mermaid";
  const isHTML = language?.toLowerCase() === "html";

  useEffect(() => {
    if (!codeRef.current || isMermaid || (isHTML && showPreview)) return;

    codeRef.current.removeAttribute("data-highlighted");
    codeRef.current.textContent = code;

    const lang = language || "";
    if (lang && hljs.getLanguage(lang)) {
      hljs.highlightElement(codeRef.current);
    } else if (lang) {
      try {
        const result = hljs.highlightAuto(code);
        codeRef.current.innerHTML = result.value;
      } catch {
        // Leave as plain text
      }
    }
  }, [code, language, isMermaid, isHTML, showPreview]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyDataUri = async () => {
    try {
      // Handle potential unicode characters in btoa by encoding URI component first
      const base64 = btoa(unescape(encodeURIComponent(code)));
      const dataUri = `data:text/html;base64,${base64}`;
      await navigator.clipboard.writeText(dataUri);
      setCopiedDataUri(true);
      setTimeout(() => setCopiedDataUri(false), 2000);
    } catch (e) {
      console.error("Failed to copy as data URI", e);
    }
  };

  return (
    <div className="my-2.5 border border-border rounded-lg overflow-hidden shadow-sm bg-vsc-editor-bg">
      <div className="flex justify-between items-center px-3 py-1.5 bg-muted/40 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
            {language || "text"}
          </span>
          {isHTML && (
            <div className="flex items-center bg-background/50 rounded-md p-0.5 border border-border/50 ml-2">
              <Button
                variant={showPreview ? "ghost" : "secondary"}
                size="sm"
                className="h-5 px-1.5 text-[9px] gap-1"
                onClick={() => setShowPreview(false)}
              >
                <CodeIcon className="h-2.5 w-2.5" />
                Code
              </Button>
              <Button
                variant={showPreview ? "secondary" : "ghost"}
                size="sm"
                className="h-5 px-1.5 text-[9px] gap-1"
                onClick={() => setShowPreview(true)}
              >
                <Play className="h-2.5 w-2.5" />
                Preview
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isHTML && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-[10px] gap-1 ${copiedDataUri ? "text-success" : "text-muted-foreground"}`}
              onClick={handleCopyDataUri}
              title="Copy as Data URI"
            >
              {copiedDataUri ? (
                <>
                  <Check className="h-3 w-3" />
                  Data URI コピー済み
                </>
              ) : (
                <>
                  <Link className="h-3 w-3" />
                  Data URI
                </>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-[10px] gap-1 ${copied ? "text-success" : "text-muted-foreground"}`}
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                コピー済み
              </>
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {isMermaid ? (
        <div className="p-3 bg-transparent">
          <Mermaid code={code} />
        </div>
      ) : isHTML && showPreview ? (
        <iframe
          srcDoc={injectStoragePolyfill(code)}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          className="w-full border-0 block"
          style={{ height: "500px" }}
          title="HTML Preview"
        />
      ) : (
        <pre className="px-3 py-3 overflow-x-auto font-vsc-editor text-[13px] leading-snug m-0 scrollbar-thin bg-transparent">
          <code
            ref={codeRef}
            className={language ? `language-${language}` : ""}
          >
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
