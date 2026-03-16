"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Copy, Check, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2, X, Minimize2 } from "lucide-react";
import { createPortal } from "react-dom";

interface Props {
  chart: string;
  title?: string;
}

function sanitize(raw: string): string {
  return raw
    .replace(/```mermaid\s*/gi, "")
    .replace(/```\s*/g, "")
    // Replace "label: value" colons inside node labels with a dash
    .replace(/(\[[^\]]*?):\s+([^\]]*?\])/g, "$1 - $2")
    // Replace colons inside [( )] database node labels
    .replace(/(\[\([^\)]*?):\s+([^\)]*?\)\])/g, "$1 - $2")
    // Strip HTML tags
    .replace(/<[^>]+>/g, "")
    // Replace & with and (common in service names)
    .replace(/&amp;/g, "and")
    .replace(/\s*&\s*/g, " and ")
    // Remove any trailing semicolons that break parsing
    .replace(/;(\s*\n)/g, "$1")
    .trim();
}

// ── Reusable pan/zoom hook ────────────────────────────────────────────────────
function usePanZoom(initial = 1) {
  const [scale, setScale] = useState(initial);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const zoom = useCallback((delta: number) =>
    setScale(s => Math.min(5, Math.max(0.2, +(s + delta).toFixed(2)))), []);

  const reset = useCallback(() => { setScale(initial); setPos({ x: 0, y: 0 }); }, [initial]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 0.12 : -0.12);
  }, [zoom]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPos({
      x: panStart.current.px + (e.clientX - panStart.current.mx),
      y: panStart.current.py + (e.clientY - panStart.current.my),
    });
  }, []);

  const onPointerUp = useCallback(() => { isPanning.current = false; }, []);

  return { scale, pos, zoom, reset, onWheel, onPointerDown, onPointerMove, onPointerUp };
}

