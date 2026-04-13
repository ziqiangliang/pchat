# PChat - Visual AI Chat Assistant

A **graphical ChatGPT** that explains concepts while drawing dynamic visualizations on a virtual canvas. Ask any question and get an answer with real-time graphics, animations, and step-by-step demonstrations.

## Demo

https://github.com/ziqiangliang/pchat/assets/zh-demo.mp4

## Features

- **Universal Domain Support** - Ask questions from any field (math, physics, history, programming, etc.)
- **Visual Explanations** - AI draws diagrams, charts, flowcharts, and geometric shapes while explaining
- **Dynamic Animations** - Smooth fade, move, scale, and draw animations for visual feedback
- **Smart Layout Engine** - Multiple layout algorithms (geometric, flow, network, data visualization)
- **Annotation System** - Automatic labeling and annotation of nodes, edges, and angles
- **Multi-turn Conversations** - Continue asking follow-up questions with canvas state preservation
- **Playback Controls** - Step-by-step playback with play, pause, forward, and backward controls

## Architecture

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
│                   OpenAI API (GPT-4o)                   │
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

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type Safety |
| Zustand | 4.x | State Management |
| Vite | 5.x | Build Tool |

## Layout Engine

The `LayoutSolver` supports multiple layout types:

- **Geometry Layout** - Squares, triangles, circles, polygons, rectangles
- **Flow Layout** - Hierarchical flowcharts with level-based spacing
- **Network Layout** - Radial network diagrams with root node offset
- **Data Layout** - Bar charts for data visualization

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API Key

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file based on `.env.example`:

```env
VITE_OPENAI_API_KEY=your_api_key_here
VITE_OPENAI_API_ENDPOINT=https://api.openai.com/v1/chat/completions
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/           # React components
│   ├── GraphCanvas.tsx          # SVG canvas renderer
│   ├── SmartChatInterface.tsx  # AI chat interface
│   └── PlaybackControls.tsx    # Animation playback controls
├── engines/              # Core engines
│   ├── SmartChatEngine.ts      # AI conversation engine
│   ├── layoutSolver.ts         # Layout algorithms
│   ├── renderEngine.ts         # Rendering logic
│   └── annotationEngine.ts    # Annotation positioning
├── stores/               # State management
│   ├── blackboardState.ts      # Canvas state (areas, elements)
│   └── smartChatStore.ts        # Chat session state
├── hooks/                # Custom React hooks
├── config/               # Configuration constants
├── types/                # TypeScript definitions
└── utils/                # Utility functions
```

## Key Concepts

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

## License

Private project.
