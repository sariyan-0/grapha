"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Check,
  Copy,
  MoreHorizontal,
  Plus,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import MathEditor from "./math-editor";
import WorkspaceItems from "./workspace-items";
import ExpressionFeedback from "./expression-feedback";
import { compileExpression } from "@/lib/math";
import { colors, useGraph } from "@/lib/store";

export default function ExpressionList({
  selected,
  onSelect,
  onAnalyze,
  onEdit,
  onTouchFocus,
  reduceMotion,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onAnalyze: (id: string) => void;
  onEdit: () => void;
  onTouchFocus: () => void;
  reduceMotion: boolean;
}) {
  const { project, update, expression, add } = useGraph();
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const drag = useRef<string | null>(null);
  function addAndFocus() {
    const id = add();
    if (id) onSelect(id);
  }
  return (
    <div className="expression-list">
      <AnimatePresence initial={false}>
        {project.expressions.map((expr, index) => {
          const { issue } = compileExpression(expr.text, project.parameters);
          const feedbackId = `expression-feedback-${expr.id}`;
          return (
            <motion.div
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
              className={`expression-row ${selected === expr.id ? "selected" : ""}`}
              key={expr.id}
              onClick={() => onSelect(expr.id)}
              onFocusCapture={() => {
                onSelect(expr.id);
                setEditing(expr.id);
              }}
              onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                  setEditing(null);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const list = [...project.expressions],
                  from = list.findIndex((x) => x.id === drag.current);
                if (from < 0) return;
                const [item] = list.splice(from, 1);
                list.splice(index, 0, item);
                update({ expressions: list });
                drag.current = null;
              }}
            >
              <span
                className="row-number"
                draggable
                onDragStart={() => (drag.current = expr.id)}
                title="Drag to reorder"
              >
                {index + 1}
              </span>
              <button
                className="icon-button row-more"
                title="Expression options"
                aria-label={`Actions for expression ${index + 1}`}
                aria-expanded={menu === expr.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(menu === expr.id ? null : expr.id);
                }}
              >
                <MoreHorizontal size={16} />
              </button>
              <div className="equation-line">
                <button
                  className={`color-orb ${!expr.visible ? "hidden-curve" : ""}`}
                  style={
                    {
                      "--curve": expr.color,
                    } as React.CSSProperties
                  }
                  aria-label={`${expr.visible ? "Hide" : "Show"} expression ${index + 1}`}
                  onClick={() =>
                    expression(expr.id, {
                      visible: !expr.visible,
                    })
                  }
                >
                  {expr.visible && <Waves size={16} />}
                </button>
                <MathEditor
                  autoFocus={selected === expr.id && !expr.text}
                  invalid={Boolean(issue && issue.kind !== "incomplete")}
                  describedBy={feedbackId}
                  text={expr.text}
                  latex={expr.latex}
                  onChange={(text, latex) => {
                    onEdit();
                    expression(expr.id, { text, latex });
                  }}
                  onEnter={addAndFocus}
                  onTouchFocus={onTouchFocus}
                />
              </div>
              <ExpressionFeedback
                id={feedbackId}
                source={expr.text}
                issue={issue}
                editing={editing === expr.id}
                onAddParameter={(name) =>
                  update({ parameters: { ...project.parameters, [name]: 1 } })
                }
              />
              {menu === expr.id && (
                <div className="expression-menu">
                  <div className="color-options">
                    {colors.map((color) => (
                      <button
                        key={color}
                        style={{ background: color }}
                        aria-label={`Set color ${color}`}
                        onClick={() => expression(expr.id, { color })}
                      >
                        {color === expr.color && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      onSelect(expr.id);
                      onAnalyze(expr.id);
                      setMenu(null);
                    }}
                  >
                    <Activity size={14} />
                    Analyze
                  </button>
                  <button
                    disabled={project.expressions.length >= 50}
                    onClick={() => {
                      update({
                        expressions: [
                          ...project.expressions,
                          { ...expr, id: crypto.randomUUID() },
                        ],
                      });
                      setMenu(null);
                    }}
                  >
                    <Copy size={14} />
                    Duplicate
                  </button>
                  <button
                    className="delete-action"
                    onClick={() => {
                      update({
                        expressions: project.expressions.filter(
                          (e) => e.id !== expr.id,
                        ),
                      });
                      setMenu(null);
                    }}
                  >
                    <Trash2 size={14} />
                    Delete expression
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {project.expressions.length === 0 && !project.items?.length && (
        <div className="empty-state">
          <Waves size={28} />
          <p>Enter an equation to start graphing.</p>
          <small>Try y = sin(x) or y = x².</small>
        </div>
      )}
      <WorkspaceItems selected={selected} onSelect={onSelect} />
      <button
        className="add-expression"
        disabled={project.expressions.length >= 50}
        title={
          project.expressions.length >= 50
            ? "Maximum 50 expressions per graph"
            : undefined
        }
        onClick={addAndFocus}
      >
        <Plus size={16} />
        Add expression<span>↵</span>
      </button>
      <div className="parameter-section">
        {Object.entries(project.parameters ?? {}).map(([name, value]) => (
          <div className="parameter" key={name}>
            <div>
              <label htmlFor={`parameter-${name}`}>{name}</label>
              <output>{Number(value.toFixed(1))}</output>
              <button
                aria-label={`Remove parameter ${name}`}
                onClick={() => {
                  const parameters = {
                    ...project.parameters,
                  };
                  delete parameters[name];
                  update({ parameters });
                }}
              >
                <X size={12} />
              </button>
            </div>
            <input
              id={`parameter-${name}`}
              type="range"
              min="-10"
              max="10"
              step="0.1"
              value={value}
              onChange={(e) =>
                update(
                  {
                    parameters: {
                      ...project.parameters,
                      [name]: Number(e.target.value),
                    },
                  },
                  false,
                )
              }
            />
            <div className="parameter-bounds">
              <span>−10</span>
              <span>10</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
