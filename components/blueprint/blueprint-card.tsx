"use client";

import { useState } from "react";
import {
  CheckCircle2, ChevronDown, ChevronRight, Copy, Check,
  Layers, Database, Zap, Calendar, Box, Users, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StartupBlueprint, AgentProgress } from "@/lib/agents/types";
import { Spinner } from "@/components/ui/spinner";
import { MermaidDiagram } from "./mermaid-diagram";
import { ERDiagram } from "./er-diagram";
import type { DatabaseEntity } from "@/lib/agents/types";

// ── Build Mermaid erDiagram from entities ─────────────────────────────────────
function buildErDiagram(entities: DatabaseEntity[]): string {
  const lines = ["erDiagram"];

  // Entity definitions
  for (const entity of entities) {
    lines.push(`    ${entity.name} {`);
    for (const field of entity.fields) {
      const pk = field.constraints.some(c => c.toUpperCase().includes("PRIMARY")) ? " PK" : "";
      const fk = (field.name.endsWith("_id") && field.name !== "id") ||
        field.constraints.some(c => c.toUpperCase().includes("REFERENCES")) ? " FK" : "";
      const safeType = field.type.split("(")[0].replace(/[^A-Za-z0-9_]/g, "") || "TEXT";
      const safeName = field.name.replace(/[^A-Za-z0-9_]/g, "_");
      lines.push(`        ${safeType} ${safeName}${pk}${fk}`);
    }
    lines.push("    }");
  }

  // Relationships — deduplicated so the same pair is never added twice
  const tableNames = new Set(entities.map(e => e.name.toLowerCase()));
  // Key: canonical sorted pair "tableA|tableB" → already emitted
  const seen = new Set<string>();

  const addRel = (a: string, b: string, line: string) => {
    const key = [a.toLowerCase(), b.toLowerCase()].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(line);
  };

  for (const entity of entities) {
    for (const rel of entity.relationships ?? []) {
      const hasManyMatch  = rel.match(/has_many[:\s]+(\w+)/i);
      const belongsToMatch = rel.match(/belongs_to[:\s]+(\w+)/i);
      const hasOneMatch   = rel.match(/has_one[:\s]+(\w+)/i);

      if (hasManyMatch && tableNames.has(hasManyMatch[1].toLowerCase())) {
        addRel(entity.name, hasManyMatch[1],
          `    ${entity.name} ||--o{ ${hasManyMatch[1]} : "has many"`);
      } else if (belongsToMatch && tableNames.has(belongsToMatch[1].toLowerCase())) {
        // Normalise to the "parent ||--o{ child" direction so both sides converge
        addRel(belongsToMatch[1], entity.name,
          `    ${belongsToMatch[1]} ||--o{ ${entity.name} : "has many"`);
      } else if (hasOneMatch && tableNames.has(hasOneMatch[1].toLowerCase())) {
        addRel(entity.name, hasOneMatch[1],
          `    ${entity.name} ||--|| ${hasOneMatch[1]} : "has one"`);
      }
    }
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint progress card (while agents are running)
// ─────────────────────────────────────────────────────────────────────────────
export const BlueprintProgress = ({ agents }: { agents: AgentProgress[] }) => (
  <div className="mx-2 my-2 rounded-xl border border-border bg-card p-4 flex flex-col gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Spinner className="size-4 shrink-0 text-primary" />
      <span>Building Technical Blueprint…</span>
    </div>
    <div className="flex flex-col gap-1.5">
      {agents.map((agent) => (
        <div key={agent.agent} className="flex items-center gap-3 text-sm">
          <div className="size-4 flex items-center justify-center shrink-0">
            {agent.status === "complete" ? (
              <CheckCircle2 className="size-4 text-green-500" />
            ) : agent.status === "running" ? (
              <Spinner className="size-4 text-primary" />
            ) : agent.status === "error" ? (
              <span className="size-4 text-destructive text-xs font-bold">✗</span>
            ) : (
              <span className="size-2.5 rounded-full bg-muted-foreground/20 inline-block" />
            )}
          </div>
          <span className={cn(
            "text-muted-foreground transition-colors",
            agent.status === "running"  && "text-foreground font-semibold",
            agent.status === "complete" && "text-muted-foreground/60 line-through",
            agent.status === "error"    && "text-destructive",
          )}>
            {agent.label}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
};

const Section = ({
  icon, title, children, badge, defaultOpen = false,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
  badge?: string; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {icon}
          </span>
          {title}
          {badge && (
            <span className="ml-1 text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronDown className="size-4 text-muted-foreground" />
          : <ChevronRight className="size-4 text-muted-foreground" />
        }
      </button>
      {open && <div className="px-4 py-4 bg-background border-t border-border/50">{children}</div>}
    </div>
  );
};

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/8 text-primary border border-primary/15">
    {children}
  </span>
);

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    GET:    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    POST:   "bg-blue-500/10   text-blue-600   border-blue-500/20",
    PUT:    "bg-amber-500/10  text-amber-600  border-amber-500/20",
    PATCH:  "bg-orange-500/10 text-orange-600 border-orange-500/20",
    DELETE: "bg-red-500/10    text-red-600    border-red-500/20",
  };
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border font-mono shrink-0",
      colors[method] ?? "bg-muted text-muted-foreground border-border"
    )}>
      {method}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Database section with ER diagram / table toggle
// ─────────────────────────────────────────────────────────────────────────────
const DatabaseSection = ({
  entities,
  sql,
}: {
  entities: DatabaseEntity[];
  sql?: string;
}) => {
  const [tab, setTab] = useState<"er" | "tables" | "sql">("er");
  const erChart = buildErDiagram(entities);

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        {(["er", "tables", "sql"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "er" ? "ER Diagram" : t === "tables" ? "Tables" : "SQL"}
          </button>
        ))}
      </div>

      {tab === "er" && (
        <MermaidDiagram chart={erChart} title="Entity Relationship Diagram" />
      )}
      {tab === "tables" && <ERDiagram entities={entities} />}
      {tab === "sql" && sql && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
            <span className="text-[10px] font-mono text-muted-foreground font-medium">PostgreSQL</span>
            <CopyButton text={sql} />
          </div>
          <pre className="p-3 text-xs font-mono text-foreground overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed scrollbar-none [&::-webkit-scrollbar]:hidden">
            {sql}
          </pre>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main BlueprintCard
// ─────────────────────────────────────────────────────────────────────────────
export const BlueprintCard = ({ blueprint }: { blueprint: StartupBlueprint }) => {
  const { product, architecture, database, api, diagram, roadmap } = blueprint;

  return (
    <div className="mx-2 my-2 rounded-xl border border-primary/20 bg-card shadow-sm animate-in fade-in slide-in-from-bottom-2 overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/8 to-primary/3 border-b border-primary/15">
        <div className="size-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Box className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Technical Blueprint</p>
          <p className="text-xs text-muted-foreground truncate">{product.concept}</p>
        </div>
        <CheckCircle2 className="size-5 text-green-500 shrink-0" />
      </div>

      <div className="flex flex-col gap-2 p-3">

        {/* ── 1. Product Summary ─────────────────────────────────────────── */}
        <Section icon={<Users className="size-3.5" />} title="Product Summary" defaultOpen>
          <div className="space-y-4">
            <p className="text-sm text-foreground leading-relaxed">{product.valueProposition}</p>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Users</p>
              <div className="flex flex-wrap gap-1.5">{product.targetUsers.map(u => <Tag key={u}>{u}</Tag>)}</div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Core Features</p>
              <ul className="space-y-1">
                {product.coreFeatures.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="size-3.5 text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ── 2. System Architecture ────────────────────────────────────── */}
        <Section icon={<Layers className="size-3.5" />} title="System Architecture">
          <div className="space-y-4">
            <p className="text-sm text-foreground leading-relaxed">{architecture.overview}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Frontend</p>
                <p className="text-xs font-semibold text-primary">{architecture.frontend.framework}</p>
                {architecture.frontend.components.map(c => (
                  <p key={c} className="text-xs text-muted-foreground">• {c}</p>
                ))}
              </div>
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Backend</p>
                <p className="text-xs font-semibold text-primary">{architecture.backend.framework}</p>
                {architecture.backend.services.map(s => (
                  <p key={s} className="text-xs text-muted-foreground">• {s}</p>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Infrastructure</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {Object.entries(architecture.infrastructure).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[9px] text-muted-foreground uppercase">{k}</p>
                    <p className="text-xs font-medium text-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 3. Architecture Diagram (rendered Mermaid) ────────────────── */}
        <Section icon={<Globe className="size-3.5" />} title="Architecture Diagram">
          <MermaidDiagram chart={diagram.content} title="System Architecture" />
          {diagram.description && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{diagram.description}</p>
          )}
        </Section>

        {/* ── 4. Database Schema ────────────────────────────────────────── */}
        <Section
          icon={<Database className="size-3.5" />}
          title="Database Schema"
          badge={`${database.entities.length} tables`}
        >
          <DatabaseSection entities={database.entities} sql={database.sql} />
        </Section>

        {/* ── 5. API Specification ──────────────────────────────────────── */}
        <Section
          icon={<Zap className="size-3.5" />}
          title="API Endpoints"
          badge={`${api.endpoints.length} routes`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xs font-mono bg-muted px-2 py-1 rounded-md text-foreground">{api.baseUrl}</span>
              <span className="text-xs text-muted-foreground">v{api.version}</span>
              <Tag>{api.authStrategy.split(" ").slice(0, 2).join(" ")}</Tag>
            </div>
            <div className="space-y-1.5">
              {api.endpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors px-3 py-2">
                  <MethodBadge method={ep.method} />
                  <span className="font-mono text-xs text-foreground flex-1 truncate">{ep.path}</span>
                  <span className="text-[10px] text-muted-foreground truncate hidden sm:block">{ep.description}</span>
                  {ep.auth && <span className="text-[10px] shrink-0" title="Requires auth">🔒</span>}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── 6. MVP Roadmap ────────────────────────────────────────────── */}
        <Section
          icon={<Calendar className="size-3.5" />}
          title="MVP Roadmap"
          badge={roadmap.totalDuration}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {roadmap.techStack.map(t => <Tag key={t}>{t}</Tag>)}
            </div>
            {/* Timeline */}
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
              {roadmap.stages.map((stage) => (
                <div key={stage.stage} className="relative">
                  <div className="absolute -left-4 top-1 size-4 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center">
                    <span className="text-[8px] font-bold text-primary">{stage.stage}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
                      <span className="text-xs font-bold text-foreground">{stage.name}</span>
                      <span className="text-[10px] text-muted-foreground">{stage.duration}</span>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {stage.features.map(f => (
                        <div key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="text-primary mt-0.5">›</span>
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Generated by Startr · {new Date(blueprint.generatedAt).toLocaleString()}
        </p>
        <span className="text-[10px] text-muted-foreground font-medium">GPT-5.4 · 6 agents</span>
      </div>
    </div>
  );
};
