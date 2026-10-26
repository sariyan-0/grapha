"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize, RotateCcw } from "lucide-react";
import {
  compileExpression,
  sample,
  sampleInverse,
  tickStep,
  toScreen,
  toWorld,
  type Viewport,
} from "@/lib/math";
import { useGraph } from "@/lib/store";
import { tablePoints } from "@/lib/workspace-items";
export default function GraphCanvas({
  grid,
  axes,
  light,
  trace,
  onInspect,
  reduceMotion,
  xLabel = "x",
  yLabel = "y",
}: {
  grid: boolean;
  axes: boolean;
  light: boolean;
  trace: boolean;
  reduceMotion: boolean;
  xLabel?: string;
  yLabel?: string;
  onInspect: (x: number, y: number, id: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null);
  const project = useGraph((s) => s.project);
  const update = useGraph((s) => s.update);
  const [cursor, setCursor] = useState<{
    id: string;
    x: number;
    y: number;
    px: number;
    py: number;
    color: string;
  } | null>(null);
  const [renderError, setRenderError] = useState("");
  const [drawAttempt, setDrawAttempt] = useState(0);
  const pointer = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const hasDrawn = useRef(false);
  const curveChanges = useRef(
    new Map<string, { signature: string; startedAt: number }>(),
  );
  const change = (v: Viewport) =>
    update(
      {
        viewport: {
          ...v,
          x: Math.max(-1e9, Math.min(1e9, v.x)),
          y: Math.max(-1e9, Math.min(1e9, v.y)),
        },
      },
      false,
    );
  useEffect(() => {
    const el = canvas.current!,
      box = container.current!;
    let frame = 0;
    let sampleSize = "";
    const samples = new Map<string, ReturnType<typeof sample>>();
    const now = performance.now();
    const changes = new Map<string, { signature: string; startedAt: number }>();
    for (const expression of project.expressions) {
      const signature = JSON.stringify([
        expression.text,
        expression.color,
        expression.visible,
        project.parameters,
      ]);
      const previous = curveChanges.current.get(expression.id);
      const startedAt =
        reduceMotion || !hasDrawn.current
          ? -Infinity
          : previous?.signature === signature
            ? previous.startedAt
            : now;
      changes.set(expression.id, { signature, startedAt });
    }
    curveChanges.current = changes;
    const draw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = box.clientWidth,
          h = box.clientHeight,
          dpr = window.devicePixelRatio || 1;
        const size = `${w}:${h}`;
        if (size !== sampleSize) {
          samples.clear();
          sampleSize = size;
        }
        let animating = false;
        const frameTime = performance.now();
        el.width = w * dpr;
        el.height = h * dpr;
        const ctx = el.getContext("2d");
        if (!ctx) {
          setRenderError(
            "The graph couldn’t be drawn. Retry, or export JSON to keep your work.",
          );
          return;
        }
        ctx.scale(dpr, dpr);
        ctx.fillStyle = light ? "#f6f8fc" : "#15171b";
        ctx.fillRect(0, 0, w, h);
        const v = project.viewport,
          step = tickStep(v.scale),
          origin = toScreen(0, 0, v, w, h);
        const bounds = {
          min: toWorld(0, h, v, w, h),
          max: toWorld(w, 0, v, w, h),
        };
        const lines = (spacing: number, major: boolean) => {
          ctx.strokeStyle = light
            ? major
              ? "#dce0e9"
              : "#ebedf2"
            : major
              ? "#2a2d34"
              : "#1d1f25";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (
            let x = Math.ceil(bounds.min.x / spacing) * spacing;
            x <= bounds.max.x;
            x += spacing
          ) {
            const px = toScreen(x, 0, v, w, h).x;
            ctx.moveTo(Math.round(px) + 0.5, 0);
            ctx.lineTo(Math.round(px) + 0.5, h);
          }
          for (
            let y = Math.ceil(bounds.min.y / spacing) * spacing;
            y <= bounds.max.y;
            y += spacing
          ) {
            const py = toScreen(0, y, v, w, h).y;
            ctx.moveTo(0, Math.round(py) + 0.5);
            ctx.lineTo(w, Math.round(py) + 0.5);
          }
          ctx.stroke();
        };
        if (grid) {
          lines(step / 5, false);
          lines(step, true);
        }
        if (axes) {
          ctx.strokeStyle = light ? "#a1aabc" : "#626773";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(origin.x, 0);
          ctx.lineTo(origin.x, h);
          ctx.moveTo(0, origin.y);
          ctx.lineTo(w, origin.y);
          ctx.stroke();
          ctx.fillStyle = light ? "#626d82" : "#9b9fab";
          ctx.font = "11px Arial";
          ctx.textAlign = "center";
          for (
            let x = Math.ceil(bounds.min.x / step) * step;
            x < bounds.max.x;
            x += step
          )
            if (Math.abs(x) > step / 100)
              ctx.fillText(
                String(Number(x.toPrecision(5))),
                toScreen(x, 0, v, w, h).x,
                Math.min(h - 14, Math.max(18, origin.y + 20)),
              );
          ctx.textAlign = "right";
          for (
            let y = Math.ceil(bounds.min.y / step) * step;
            y < bounds.max.y;
            y += step
          )
            if (Math.abs(y) > step / 100)
              ctx.fillText(
                String(Number(y.toPrecision(5))),
                Math.max(28, Math.min(w - 10, origin.x - 12)),
                toScreen(0, y, v, w, h).y + 4,
              );
          ctx.fillText("0", origin.x - 12, origin.y + 20);
          ctx.font = "italic 14px Georgia";
          ctx.fillText(
            xLabel,
            w - 17,
            Math.max(20, Math.min(h - 14, origin.y - 13)),
          );
          ctx.fillText(
            yLabel,
            Math.max(
              22 + ctx.measureText(yLabel).width,
              Math.min(w - 14, origin.x + 12 + ctx.measureText(yLabel).width),
            ),
            23,
          );
        }
        for (const e of project.expressions) {
          if (!e.visible) continue;
          const { fn, inverseFn } = compileExpression(
            e.text,
            project.parameters,
          );
          if (!fn && !inverseFn) continue;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 2.4;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.shadowColor = e.color;
          ctx.shadowBlur = 0;
          // Fade the newly evaluated curve; never interpolate between mathematical results.
          const progress = reduceMotion
            ? 1
            : Math.min(
                1,
                Math.max(
                  0,
                  (frameTime - (changes.get(e.id)?.startedAt ?? -Infinity)) /
                    180,
                ),
              );
          ctx.globalAlpha = 0.5 + 0.5 * (1 - (1 - progress) ** 3);
          animating ||= progress < 1;
          let segments = samples.get(e.id);
          if (!segments) {
            segments = fn
              ? sample(fn, v, w, h)
              : sampleInverse(inverseFn!, v, w, h);
            samples.set(e.id, segments);
          }
          ctx.beginPath();
          for (const seg of segments) {
            ctx.moveTo(seg[0].x, seg[0].y);
            for (const p of seg.slice(1)) ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }
        for (const point of tablePoints(project.items)) {
          const screen = toScreen(point.x, point.y, v, w, h);
          if (
            screen.x < -6 ||
            screen.x > w + 6 ||
            screen.y < -6 ||
            screen.y > h + 6
          )
            continue;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = point.color;
          ctx.fill();
          ctx.strokeStyle = light ? "#ffffff" : "#15171b";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        hasDrawn.current = true;
        if (animating) draw();
      });
    };
    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(box);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [project, grid, axes, light, reduceMotion, drawAttempt, xLabel, yLabel]);
  useEffect(() => {
    const box = container.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = box.getBoundingClientRect(),
        p = useGraph.getState().project.viewport,
        w = box.clientWidth,
        h = box.clientHeight;
      const anchor = toWorld(e.clientX - r.left, e.clientY - r.top, p, w, h),
        scale = Math.min(
          2000,
          Math.max(2, p.scale * Math.exp(-e.deltaY * 0.0015)),
        );
      useGraph.getState().update(
        {
          viewport: {
            scale,
            x: anchor.x - (e.clientX - r.left - w / 2) / scale,
            y: anchor.y + (e.clientY - r.top - h / 2) / scale,
          },
        },
        false,
      );
    };
    box.addEventListener("wheel", wheel, { passive: false });
    return () => box.removeEventListener("wheel", wheel);
  }, []);
  const zoom = (factor: number) =>
    change({
      ...project.viewport,
      scale: Math.min(2000, Math.max(2, project.viewport.scale * factor)),
    });
  const fit = () => {
    const w = container.current!.clientWidth,
      h = container.current!.clientHeight;
    const points: { x: number; y: number }[] = tablePoints(project.items);
    for (const expression of project.expressions) {
      if (!expression.visible) continue;
      const { fn, inverseFn } = compileExpression(
        expression.text,
        project.parameters,
      );
      const evaluate = fn ?? inverseFn;
      if (!evaluate) continue;
      for (let i = 0; i <= 200; i++) {
        const input = -5 + i * 0.05,
          value = evaluate(input);
        if (!Number.isFinite(value) || Math.abs(value) >= 100) continue;
        points.push(fn ? { x: input, y: value } : { x: value, y: input });
      }
    }
    if (points.length) {
      const left = Math.min(-5, ...points.map((p) => p.x)),
        right = Math.max(5, ...points.map((p) => p.x));
      const bottom = Math.min(...points.map((p) => p.y)),
        top = Math.max(...points.map((p) => p.y));
      change({
        x: (left + right) / 2,
        y: (bottom + top) / 2,
        scale: Math.max(
          2,
          Math.min(
            w / ((right - left) * 1.2),
            h / (Math.max(top - bottom, 2) * 1.3),
          ),
        ),
      });
    }
  };

  return (
    <div
      ref={container}
      className="graph"
      onPointerDown={(e) => {
        pointer.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moved.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect(),
          w = r.width,
          h = r.height;
        const previous = pointer.current.get(e.pointerId);
        if (previous) {
          const dx = e.clientX - previous.x,
            dy = e.clientY - previous.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
          const v = useGraph.getState().project.viewport;
          if (pointer.current.size === 2) {
            const other = [...pointer.current.entries()].find(
              ([id]) => id !== e.pointerId,
            )![1];
            const before = Math.hypot(
                previous.x - other.x,
                previous.y - other.y,
              ),
              after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
            if (before > 0)
              change({
                ...v,
                scale: Math.min(2000, Math.max(2, (v.scale * after) / before)),
              });
          } else change({ ...v, x: v.x - dx / v.scale, y: v.y + dy / v.scale });
          pointer.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          setCursor(null);
          return;
        }
        if (!trace) return;
        const p = toWorld(
          e.clientX - r.left,
          e.clientY - r.top,
          project.viewport,
          w,
          h,
        );
        let closest: typeof cursor = null;
        let distance = 28;
        for (const expr of project.expressions) {
          if (!expr.visible) continue;
          const { fn, inverseFn } = compileExpression(
            expr.text,
            project.parameters,
          );
          if (!fn && !inverseFn) continue;
          const x = inverseFn ? inverseFn(p.y) : p.x,
            y = fn ? fn(p.x) : p.y;
          const s = toScreen(x, y, project.viewport, w, h),
            d = Math.hypot(
              s.x - (e.clientX - r.left),
              s.y - (e.clientY - r.top),
            );
          if (d < distance) {
            distance = d;
            closest = {
              id: expr.id,
              x,
              y,
              px: s.x,
              py: s.y,
              color: expr.color,
            };
          }
        }
        for (const point of tablePoints(project.items)) {
          const screen = toScreen(point.x, point.y, project.viewport, w, h);
          const d = Math.hypot(
            screen.x - (e.clientX - r.left),
            screen.y - (e.clientY - r.top),
          );
          if (d < distance) {
            distance = d;
            closest = { ...point, px: screen.x, py: screen.y };
          }
        }
        setCursor(closest);
      }}
      onPointerUp={(e) => {
        pointer.current.delete(e.pointerId);
        if (!moved.current && cursor) onInspect(cursor.x, cursor.y, cursor.id);
      }}
      onPointerCancel={(e) => pointer.current.delete(e.pointerId)}
      onPointerLeave={() => setCursor(null)}
    >
      <canvas
        ref={canvas}
        id="graph-canvas"
        aria-label={`Interactive coordinate plane: ${xLabel} horizontally, ${yLabel} vertically. Drag to pan and scroll to zoom.`}
      />
      {renderError && (
        <div
          className="graph-render-error"
          role="alert"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p>{renderError}</p>
          <button
            onClick={() => {
              setRenderError("");
              setDrawAttempt((value) => value + 1);
            }}
          >
            Retry graph
          </button>
        </div>
      )}
      {cursor && (
        <div
          className="trace-point"
          style={{ left: cursor.px, top: cursor.py, borderColor: cursor.color }}
        >
          <span>
            ({cursor.x.toFixed(3)}, {cursor.y.toFixed(3)})
          </span>
        </div>
      )}
      <div
        className="graph-controls"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button title="Zoom in" aria-label="Zoom in" onClick={() => zoom(1.25)}>
          <Plus size={18} />
        </button>
        <button
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => zoom(0.8)}
        >
          <Minus size={18} />
        </button>
        <i />
        <button
          title="Fit graph to content"
          aria-label="Fit graph to content"
          onClick={fit}
        >
          <Maximize size={17} />
        </button>
        <button
          title="Reset view"
          aria-label="Reset view"
          onClick={() => change({ x: 0, y: 0, scale: 70 })}
        >
          <RotateCcw size={17} />
        </button>
      </div>
    </div>
  );
}
