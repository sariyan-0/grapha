# Grapha

A browser-based graphing calculator built with Next.js and TypeScript. Enter an equation, move around the graph, and inspect points without leaving the workspace.

Grapha runs entirely in the browser. There are no accounts or backend services, and graphs are saved on the current device.

## Getting started

Use Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). To run a production build:

```sh
npm run build
npm start
```

The build uses webpack. Fonts and MathLive assets are served locally.

## Using the calculator

Use **+** to add an expression, note, point table, or parameter slider. Press **Enter** while editing an equation to add another expression. Grapha supports single-input functions with different variable names, including polynomials, rational functions, roots, logarithms, and trigonometry. Angles are in radians.

```text
y = sin(x)
y = x^2 / 4 - 2
y = 1 / (x - 2)
r = 5sin(6)
v = 2t + 3
f(u) = u^2
x = sin(y)
```

A dependent label such as `r` is plotted as a regular function, not automatically as a polar radius. The input is inferred when unambiguous; `f(t) = …` explicitly chooses `t`. Axis labels follow the selected expression. Values other than the input can use named sliders (up to 16). Named rows are self-contained and cannot be called from other rows.

- Drag the graph to pan. Scroll or pinch to zoom.
- The expression sidebar slides over the graph; opening and closing it keeps the graph size and viewport unchanged.
- Click an expression’s colored circle to show or hide its curve.
- Open its **⋯** menu to change the color, duplicate, delete, or analyze it.
- Drag an expression’s number to reorder the list.
- Open **Keypad** for an overlay math keyboard with numbers, operators, templates, functions, letters, and editing controls.
- Hover near a curve to trace its coordinates, then click to keep the point visible.
- Add a point table and enter numeric x/y pairs to plot individual points. Incomplete or invalid pairs are skipped.
- Choose **Slider** from the **+** menu to use `a`, `b`, or `c` in an expression such as `y = a sin(x)`.

The graph menu also contains saved graphs, import/export, settings, and help. Graph settings control the grid, axes, tracing, appearance, and viewport.

Curves fade in briefly as equations change. Enable **Reduce motion** in Settings for immediate updates and no interface transitions. This preference is saved locally; the system accessibility preference is respected as well.

### Saving and sharing

Edits are saved automatically in local storage. **Save graph** keeps a named copy in the browser’s graph collection. Export a JSON file to keep a portable copy, or a PNG to save the current view as an image.

**Share** creates a URL containing a snapshot of the graph. Later changes do not update that snapshot. Clearing browser data removes local graphs, so JSON exports are useful for work you want to keep.

| Shortcut         | Action            |
| ---------------- | ----------------- |
| Enter            | Add an expression |
| Ctrl / ⌘ S       | Save graph        |
| Ctrl / ⌘ Z       | Undo              |
| Ctrl / ⌘ Shift Z | Redo              |

## Development

The UI uses React, Tailwind CSS, Lucide icons, Motion, and Radix dialog primitives. MathLive handles mathematical input, math.js parses expressions, and Zustand holds the project state. Plotting uses a custom Canvas 2D renderer.

| File                             | Responsibility                                                     |
| -------------------------------- | ------------------------------------------------------------------ |
| `components/workspace.tsx`       | Workspace layout, project actions, and dialogs                     |
| `components/expression-list.tsx` | Equation rows, curve options, reordering, and sliders              |
| `components/add-menu.tsx`        | Add menu and keyboard navigation                                   |
| `components/workspace-items.tsx` | Notes and editable point tables                                    |
| `components/analysis-panel.tsx`  | Numerical results for the selected expression                      |
| `components/math-keyboard.tsx`   | Overlay keyboard layouts and editing keys                          |
| `components/math-editor.tsx`     | MathLive integration and notation conversion                       |
| `components/graph-canvas.tsx`    | Drawing, viewport changes, and pointer interactions                |
| `lib/math-notation.ts`           | Typeset startup previews and shared notation conversion            |
| `lib/expression-variables.ts`    | Dependent labels and input-variable selection                      |
| `lib/math.ts`                    | Parsing, evaluation, sampling, coordinate conversion, and analysis |
| `lib/workspace-items.ts`         | Item validation and table coordinate extraction                    |
| `lib/restore-session.ts`         | Startup restoration before mounting the workspace                  |
| `lib/store.ts`                   | Project schema, validation, history, and local persistence         |

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Tests cover expression evaluation, unsafe input, coordinate transforms, discontinuities, numerical analysis, parameter updates, MathLive notation, project validation, and startup restoration.

## Error recovery

Incomplete expressions show a short hint after a pause while typing. Invalid syntax, unsupported operations, and missing parameters have separate messages. Expressions that cannot be evaluated are not plotted.

Invalid imports leave the current graph intact. If the last saved session cannot be read, autosaving pauses and offers retry/export actions. Retrying preserves a recovery copy of unreadable local data before saving the new session. Broken share links fall back to the saved workspace. Editor, image export, clipboard, and storage failures provide recovery actions or an alternative.

## Current limits

Grapha plots explicit real-valued single-input functions, with arbitrary variable names and horizontal forms such as `x = f(y)`. Implicit equations, parametric and polar plots, inequalities, piecewise functions, domain restrictions, and SVG export are not supported.

Analysis is numerical. Roots, turning points, intersections, and slopes are approximations; there is no symbolic domain, range, or asymptote analysis. The renderer subdivides curves and checks denominator boundaries to avoid drawing across detected discontinuities. Finite sampling can still miss very narrow features, isolated roots, or rapid oscillations.
