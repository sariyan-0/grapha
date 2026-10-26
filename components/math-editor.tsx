"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { expressionLatex, renderMathPreview } from "@/lib/math-notation";
export default function MathEditor({
  text,
  latex,
  autoFocus = false,
  onChange,
  onEnter,
  onTouchFocus,
  invalid = false,
  describedBy,
}: {
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
  text: string;
  latex?: string;
  onChange: (text: string, latex: string) => void;
  onEnter: () => void;
  onTouchFocus?: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const host = useRef<HTMLDivElement>(null),
    field = useRef<MathfieldElement | null>(null);
  const initialValue = useRef({ text, latex, autoFocus });
  const preview = useMemo(
    () => (ready ? "" : renderMathPreview(text, latex)),
    [ready, text, latex],
  );
  const callbacks = useRef({ onChange, onEnter, onTouchFocus });
  useEffect(() => {
    callbacks.current = { onChange, onEnter, onTouchFocus };
  }, [onChange, onEnter, onTouchFocus]);
  useEffect(() => {
    let disposed = false;
    let cleanup: undefined | (() => void);
    import("mathlive")
      .then(({ MathfieldElement }) => {
        if (disposed || !host.current) return;
        MathfieldElement.fontsDirectory = "/mathlive-fonts";
        MathfieldElement.soundsDirectory = null;
        const mf = new MathfieldElement();
        mf.mathVirtualKeyboardPolicy = "manual";
        mf.smartFence = true;
        mf.defaultMode = "math";
        mf.setAttribute("aria-label", "Mathematical expression");
        mf.value = expressionLatex(
          initialValue.current.text,
          initialValue.current.latex,
        );
        field.current = mf;
        host.current.appendChild(mf);
        const input = () =>
          callbacks.current.onChange(
            mf.getValue("ascii-math").replace(/\\/g, ""),
            mf.value,
          );
        const key = (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            callbacks.current.onEnter();
          }
        };
        const focus = () => {
          if (window.matchMedia("(pointer: coarse)").matches)
            callbacks.current.onTouchFocus?.();
        };
        mf.addEventListener("focus", focus);
        mf.addEventListener("input", input);
        mf.addEventListener("keydown", key);
        if (initialValue.current.autoFocus) mf.focus();
        cleanup = () => {
          mf.removeEventListener("focus", focus);
          mf.removeEventListener("input", input);
          mf.removeEventListener("keydown", key);
          mf.remove();
        };
        setReady(true);
      })
      .catch(() => {
        field.current?.remove();
        field.current = null;
        if (!disposed) {
          setReady(false);
          setFailed(true);
        }
      });
    return () => {
      disposed = true;
      cleanup?.();
      field.current = null;
    };
  }, [attempt]); // The custom element owns editing; external changes are synchronized below.
  useEffect(() => {
    const mf = field.current;
    const value = expressionLatex(text, latex);
    if (mf && mf.value !== value)
      mf.setValue(value, { silenceNotifications: true });
    initialValue.current = { text, latex, autoFocus };
    if (mf) {
      mf.setAttribute("aria-invalid", String(invalid));
      if (describedBy) mf.setAttribute("aria-describedby", describedBy);
      else mf.removeAttribute("aria-describedby");
    }
    if (mf && autoFocus) mf.focus();
  }, [text, latex, autoFocus, invalid, describedBy, ready]);
  return (
    <div className="math-editor" aria-busy={!ready && !failed}>
      {!ready &&
        (failed ? (
          <span
            className="math-editor-preview editor-status editor-failed"
            role="alert"
          >
            Editor couldn’t load.
            <button
              onClick={() => {
                setFailed(false);
                setReady(false);
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </button>
          </span>
        ) : preview ? (
          <span
            className="math-editor-preview"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        ) : (
          <span
            className="math-editor-preview editor-status"
            aria-hidden="true"
          >
            {text ? "Loading equation…" : "Enter an equation"}
          </span>
        ))}
      <div className="math-editor-field" ref={host} />
    </div>
  );
}
