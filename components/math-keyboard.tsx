"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CornerDownLeft,
  Delete,
} from "lucide-react";

export type KeyboardCommand =
  "moveToPreviousChar" | "moveToNextChar" | "deleteBackward";
type MathKey = { label: string; latex: string; name?: string };
const symbols: MathKey[] = [
  { label: "x", latex: "x" },
  { label: "y", latex: "y" },
  { label: "a²", latex: "#@^2", name: "Square" },
  { label: "aᵇ", latex: "#@^{#0}", name: "Power" },
  { label: "(", latex: "(" },
  { label: ")", latex: ")" },
  { label: "a/b", latex: "\\frac{#0}{#?}", name: "Fraction" },
  { label: "√", latex: "\\sqrt{#0}", name: "Square root" },
  { label: "|a|", latex: "\\left|#0\\right|", name: "Absolute value" },
  { label: "π", latex: "\\pi", name: "Pi" },
  { label: "e", latex: "e" },
  { label: ",", latex: "," },
  { label: "a", latex: "a" },
  { label: "b", latex: "b" },
  { label: "c", latex: "c" },
  { label: "ln", latex: "\\ln\\left(#0\\right)", name: "Natural logarithm" },
];
const functions: MathKey[] = [
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sinh",
  "cosh",
  "tanh",
  "log",
  "ln",
  "exp",
].map((name) => ({
  label: name,
  latex: `\\operatorname{${name}}\\left(#0\\right)`,
}));
const numbers: MathKey[] = [
  { label: "7", latex: "7" },
  { label: "8", latex: "8" },
  { label: "9", latex: "9" },
  { label: "÷", latex: "\\frac{#@}{#0}", name: "Divide" },
  { label: "4", latex: "4" },
  { label: "5", latex: "5" },
  { label: "6", latex: "6" },
  { label: "×", latex: "\\times", name: "Multiply" },
  { label: "1", latex: "1" },
  { label: "2", latex: "2" },
  { label: "3", latex: "3" },
  { label: "−", latex: "-", name: "Minus" },
  { label: "0", latex: "0" },
  { label: ".", latex: ".", name: "Decimal point" },
  { label: "=", latex: "=", name: "Equals" },
  { label: "+", latex: "+", name: "Plus" },
];

export default function MathKeyboard({
  onInsert,
  onCommand,
  onEnter,
  onClose,
  reduceMotion,
}: {
  onInsert: (latex: string) => void;
  onCommand: (command: KeyboardCommand) => void;
  onEnter: () => void;
  onClose: () => void;
  reduceMotion: boolean;
}) {
  const [layout, setLayout] = useState<"symbols" | "letters" | "functions">(
    "symbols",
  );
  const keys =
    layout === "symbols"
      ? symbols
      : layout === "functions"
        ? functions
        : Array.from("abcdefghijklmnopqrstuvwxyz", (letter) => ({
            label: letter,
            latex: letter,
          }));
  const renderKey = (key: MathKey, number = false) => (
    <button
      key={key.label}
      className={number && /^[0-9.]$/.test(key.label) ? "number-key" : ""}
      aria-label={key.name ?? key.label}
      onClick={() => onInsert(key.latex)}
    >
      {key.label}
    </button>
  );
  return (
    <motion.section
      className="math-keyboard"
      aria-label="Math keyboard"
      initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
      onPointerDown={(e) => {
        // Keep the editor's selection when a key is pressed.
        if (e.target instanceof Element && e.target.closest("button"))
          e.preventDefault();
      }}
    >
      <div className="keyboard-layout">
        <div
          className={`keyboard-symbols ${layout === "letters" ? "letter-layout" : ""}`}
        >
          {keys.map((key) => renderKey(key))}
        </div>
        <div className="keyboard-numbers">
          {numbers.map((key) => renderKey(key, true))}
        </div>
        <div className="keyboard-actions">
          <div className="keyboard-modes">
            <button
              aria-label={
                layout === "letters" ? "Show math symbols" : "Show letters"
              }
              aria-pressed={layout === "letters"}
              onClick={() =>
                setLayout(layout === "letters" ? "symbols" : "letters")
              }
            >
              {layout === "letters" ? "123" : "ABC"}
            </button>
            <button
              aria-pressed={layout === "functions"}
              onClick={() =>
                setLayout(layout === "functions" ? "symbols" : "functions")
              }
            >
              functions
            </button>
          </div>
          <div className="keyboard-arrows">
            <button
              aria-label="Move cursor left"
              onClick={() => onCommand("moveToPreviousChar")}
            >
              <ArrowLeft size={20} />
            </button>
            <button
              aria-label="Move cursor right"
              onClick={() => onCommand("moveToNextChar")}
            >
              <ArrowRight size={20} />
            </button>
          </div>
          <div className="keyboard-edit">
            <button
              aria-label="Hide keyboard"
              title="Hide keyboard"
              onClick={onClose}
            >
              <ChevronDown size={21} />
            </button>
            <button
              aria-label="Backspace"
              onClick={() => onCommand("deleteBackward")}
            >
              <Delete size={23} />
            </button>
          </div>
          <button
            className="keyboard-enter"
            aria-label="Enter: add expression"
            onClick={onEnter}
          >
            <CornerDownLeft size={23} />
          </button>
        </div>
      </div>
    </motion.section>
  );
}