// ── SVG download helper ───────────────────────────────────────────────────────
function downloadSvgFrom(container: HTMLDivElement | null, filename: string) {
  const svg = container?.querySelector("svg");
  if (!svg) return;
  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared toolbar button ─────────────────────────────────────────────────────
const Btn = ({ onClick, title, children, active }: {
  onClick: () => void; title: string; children: React.ReactNode; active?: boolean;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${active
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
  >
    {children}
  </button>
);

// ── Diagram viewport (shared between inline and fullscreen) ───────────────────
const DiagramViewport = ({
  svgWrapRef, loading, error, chart, pz, inline = false,
}: {
  svgWrapRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  error: string | null;
  chart: string;
  pz: ReturnType<typeof usePanZoom>;
  inline?: boolean;
}) => (
  <div
    className="relative overflow-hidden bg-white select-none"
    style={{
      minHeight: inline ? 260 : undefined,
      flex: inline ? undefined : 1,
      cursor: "grab",
    }}
    onWheel={pz.onWheel}
    onPointerDown={pz.onPointerDown}
    onPointerMove={pz.onPointerMove}
    onPointerUp={pz.onPointerUp}
    onPointerLeave={pz.onPointerUp}
  >
    {loading && !error && (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground animate-pulse bg-white">
        Building diagram…
      </div>
    )}
    {error ? (
      <pre className="p-4 text-xs font-mono text-foreground bg-muted/10 overflow-auto whitespace-pre-wrap leading-relaxed h-full">
        {chart}
      </pre>
    ) : (
      <div
        style={{
          transform: `translate(${pz.pos.x}px, ${pz.pos.y}px) scale(${pz.scale})`,
          transformOrigin: "top left",
          willChange: "transform",
          display: loading ? "none" : "block",
          padding: 24,
        }}
        ref={svgWrapRef}
      />
    )}
  </div>
);

// ── Fullscreen overlay ────────────────────────────────────────────────────────
const FullscreenOverlay = ({
  chart, title, svgHtml, onClose,
}: {
  chart: string; title: string; svgHtml: string; onClose: () => void;
}) => {
  const fsWrapRef = useRef<HTMLDivElement>(null);
  const pz = usePanZoom(0.9);
  const [copied, setCopied] = useState(false);

  // Inject SVG into fullscreen container
  useEffect(() => {
    if (!fsWrapRef.current || !svgHtml) return;
    fsWrapRef.current.innerHTML = svgHtml;
    const el = fsWrapRef.current.querySelector("svg");
    if (el) { el.removeAttribute("height"); el.style.cssText = "width:100%;height:auto;display:block;"; }
  }, [svgHtml]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const copy = () => { navigator.clipboard.writeText(chart); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const download = () => downloadSvgFrom(fsWrapRef.current, `${title.replace(/\s+/g, "-").toLowerCase()}.svg`);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-background/95 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-foreground flex-1">{title}</span>

        <div className="flex items-center gap-1">
          <Btn onClick={() => pz.zoom(0.2)} title="Zoom in"><ZoomIn className="size-4" /></Btn>
          <Btn onClick={() => pz.zoom(-0.2)} title="Zoom out"><ZoomOut className="size-4" /></Btn>
          <Btn onClick={pz.reset} title="Reset zoom"><RotateCcw className="size-4" /></Btn>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(pz.scale * 100)}%</span>
          <div className="w-px h-5 bg-border mx-1" />
          <Btn onClick={download} title="Download SVG"><Download className="size-4" /></Btn>
          <Btn onClick={copy} title="Copy Mermaid source">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Btn>
          <div className="w-px h-5 bg-border mx-1" />
          <Btn onClick={onClose} title="Close fullscreen (Esc)"><X className="size-4" /></Btn>
        </div>
      </div>

      {/* Diagram canvas */}
      <div
        className="flex-1 overflow-hidden relative bg-white"
        style={{ cursor: "grab" }}
        onWheel={pz.onWheel}
        onPointerDown={pz.onPointerDown}
        onPointerMove={pz.onPointerMove}
        onPointerUp={pz.onPointerUp}
        onPointerLeave={pz.onPointerUp}
      >
        <div
          style={{
            transform: `translate(${pz.pos.x}px, ${pz.pos.y}px) scale(${pz.scale})`,
            transformOrigin: "top left",
            willChange: "transform",
            padding: 32,
          }}
          ref={fsWrapRef}
        />
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 bg-background/80 border-t border-border/50 flex justify-between items-center shrink-0">
        <p className="text-[10px] text-muted-foreground">Scroll to zoom · Drag to pan</p>
        <p className="text-[10px] text-muted-foreground">Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Esc</kbd> to exit</p>
      </div>
    </div>,
    document.body
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const MermaidDiagram = ({ chart, title = "Diagram" }: Props) => {
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const pz = usePanZoom(1);

  useEffect(() => {
    if (!chart || !svgWrapRef.current) return;
    let cancelled = false;
    setLoading(true); setError(null); pz.reset();

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose",
          flowchart: { curve: "basis", padding: 20, htmlLabels: false } });
        const { svg } = await mermaid.render(`m-${Date.now()}`, sanitize(chart));
        if (cancelled || !svgWrapRef.current) return;
        svgWrapRef.current.innerHTML = svg;
        const el = svgWrapRef.current.querySelector("svg");
        if (el) { el.removeAttribute("height"); el.style.cssText = "width:100%;height:auto;display:block;"; }
        setSvgHtml(svg);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setError(e?.message ?? "Render error"); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  const copy = () => { navigator.clipboard.writeText(chart); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const download = () => downloadSvgFrom(svgWrapRef.current, `${title.replace(/\s+/g, "-").toLowerCase()}.svg`);

  return (
    <>
      <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-background">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 bg-muted/40 border-b border-border shrink-0">
          <span className="text-xs font-medium text-muted-foreground flex-1">
            {loading ? "Rendering…" : error ? "Source (syntax error)" : title}
          </span>
          {!error && !loading && (
            <>
              <Btn onClick={() => pz.zoom(0.15)} title="Zoom in"><ZoomIn className="size-3.5" /></Btn>
              <Btn onClick={() => pz.zoom(-0.15)} title="Zoom out"><ZoomOut className="size-3.5" /></Btn>
              <Btn onClick={pz.reset} title="Reset"><RotateCcw className="size-3.5" /></Btn>
              <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(pz.scale * 100)}%</span>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Btn onClick={() => setFullscreen(true)} title="Fullscreen" active={fullscreen}>
                <Maximize2 className="size-3.5" />
              </Btn>
              <Btn onClick={download} title="Download SVG"><Download className="size-3.5" /></Btn>
            </>
          )}
          <Btn onClick={copy} title="Copy Mermaid source">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Btn>
        </div>

        {/* Inline viewport */}
        <DiagramViewport
          svgWrapRef={svgWrapRef}
          loading={loading}
          error={error}
          chart={chart}
          pz={pz}
          inline
        />

        {!error && !loading && (
          <div className="px-3 py-1.5 border-t border-border/40 bg-muted/10 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">Scroll to zoom · Drag to pan</p>
            <button
              onClick={() => setFullscreen(true)}
              className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1"
            >
              <Maximize2 className="size-2.5" /> Open fullscreen
            </button>
          </div>
        )}
      </div>

      {fullscreen && svgHtml && (
        <FullscreenOverlay
          chart={chart}
          title={title}
          svgHtml={svgHtml}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
};
