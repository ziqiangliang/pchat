# PChat - Visual AI Chat Assistant

A **graphical ChatGPT** that explains concepts while drawing dynamic visualizations on a virtual canvas. Ask any question and get an answer with real-time graphics, animations, and step-by-step demonstrations.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff)](https://vitejs.dev/)

[English](./README.md) | [中文](./README_zh.md)

## ✨ Features

- **Universal Domain Support** - Ask questions from any field (math, physics, history, programming, etc.)
- **Visual Explanations** - AI draws diagrams, charts, flowcharts, and geometric shapes while explaining
- **Dynamic Animations** - Smooth fade, move, scale, and draw animations for visual feedback
- **Smart Layout Engine** - Multiple layout algorithms (geometric, flow, network, data visualization)
- **Annotation System** - Automatic labeling and annotation of nodes, edges, and angles
- **Multi-turn Conversations** - Continue asking follow-up questions with canvas state preservation
- **Playback Controls** - Step-by-step playback with play, pause, forward, and backward controls

## 🎬 Demo

[![Demo Video](https://img.shields.io/badge/Demo-Bilibili-red?style=flat-square)](https://www.bilibili.com/video/BV1ofQtBTEfx/)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- OpenAI-compatible LLM API key

### Installation

```bash
git clone https://github.com/pchat/pchat.git
cd pchat
npm install
```

### Configuration

Create a `.env` file based on `.env.example`:

```env
VITE_LLM_API_KEY=your_api_key_here
VITE_LLM_BASE_URL=https://api.example.com/v1
VITE_LLM_MODEL=your-model-name
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interaction                     │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Blackboard State Manager                    │
│         (Area-based canvas state tracking)              │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Instruction Transformer                     │
│           (Prompt engineering for LLM)                  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   OpenAI API (GPT-4o)                    │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    DSL Parser                           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Layout Solver Engine                        │
│    (Geometry / Flow / Network / Data layouts)           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  Render Engine                          │
│              (SVG-based canvas rendering)               │
└─────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
src/
├── components/           # React components
├── config/               # App + prompt / promptTune config
├── engines/              # Layout, render, step player
├── evaluator/            # DSL scoring, batch pipeline, prompt tune
├── hooks/
├── i18n/
├── services/
├── stores/
├── types/
├── utils/                # DSL post-process, label metrics, parsers
├── App.tsx
└── main.tsx
evaluator/
├── benchmarkCases.ts     # Benchmark questions
├── fixtures/             # Sample DSL fixtures
└── results/              # Eval outputs (gitignored)
scripts/
├── eval-dsl.ts           # Score one DSL file
├── eval-batch.ts         # Batch benchmark
└── eval-tune.ts          # Prompt auto-tune loop
```

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type Safety |
| Zustand | 4.x | State Management |
| Vite | 5.x | Build Tool |
| i18next | 26.x | Internationalization |

## 🔧 Layout Engine

The `LayoutSolver` supports multiple layout types:

- **Geometry Layout** - Squares, triangles, circles, polygons, rectangles
- **Flow Layout** - Hierarchical flowcharts with level-based spacing
- **Network Layout** - Radial network diagrams with root node offset
- **Data Layout** - Bar charts for data visualization

## 🧪 DSL Evaluator

Offline tooling to score LLM-generated visualization DSL (parse / schema / semantic / layout / pedagogy), batch-run benchmark questions, and iteratively tune the system prompt.

### Layout checks

Beyond node placement, the evaluator also detects:

- **Node label overlap** (`LABEL_OVERLAP`)
- **Edge label overlap** (`EDGE_LABEL_OVERLAP`) — edge labels are drawn at the midpoint in `GraphCanvas`
- **Edge ↔ node label overlap** (`EDGE_NODE_LABEL_OVERLAP`)

### Commands

Requires a configured `.env` (same LLM settings as the app).

```bash
# Score a single DSL file (or --stdin)
npm run eval:dsl -- path/to/dsl.json
npm run eval:dsl -- path/to/dsl.json --json

# Full benchmark (13 cases) → writes under evaluator/results/
npm run eval:batch
npm run eval:batch -- --quick          # subset of cases
npm run eval:batch -- --open           # open-ended cases only
npm run eval:batch -- tcp              # single case by id
npm run eval:batch -- --no-retry

# Auto-tune prompt params from eval issues (default up to 5 iterations)
npm run eval:tune
TUNE_MAX_ITERATIONS=3 npm run eval:tune
npm run eval:tune -- --quick
```

### Layout

| Path | Role |
|------|------|
| `src/evaluator/` | Core scoring, pipeline, metrics, prompt tune analyzer |
| `src/config/promptTune.ts` | Tunable prompt / post-process defaults |
| `evaluator/benchmarkCases.ts` | Benchmark questions |
| `evaluator/fixtures/` | Static sample DSL for local checks |
| `evaluator/results/` | Run outputs (`batch-*`, `tune-*`); **gitignored** |
| `scripts/eval-*.ts` | CLI entrypoints |

Each batch/tune run creates a directory like `evaluator/results/batch-<promptHash>-<timestamp>/` with `report.json` and `raw/*.txt` + `raw/*.processed.json`.

## 📖 Key Concepts

### Blackboard State

The canvas is divided into 8 logical areas to help the AI distribute elements intelligently:

- Top-left, Top-right
- Middle-left, Middle-center, Middle-right
- Bottom-left, Bottom-center, Bottom-right

### DSL (Domain Specific Language)

The AI generates a custom DSL format that describes:

- Nodes (shapes, labels, positions)
- Edges (connections between nodes)
- Steps (sequential drawing instructions)
- Annotations (labels and markers)

### Animation System

Supports multiple animation types:

- `fade` - Opacity transitions
- `move` - Position changes
- `scale` - Size transformations
- `draw` - Line drawing effects

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for the Chat Completions API format
- All contributors and users of this project
