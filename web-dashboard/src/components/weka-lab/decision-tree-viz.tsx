"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TreeNode } from "@/lib/weka-lab-api";
import { cn } from "@/lib/utils";

function TreeBranch({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  if (node.type === "leaf") {
    const top = Object.entries(node.probabilities).sort((a, b) => b[1] - a[1])[0];
    return (
      <div
        className={cn(
          "rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs",
          depth > 0 && "ml-4",
        )}
      >
        <span className="font-semibold text-emerald-300">{node.classLabel}</span>
        <span className="ml-2 text-slate-400">n={node.samples}</span>
        {top && (
          <span className="ml-2 text-cyan-400/90">
            {(top[1] * 100).toFixed(1)}% {top[0]}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-slate-700 pl-3")}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-2 rounded-lg border border-violet-900/50 bg-violet-950/30 px-3 py-2 text-left text-xs hover:bg-violet-950/50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
        )}
        <span>
          <span className="font-medium text-violet-200">{node.rule}</span>
          <span className="ml-2 text-slate-500">n={node.samples}</span>
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Sí</p>
            <TreeBranch node={node.left} depth={depth + 1} />
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">No</p>
            <TreeBranch node={node.right} depth={depth + 1} />
          </div>
        </div>
      )}
    </div>
  );
}

export function DecisionTreeViz({
  treeJson,
  treeText,
}: {
  treeJson?: { root: TreeNode; maxDepth: number; nLeaves: number };
  treeText?: string;
}) {
  if (!treeJson?.root) {
    return (
      <pre className="max-h-[60vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
        {treeText ?? "Seleccione un modelo entrenado para ver el árbol."}
      </pre>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <span>Profundidad: {treeJson.maxDepth}</span>
        <span>Hojas: {treeJson.nLeaves}</span>
      </div>
      <div className="max-h-[65vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4">
        <TreeBranch node={treeJson.root} />
      </div>
      {treeText && (
        <details className="rounded-lg border border-slate-800">
          <summary className="cursor-pointer px-4 py-2 text-sm text-slate-400">Texto del árbol (export)</summary>
          <pre className="max-h-48 overflow-auto p-4 text-[11px] text-slate-400">{treeText}</pre>
        </details>
      )}
    </div>
  );
}
