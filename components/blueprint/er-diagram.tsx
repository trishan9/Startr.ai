"use client";

import type { DatabaseEntity } from "@/lib/agents/types";

const TYPE_COLORS: Record<string, string> = {
  UUID:        "text-violet-500",
  TEXT:        "text-sky-500",
  VARCHAR:     "text-sky-500",
  INT:         "text-emerald-500",
  INTEGER:     "text-emerald-500",
  BIGINT:      "text-emerald-500",
  BOOLEAN:     "text-amber-500",
  BOOL:        "text-amber-500",
  TIMESTAMPTZ: "text-rose-400",
  TIMESTAMP:   "text-rose-400",
  DATE:        "text-rose-400",
  NUMERIC:     "text-emerald-500",
  DECIMAL:     "text-emerald-500",
  JSONB:       "text-orange-400",
  JSON:        "text-orange-400",
};

function typeColor(type: string) {
  const base = type.split("(")[0].toUpperCase();
  return TYPE_COLORS[base] ?? "text-muted-foreground";
}

function shortType(type: string) {
  // Strip length params: VARCHAR(255) → VARCHAR
  return type.split("(")[0].toUpperCase();
}

function isPK(constraints: string[]) {
  return constraints.some(c => c.toUpperCase().includes("PRIMARY"));
}

function isFK(name: string, constraints: string[]) {
  const fromConstraint = constraints.some(c => c.toUpperCase().includes("REFERENCES"));
  return fromConstraint || (name.endsWith("_id") && name !== "id");
}

function isNotNull(constraints: string[]) {
  return constraints.some(c => c.toUpperCase().replace(/\s+/g, " ").includes("NOT NULL"));
}

interface Props {
  entities: DatabaseEntity[];
}

export const ERDiagram = ({ entities }: Props) => {
  return (
    <div className="space-y-4">
      {/* Table cards — single column so field names never truncate */}
      <div className="flex flex-col gap-3">
        {entities.map((entity) => (
          <div
            key={entity.name}
            className="rounded-xl border border-border overflow-hidden bg-background shadow-sm"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/8 border-b border-primary/15">
              <div className="size-2 rounded-full bg-primary shrink-0" />
              <span className="font-mono text-sm font-bold text-foreground">{entity.name}</span>
              {entity.description && (
                <span className="ml-2 text-xs text-muted-foreground">{entity.description}</span>
              )}
            </div>

            {/* Fields table */}
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-8"></th>
                  <th className="text-left px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Column</th>
                  <th className="text-left px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Constraints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {entity.fields.map((field) => {
                  const pk = isPK(field.constraints);
                  const fk = isFK(field.name, field.constraints);
                  const nn = isNotNull(field.constraints);
                  return (
                    <tr
                      key={field.name}
                      className={`${pk ? "bg-amber-50/40 dark:bg-amber-500/5" : "hover:bg-muted/20"} transition-colors`}
                    >
                      {/* Badge */}
                      <td className="px-3 py-2 text-center">
                        {pk ? (
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">PK</span>
                        ) : fk ? (
                          <span className="text-[9px] font-bold text-sky-500 bg-sky-500/10 px-1 py-0.5 rounded">FK</span>
                        ) : (
                          <span className="text-muted-foreground/20">·</span>
                        )}
                      </td>
                      {/* Name — no truncation */}
                      <td className="px-3 py-2">
                        <span className={`font-mono ${pk ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                          {field.name}
                        </span>
                      </td>
                      {/* Type */}
                      <td className="px-3 py-2">
                        <span className={`font-mono font-medium ${typeColor(field.type)}`}>
                          {shortType(field.type)}
                        </span>
                      </td>
                      {/* Constraints */}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {nn && <span className="text-[9px] text-rose-400 font-bold bg-rose-400/10 px-1 py-0.5 rounded">NOT NULL</span>}
                          {field.constraints
                            .filter(c => !c.toUpperCase().includes("NOT NULL") && !c.toUpperCase().includes("PRIMARY") && !c.toUpperCase().includes("DEFAULT"))
                            .map(c => (
                              <span key={c} className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded">{c}</span>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Relationships */}
            {entity.relationships?.length > 0 && (
              <div className="px-4 py-2 bg-muted/20 border-t border-border/40 flex flex-wrap gap-2">
                {entity.relationships.map((rel, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                    <span className="text-primary font-bold">→</span>
                    {rel}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 px-1 pt-1">
        {[
          { label: "PK", bg: "bg-amber-500/10", color: "text-amber-500", desc: "Primary Key" },
          { label: "FK", bg: "bg-sky-500/10",   color: "text-sky-500",   desc: "Foreign Key" },
          { label: "NOT NULL", bg: "bg-rose-400/10", color: "text-rose-400", desc: "Required" },
        ].map(({ label, bg, color, desc }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={`font-bold font-mono text-[9px] px-1 py-0.5 rounded ${bg} ${color}`}>{label}</span>
            {desc}
          </div>
        ))}
      </div>
    </div>
  );
};
