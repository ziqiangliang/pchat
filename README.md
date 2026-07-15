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
│   ├── ChatInterface.tsx          # Main chat interface
│   ├── DraggablePlaybackControls.tsx # Draggable playback controls
│   ├── GraphCanvas.tsx             # SVG canvas renderer
│   ├── PlaybackControls.tsx       # Animation playback controls
│   └── SmartChatInterface.tsx     # AI chat interface
├── config/               # Configuration constants
│   ├── config.ts                    # App configuration
│   ├── prompts.ts                   # AI prompts
│   └── index.ts
├── engines/              # Core engines
│   ├── SmartChatEngine.ts           # AI conversation engine
│   ├── annotationEngine.ts          # Annotation positioning
│   ├── layoutOptimizer.ts           # Layout optimization
│   ├── layoutSolver.ts              # Layout algorithms
│   ├── renderEngine.ts              # Rendering logic
│   └── stepPlayer.ts                # Animation step player
├── hooks/                # Custom React hooks
│   ├── useCanvasGesture.ts          # Canvas gesture handling
│   ├── useGraphControls.ts          # Graph control hooks
│   └── useSmartChat.ts              # Smart chat hooks
├── i18n/                 # Internationalization
│   ├── locales/
│   │   ├── en.json                  # English translations
│   │   └── zh.json                  # Chinese translations
│   └── index.ts
├── services/             # External services
│   └── ttsService.ts                 # Text-to-speech service
├── stores/               # State management (Zustand)
│   ├── blackboardState.ts            # Canvas state
│   ├── smartChatStore.ts              # Chat session state
│   └── store.ts
├── types/                # TypeScript type definitions
│   └── index.ts
├── utils/                # Utility functions
│   ├── instructionTransformer.ts     # Instruction transformation
│   └── jsonParser.ts                 # JSON parsing utilities
├── App.tsx               # Root component
├── index.css             # Global styles
└── main.tsx              # Entry point
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
