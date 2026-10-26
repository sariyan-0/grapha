"use client";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { analyze, compileExpression, type Finding } from "@/lib/math";
import { useGraph } from "@/lib/store";
const format = (n: number) => Number(n.toFixed(4)).toString();
export default function AnalysisPanel({
  selected,
  onSelect,
  onInspect,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onInspect: (point: Finding) => void;
}) {
  const project = useGraph((s) => s.project);
  const active =
    project.expressions.find((e) => e.id === selected) ??
    project.expressions[0];
  const compiled = active && compileExpression(active.text, project.parameters);
  const findings = useMemo(() => {
    const fn = active && compileExpression(active.text, project.parameters).fn;
    if (!fn) return [];
    const min = project.viewport.x - 10,
      max = project.viewport.x + 10;
    const points = analyze(fn, min, max);
    for (const other of project.expressions) {
      if (other.id === active.id || !other.visible) continue;
      const otherFn = compileExpression(other.text, project.parameters).fn;
      if (!otherFn) continue;
      for (const p of analyze((x) => fn(x) - otherFn(x), min, max)) {
        if (p.kind === "Root")
          points.push({ kind: "Intersection", x: p.x, y: fn(p.x) });
      }
    }
    return points
      .filter(
        (p, i, list) =>
          !list
            .slice(0, i)
            .some((q) => q.kind === p.kind && Math.abs(q.x - p.x) < 0.001),
      )
      .sort((a, b) => a.x - b.x);
  }, [active, project.expressions, project.parameters, project.viewport.x]);
  return (
    <div className="analysis-panel">
      <div className="analysis-intro">
        <Sparkles size={18} />
        <h2>Analysis</h2>
        <p>Roots, turning points, and intersections.</p>
      </div>
      <label>
        Expression
        <select
          value={active?.id ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          {project.expressions.map((e, i) => (
            <option value={e.id} key={e.id}>
              {i + 1}. {e.text.includes("=") ? e.text : `y = ${e.text}`}
            </option>
          ))}
        </select>
      </label>
      {compiled?.variables && (
        <p className="analysis-coordinates">
          Horizontal:{" "}
          {compiled.variables.axis === "horizontal"
            ? compiled.variables.output
            : compiled.variables.input}{" "}
          · Vertical:{" "}
          {compiled.variables.axis === "horizontal"
            ? compiled.variables.input
            : compiled.variables.output}
        </p>
      )}
      <div className="analysis-range">
        Search interval: [{format(project.viewport.x - 10)},{" "}
        {format(project.viewport.x + 10)}]
        <small>Numerical approximations · click to inspect</small>
      </div>
      {findings.map((p, i) => (
        <button className="finding" key={i} onClick={() => onInspect(p)}>
          <span>
            <i style={{ background: active?.color }} />
            {p.kind === "Y-intercept" ? "Vertical intercept" : p.kind}
          </span>
          <code>
            ({format(p.x)}, {format(p.y)})
          </code>
        </button>
      ))}
      {compiled?.inverseFn ? (
        <p className="muted">
          This graph is plotted horizontally. Trace it on the graph to inspect
          coordinates; numerical analysis is currently available for vertical
          functions.
        </p>
      ) : (
        findings.length === 0 && (
          <p className="muted">
            No validated intercepts or extrema found in this interval.
          </p>
        )
      )}
      <div className="analysis-note">
        Results are sampled numerically. Isolated roots and narrow features may
        require a closer view. Symbolic domain, range, and asymptote analysis
        are not available.
      </div>
    </div>
  );
}
