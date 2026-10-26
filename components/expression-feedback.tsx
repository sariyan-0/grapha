"use client";
import { useEffect, useState } from "react";
import { CircleAlert, Info } from "lucide-react";
import type { ExpressionIssue } from "@/lib/expression-errors";

export default function ExpressionFeedback({
  id,
  source,
  issue,
  editing,
  onAddParameter,
}: {
  id: string;
  source: string;
  issue?: ExpressionIssue;
  editing: boolean;
  onAddParameter: (name: string) => void;
}) {
  const key = `${source}:${issue?.message ?? ""}`;
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    if (!editing || !issue) return;
    const timer = setTimeout(() => setSettled(key), 350);
    return () => clearTimeout(timer);
  }, [editing, issue, key]);
  const visible = source.trim() && issue && (!editing || settled === key);
  return (
    <div
      id={id}
      className={`expression-feedback ${issue?.kind === "incomplete" ? "incomplete" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {visible && (
        <>
          {issue.kind === "incomplete" ? (
            <Info size={14} />
          ) : (
            <CircleAlert size={14} />
          )}
          <div>
            <span>{issue.message}</span>
            <small>{issue.hint}</small>
            {issue.parameter && (
              <button onClick={() => onAddParameter(issue.parameter!)}>
                Add slider for {issue.parameter}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
