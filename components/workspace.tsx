"use client";
import Link from "next/link.js";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  CircleAlert,
  Copy,
  Crosshair,
  Download,
  FolderOpen,
  Keyboard,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  Save,
  Settings2,
  Share2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import GraphCanvas from "./graph-canvas";
import MathKeyboard, { type KeyboardCommand } from "./math-keyboard";
import type { MathfieldElement } from "mathlive";
import ExpressionList from "./expression-list";
import AnalysisPanel from "./analysis-panel";
import AddMenu, { type AddItemType } from "./add-menu";
import { colors } from "@/lib/store";
import { Dialog } from "./ui/dialog";
import { restoreSession } from "@/lib/restore-session";
import { errorMessage } from "@/lib/app-errors";
import {
  parseProjectJson,
  shareSnapshot,
  writeCurrentProject,
  canvasPng,
  MAX_PROJECT_BYTES,
} from "@/lib/project-io";
import { compileExpression, type Finding } from "@/lib/math";
import {
  initial,
  readProjects,
  saveProject,
  removeSavedProject,
  useGraph,
  type Project,
} from "@/lib/store";
type Modal =
  "save" | "share" | "export" | "settings" | "library" | "help" | null;
const format = (n: number) => Number(n.toFixed(4)).toString();
export default function Workspace() {
  const systemReducedMotion = useReducedMotion();
  const [motionSetting, setMotionSetting] = useState(false);
  const reduceMotion = Boolean(systemReducedMotion || motionSetting);
  const { project, update, add, undo, redo, past, future, load, restore } =
    useGraph();
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [light, setLight] = useState(false);
  const [grid, setGrid] = useState(true);
  const [axes, setAxes] = useState(true);
  const [trace, setTrace] = useState(true);
  const [sidebar, setSidebar] = useState(true);
  const [tab, setTab] = useState("expressions");
  const [selected, setSelected] = useState("1");
  const [toast, setToast] = useState("");
  const [toastError, setToastError] = useState(false);
  const [storageIssue, setStorageIssue] = useState("");
  const [canAutosave, setCanAutosave] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const [saveName, setSaveName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [shareLink, setShareLink] = useState("");
  const [point, setPoint] = useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null);
  const [saved, setSaved] = useState(true);
  const [keyboard, setKeyboard] = useState(false);
  const graphMenu = useRef<HTMLDetailsElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const importSequence = useRef(0);
  const active =
    project.expressions.find((e) => e.id === selected) ??
    project.expressions[0];
  const activeVariables =
    active && compileExpression(active.text, project.parameters).variables;
  const graphX =
    activeVariables?.axis === "horizontal"
      ? activeVariables.output
      : (activeVariables?.input ?? "x");
  const graphY =
    activeVariables?.axis === "horizontal"
      ? activeVariables.input
      : (activeVariables?.output ?? "y");
  const pointExpression =
    point && project.expressions.find((e) => e.id === point.id);
  const pointFn =
    pointExpression &&
    compileExpression(pointExpression.text, project.parameters).fn;
  const pointSlope =
    point && pointFn && Math.abs(pointFn(point.x) - point.y) < 1e-6
      ? (pointFn(point.x + 1e-5) - pointFn(point.x - 1e-5)) / 2e-5
      : NaN;
  const notify = (text: string, isError = false) => {
    setToastError(isError);
    setToast(text);
  };
  function download(blob: Blob, name: string) {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      return true;
    } catch {
      notify(
        "The download couldn’t start. Try again in another browser tab.",
        true,
      );
      return false;
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    }
  }
  function retrySaving() {
    try {
      writeCurrentProject(project, localStorage);
      setStorageIssue("");
      setCanAutosave(true);
      setSaved(true);
      notify("Local saving is working.");
    } catch (error) {
      setStorageIssue(
        errorMessage(
          error,
          "Local saving is still unavailable. Export JSON to keep your work.",
        ),
      );
    }
  }

  useEffect(() => {
    const boot = setTimeout(() => {
      const session = restoreSession(window.location.hash, {
        getItem: (key) => localStorage.getItem(key),
      });
      restore(session.project);
      setSelected(session.project.expressions[0]?.id ?? "");
      setLight(session.light);
      setMotionSetting(session.reduceMotion);
      setCanAutosave(session.canAutosave);
      if (!session.canAutosave) {
        setStorageIssue(session.error);
        setSaved(false);
      } else if (session.error) {
        setToastError(true);
        setToast(session.error);
      }
      setSidebar(window.innerWidth > 760);
      setReady(true);
    }, 0);
    return () => clearTimeout(boot);
  }, [restore]);
  useEffect(() => {
    if (!ready || !canAutosave) return;
    const id = setTimeout(() => {
      try {
        writeCurrentProject(project, localStorage);
        setSaved(true);
        setStorageIssue("");
      } catch (error) {
        setSaved(false);
        setStorageIssue(
          errorMessage(
            error,
            "Local saving is unavailable. Export JSON to keep your work.",
          ),
        );
      }
    }, 500);
    return () => clearTimeout(id);
  }, [project, ready, canAutosave]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const editing = e
        .composedPath()
        .some(
          (t) =>
            t instanceof HTMLElement &&
            (t.tagName === "MATH-FIELD" ||
              t.tagName === "INPUT" ||
              t.tagName === "TEXTAREA"),
        );
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setSaveName(useGraph.getState().project.title);
        setModal("save");
      }
      if (!editing && (e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [undo, redo]);
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    return () => {
      delete document.documentElement.dataset.reduceMotion;
    };
  }, [reduceMotion]);
  function savePreferences(next: { light: boolean; reduceMotion: boolean }) {
    try {
      localStorage.setItem("grapha-preferences-v1", JSON.stringify(next));
    } catch {
      notify("Appearance settings could not be saved on this device.", true);
    }
  }
  const open = (m: Modal) => {
    if (graphMenu.current) graphMenu.current.open = false;
    if (m === "save") setSaveName(project.title);
    if (m === "library") {
      setLibraryError("");
      try {
        setProjects(readProjects());
      } catch (error) {
        setProjects([]);
        setLibraryError(
          errorMessage(
            error,
            "Saved graphs are unavailable because this browser is blocking local storage.",
          ),
        );
      }
    }
    if (m === "share") {
      try {
        const encoded = shareSnapshot(project);
        setShareLink(
          `${location.origin}${location.pathname}#graph=${encodeURIComponent(encoded)}`,
        );
      } catch (error) {
        notify(
          errorMessage(
            error,
            "The share link couldn’t be created. Export JSON to share your graph.",
          ),
          true,
        );
        setModal("export");
        return;
      }
    }
    setModal(m);
  };
  const inspect = (p: Finding) => {
    setPoint({ ...p, id: active?.id ?? "" });
    update({ viewport: { ...project.viewport, x: p.x, y: p.y } }, false);
  };
  function activeMathfield() {
    return document.querySelector<MathfieldElement>(
      ".expression-row.selected math-field",
    );
  }
  function insert(value: string) {
    const field = activeMathfield();
    if (!field) return;
    field.insert(value, { focus: true, selectionMode: "placeholder" });
  }
  function keyboardCommand(command: KeyboardCommand) {
    const field = activeMathfield();
    if (!field) return;
    field.focus();
    field.executeCommand(command);
  }
  function addExpression() {
    const id = add();
    if (id) setSelected(id);
    setTab("expressions");
    setSidebar(true);
  }
  function addItem(type: AddItemType) {
    setTab("expressions");
    setSidebar(true);
    if (type === "expression") {
      addExpression();
      return;
    }
    setKeyboard(false);
    if (type === "slider") {
      const name = ["a", "b", "c"].find(
        (key) => !(key in (project.parameters ?? {})),
      );
      if (name) update({ parameters: { ...project.parameters, [name]: 1 } });
      return;
    }
    if ((project.items?.length ?? 0) >= 50) return;
    const id = crypto.randomUUID();
    const item =
      type === "note"
        ? { id, type, text: "" }
        : {
            id,
            type,
            color:
              colors[
                ((project.items?.length ?? 0) + project.expressions.length) %
                  colors.length
              ],
            visible: true,
            rows: Array.from({ length: 3 }, () => ({
              id: crypto.randomUUID(),
              x: "",
              y: "",
            })),
          };
    update({ items: [...(project.items ?? []), item] });
    setSelected(id);
  }
  function toggleKeyboard() {
    if (!keyboard) {
      setSidebar(true);
      setTab("expressions");
      if (active) setSelected(active.id);
      else addExpression();
    }
    setKeyboard(!keyboard);
  }
  // Don't mount demo rows or editors until browser persistence has been restored.
  if (!ready)
    return (
      <div
        className="workspace workspace-loading"
        role="status"
        aria-label="Opening graph"
      >
        <span>Opening graph…</span>
      </div>
    );
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      <div className={`workspace ${light ? "light" : ""}`}>
        <header className="topbar">
          <Link className="brand" href="/" aria-label="Grapha home">
            <span className="brand-mark">
              <Activity size={24} strokeWidth={2.5} />
            </span>
            <span>
              grapha<span className="brand-period">.</span>
            </span>
          </Link>
          <div className="project-title">
            <input
              aria-label="Graph title"
              value={project.title}
              maxLength={120}
              onChange={(e) => update({ title: e.target.value })}
            />
            {!saved && (
              <span
                className="unsaved-indicator"
                title="Changes have not been saved locally"
                aria-label="Changes not saved locally"
              />
            )}
          </div>
          <div className="top-actions">
            <div className="history">
              <button
                className="icon-button"
                title="Undo"
                aria-label="Undo"
                disabled={!past.length}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                title="Redo"
                aria-label="Redo"
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
            </div>
            <button className="share-button" onClick={() => open("share")}>
              <Share2 size={14} />
              <span>Share</span>
            </button>
            <details className="graph-menu" ref={graphMenu}>
              <summary aria-label="Graph menu" title="Graph menu">
                <MoreHorizontal size={20} />
              </summary>
              <div className="graph-menu-content">
                <button onClick={() => open("save")}>
                  <Save size={16} />
                  Save graph<kbd>⌘ S</kbd>
                </button>
                <button onClick={() => open("library")}>
                  <FolderOpen size={16} />
                  Open saved graph
                </button>
                <button onClick={() => open("export")}>
                  <ArrowDownToLine size={16} />
                  Import / export
                </button>
                <hr />
                {Object.keys(project.parameters ?? {}).length < 16 &&
                  ["a", "b", "c"].some(
                    (name) => !(name in (project.parameters ?? {})),
                  ) && (
                    <button
                      onClick={() => {
                        const name = ["a", "b", "c"].find(
                          (key) => !(key in (project.parameters ?? {})),
                        )!;
                        update({
                          parameters: { ...project.parameters, [name]: 1 },
                        });
                        setSidebar(true);
                        setTab("expressions");
                        if (graphMenu.current) graphMenu.current.open = false;
                      }}
                    >
                      <Plus size={16} />
                      Add slider
                    </button>
                  )}
                <button onClick={() => open("settings")}>
                  <Settings2 size={16} />
                  Settings
                </button>
                <button onClick={() => open("help")}>
                  <CircleHelp size={16} />
                  Help & shortcuts
                </button>
              </div>
            </details>
          </div>
        </header>
        <div className="main-workspace">
          <AnimatePresence initial={false}>
            {sidebar && (
              <motion.aside
                className="sidebar"
                initial={{ opacity: 0, x: reduceMotion ? 0 : "-100%" }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduceMotion ? 0 : "-100%" }}
                transition={{
                  duration: reduceMotion ? 0 : 0.2,
                  ease: "easeOut",
                }}
              >
                <div className="expression-toolbar">
                  {tab === "analysis" ? (
                    <button
                      className="back-to-expressions"
                      onClick={() => setTab("expressions")}
                    >
                      <ArrowLeft size={16} />
                      Expressions
                    </button>
                  ) : (
                    <>
                      <AddMenu
                        onAdd={addItem}
                        canAddExpression={project.expressions.length < 50}
                        canAddSlider={
                          Object.keys(project.parameters ?? {}).length < 16 &&
                          ["a", "b", "c"].some(
                            (name) => !(name in (project.parameters ?? {})),
                          )
                        }
                        canAddItem={(project.items?.length ?? 0) < 50}
                      />
                      <span>Expressions</span>
                    </>
                  )}
                  <button
                    className="icon-button collapse-button"
                    aria-label="Collapse expressions"
                    title="Collapse expressions"
                    onClick={() => {
                      setSidebar(false);
                      setKeyboard(false);
                    }}
                  >
                    <PanelLeftClose size={17} />
                  </button>
                </div>
                {tab === "expressions" ? (
                  <>
                    <ExpressionList
                      selected={selected}
                      onSelect={setSelected}
                      onAnalyze={(id) => {
                        setSelected(id);
                        setTab("analysis");
                        setKeyboard(false);
                      }}
                      reduceMotion={reduceMotion}
                      onEdit={() => setSaved(false)}
                      onTouchFocus={() => setKeyboard(true)}
                    />
                    <div className="expression-footer">
                      <button
                        className="keyboard-button"
                        aria-pressed={keyboard}
                        onClick={toggleKeyboard}
                      >
                        <Keyboard size={18} />
                        <span>Keypad</span>
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Help"
                        title="Help"
                        onClick={() => open("help")}
                      >
                        <CircleHelp size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <AnalysisPanel
                    selected={selected}
                    onSelect={setSelected}
                    onInspect={inspect}
                  />
                )}
              </motion.aside>
            )}
          </AnimatePresence>
          <main className="canvas-workspace">
            <div className="canvas-tools">
              {!sidebar && (
                <button
                  className="floating-button open-expressions"
                  aria-label="Open expressions"
                  title="Open expressions"
                  onClick={() => setSidebar(true)}
                >
                  <PanelLeftOpen size={19} />
                </button>
              )}
              <button
                className="floating-button canvas-settings"
                aria-label="Graph settings"
                title="Graph settings"
                onClick={() => open("settings")}
              >
                <Settings2 size={19} />
              </button>
            </div>
            <GraphCanvas
              grid={grid}
              axes={axes}
              light={light}
              trace={trace}
              reduceMotion={reduceMotion}
              xLabel={graphX}
              yLabel={graphY}
              onInspect={(x, y, id) => {
                setSelected(id);
                setPoint({ x, y, id });
              }}
            />
            {point && (
              <div className="point-inspector">
                <Crosshair size={16} />
                <div>
                  <small>Inspected point</small>
                  <code>
                    ({format(point.x)}, {format(point.y)})
                  </code>
                  {Number.isFinite(pointSlope) && (
                    <small>Slope ≈ {format(pointSlope)}</small>
                  )}
                </div>
                <button
                  aria-label="Dismiss point"
                  onClick={() => setPoint(null)}
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </main>
        </div>
        <AnimatePresence>
          {keyboard && (
            <MathKeyboard
              key="math-keyboard"
              reduceMotion={reduceMotion}
              onInsert={insert}
              onCommand={keyboardCommand}
              onEnter={addExpression}
              onClose={() => setKeyboard(false)}
            />
          )}
        </AnimatePresence>
        <Dialog
          open={modal !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setModal(null);
          }}
          title={
            {
              save: "Save graph",
              share: "Share graph",
              export: "Import & export",
              settings: "Graph settings",
              library: "Your saved graphs",
              help: "Help",
            }[modal ?? "help"]
          }
          description={
            {
              save: "Keep a named copy in this browser.",
              share: "Anyone with this link can open a copy of your graph.",
              export: "Export an image or a portable, editable project.",
              settings: "Fine-tune your graph workspace.",
              library: "Stored locally on this device.",
              help: "A few tools for exploring mathematics.",
            }[modal ?? "help"]
          }
        >
          {modal === "save" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!saveName.trim()) return;
                const p = { ...project, title: saveName.trim() };
                try {
                  saveProject(p);
                  update({ title: p.title });
                  setModal(null);
                  notify("Graph saved to your collection.");
                } catch (error) {
                  notify(
                    errorMessage(
                      error,
                      "Could not save locally. Export your graph as JSON.",
                    ),
                    true,
                  );
                }
              }}
            >
              <label className="form-label">
                Graph name
                <input
                  autoFocus
                  value={saveName}
                  maxLength={120}
                  onChange={(e) => setSaveName(e.target.value)}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                <Bookmark size={16} />
                Save graph
              </button>
            </form>
          )}
          {modal === "share" && (
            <>
              <div className="share-preview">
                <Activity size={23} />
                <div>
                  <strong>{project.title}</strong>
                  <p>
                    {project.expressions.length} expressions · ready to explore
                  </p>
                </div>
              </div>
              <label className="form-label">
                Graph link
                <input
                  value={shareLink}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="primary-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    notify("Graph link copied.");
                  } catch {
                    notify(
                      "Couldn’t access the clipboard. Select and copy the link above.",
                      true,
                    );
                  }
                }}
              >
                <Copy size={16} />
                Copy link
              </button>
              <p className="modal-note">
                The link contains a snapshot. Your future edits stay in your
                workspace.
              </p>
            </>
          )}
          {modal === "export" && (
            <div className="export-options">
              <button
                onClick={async () => {
                  try {
                    const blob = await canvasPng(
                      document.querySelector<HTMLCanvasElement>(
                        "#graph-canvas",
                      ),
                    );
                    if (download(blob, `${project.title}.png`))
                      notify("Graph image exported.");
                  } catch (error) {
                    notify(
                      errorMessage(
                        error,
                        "The image couldn’t be exported. Try again, or export JSON.",
                      ),
                      true,
                    );
                  }
                }}
              >
                <span className="export-file">PNG</span>
                <span>
                  <strong>Graph image</strong>
                  <small>High-resolution image of your current view</small>
                </span>
                <Download size={18} />
              </button>
              <button
                onClick={() =>
                  download(
                    new Blob([JSON.stringify(project, null, 2)], {
                      type: "application/json",
                    }),
                    `${project.title}.grapha.json`,
                  )
                }
              >
                <span className="export-file">JSON</span>
                <span>
                  <strong>Grapha project</strong>
                  <small>All expressions, colors, and viewport settings</small>
                </span>
                <Download size={18} />
              </button>
              <button onClick={() => file.current?.click()}>
                <span className="export-file">
                  <ArrowUpFromLine size={20} />
                </span>
                <span>
                  <strong>Import a project</strong>
                  <small>Continue exploring a Grapha JSON file</small>
                </span>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          {modal === "settings" && (
            <>
              <div className="setting-row">
                <span>
                  <strong>Light appearance</strong>
                  <small>Use a white graph and workspace</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Light appearance"
                  checked={light}
                  onChange={(e) => {
                    setLight(e.target.checked);
                    savePreferences({
                      light: e.target.checked,
                      reduceMotion: motionSetting,
                    });
                  }}
                />
              </div>
              <div className="setting-row">
                <span>
                  <strong>Reduce motion</strong>
                  <small>
                    {systemReducedMotion
                      ? "Enabled by your device’s accessibility settings."
                      : "Show updates immediately and disable interface animations."}
                  </small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Reduce motion"
                  checked={reduceMotion}
                  disabled={Boolean(systemReducedMotion)}
                  onChange={(e) => {
                    setMotionSetting(e.target.checked);
                    savePreferences({ light, reduceMotion: e.target.checked });
                  }}
                />
              </div>
              <div className="setting-row">
                <span>
                  <strong>Grid lines</strong>
                  <small>A little structure for your thinking</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={grid}
                  onChange={(e) => setGrid(e.target.checked)}
                />
              </div>
              <div className="setting-row">
                <span>
                  <strong>Coordinate axes</strong>
                  <small>Show axes, labels, and tick marks</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={axes}
                  onChange={(e) => setAxes(e.target.checked)}
                />
              </div>
              <div className="setting-row">
                <span>
                  <strong>Curve tracing</strong>
                  <small>Inspect coordinates as you hover</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={trace}
                  onChange={(e) => setTrace(e.target.checked)}
                />
              </div>
              <div className="viewport-fields">
                {(["x", "y", "scale"] as const).map((key) => (
                  <label key={key}>
                    {key === "scale"
                      ? "Pixels / unit"
                      : `${key.toUpperCase()} center`}
                    <input
                      type="number"
                      value={Number(project.viewport[key].toFixed(3))}
                      min={key === "scale" ? 2 : undefined}
                      max={key === "scale" ? 2000 : undefined}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (
                          Number.isFinite(value) &&
                          Math.abs(value) <= 1e9 &&
                          (key !== "scale" || (value >= 2 && value <= 2000))
                        )
                          update(
                            { viewport: { ...project.viewport, [key]: value } },
                            false,
                          );
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="modal-note">
                Angles use radians. Use one input variable per graph, such as r
                = sin(t).
              </p>
            </>
          )}
          {modal === "library" && (
            <div className="library">
              {libraryError ? (
                <p className="operation-error" role="alert">
                  {libraryError}
                </p>
              ) : projects.length ? (
                projects.map((p, i) => (
                  <div className="library-row" key={`${p.title}-${i}`}>
                    <button
                      onClick={() => {
                        load(p);
                        setModal(null);
                        notify("Graph opened.");
                      }}
                    >
                      <span className="library-icon">
                        <Activity size={20} />
                      </span>
                      <span>
                        <strong>{p.title}</strong>
                        <small>{p.expressions.length} expressions</small>
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete saved graph ${p.title}`}
                      onClick={() => {
                        try {
                          setProjects(removeSavedProject(p.title));
                        } catch {
                          notify(
                            "Could not update local storage. Your saved collection has not been replaced.",
                            true,
                          );
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <FolderOpen size={30} />
                  <p>No saved graphs yet.</p>
                  <small>Use Save to keep a named graph.</small>
                </div>
              )}
              <button
                className="secondary-button"
                onClick={() => {
                  load({
                    ...initial,
                    title: "Untitled graph",
                    expressions: [],
                  });
                  setModal(null);
                }}
              >
                {" "}
                <Plus size={16} />
                New blank graph
              </button>
            </div>
          )}
          {modal === "help" && (
            <div className="help-content">
              <p>
                Enter a function using your own variable names, such as r =
                sin(t) or f(u) = u². With one undefined variable, Grapha uses it
                as the input; a named function makes the choice explicit.
              </p>
              <div className="help-examples">
                <code>y = sin(x)</code>
                <code>y = x² − 4</code>
                <code>y = 1 / (x − 2)</code>
              </div>
              <p>
                Scroll to zoom, drag to pan, or pinch with two fingers. Hover
                near a curve to trace it, then click to keep its coordinates.
              </p>
              <p>
                Use sliders for other values, such as a in y = a sin(t).
                Undefined parameters offer an Add slider action. Shared
                parameter values come from sliders; naming a graph does not
                define it for use in other rows.
              </p>
              <p>
                Use an expression’s <MoreHorizontal size={14} /> menu to change
                its color, duplicate it, or remove it. Drag its number to
                reorder.
              </p>
              <p>
                Implicit equations, polar and parametric plots, inequalities,
                and piecewise functions are not supported in this version.
              </p>
              <div className="shortcut-row">
                <span>Save graph</span>
                <kbd>⌘ / Ctrl S</kbd>
              </div>
              <div className="shortcut-row">
                <span>Undo / redo</span>
                <kbd>⌘ / Ctrl ⇧ Z</kbd>
              </div>
            </div>
          )}
        </Dialog>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const input = e.currentTarget,
              f = input.files?.[0];
            if (!f) return;
            const sequence = ++importSequence.current;
            try {
              if (f.size > MAX_PROJECT_BYTES) {
                notify("Choose a Grapha JSON file smaller than 5 MB.", true);
                return;
              }
              const text = await f.text();
              if (sequence !== importSequence.current) return;
              const imported = parseProjectJson(text);
              load(imported);
              setSelected(imported.expressions[0]?.id ?? "");
              setModal(null);
              notify("Graph imported.");
            } catch (error) {
              if (sequence === importSequence.current)
                notify(
                  errorMessage(
                    error,
                    "This file couldn’t be opened. Choose a Grapha JSON export.",
                  ),
                  true,
                );
            } finally {
              if (sequence === importSequence.current) input.value = "";
            }
          }}
        />
        {storageIssue && (
          <div className="storage-notice" role="alert">
            <CircleAlert size={16} />
            <div>
              <strong>Local saving needs attention</strong>
              <p>{storageIssue}</p>
              <button onClick={retrySaving}>Retry saving</button>
              <button onClick={() => open("export")}>Export JSON</button>
            </div>
          </div>
        )}
        <AnimatePresence>
          {toast && (
            <motion.div
              className={`toast ${toastError ? "toast-error" : ""}`}
              role={toastError ? "alert" : "status"}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
            >
              {toastError ? <CircleAlert size={16} /> : <Check size={16} />}
              {toast}
              <button
                aria-label="Dismiss notification"
                onClick={() => setToast("")}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
