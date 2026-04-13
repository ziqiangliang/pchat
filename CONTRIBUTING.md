# Contributing to PChat

Thank you for your interest in contributing to PChat! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to maintain a welcoming and respectful environment for all contributors and users.

## How Can I Contribute?

### Reporting Bugs

Before submitting a bug report:
- Check the [existing issues](https://github.com/pchat/pchat/issues) to avoid duplicates
- Verify the bug occurs with the latest version
- Include as much relevant information as possible:
  - Your operating system and version
  - Node.js/npm versions
  - Steps to reproduce the bug
  - Expected vs actual behavior
  - Error messages and stack traces

### Suggesting Features

We welcome feature suggestions! Please:
- Check existing issues and discussions first
- Clearly describe the feature and its benefits
- Provide use case examples where possible

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding conventions** used in the project
3. **Write meaningful commit messages**
4. **Ensure all tests pass** (if applicable)
5. **Update documentation** as needed
6. **Submit a clear PR description** explaining your changes

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Getting Started

```bash
# Clone your fork
git clone https://github.com/your-username/pchat.git
cd pchat

# Add upstream remote
git remote add upstream https://github.com/pchat/pchat.git

# Install dependencies
npm install

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and commit
git commit -m "Add: description of your feature"

# Sync with upstream
git fetch upstream
git rebase upstream/main

# Push to your fork
git push origin feature/your-feature-name

# Open a Pull Request
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## Coding Conventions

### TypeScript

- Use strict TypeScript typing
- Avoid `any` type when possible
- Export types and interfaces from `src/types/index.ts`

### React Components

- Use functional components with hooks
- Follow existing component patterns in `src/components/`
- Co-locate styles when possible

### State Management

- Use Zustand for global state
- Keep state as local as possible
- Document state structure in store files

### Git Commit Messages

- Use clear, descriptive commit messages
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Keep the first line under 72 characters
- Reference issues when applicable

Format:
```
<type>: <short description>

<longer description if needed>
```

Types: `Add`, `Fix`, `Update`, `Remove`, `Refactor`, `Docs`, `Style`, `Test`, `Chore`

## Project Structure

```
src/
├── components/     # React UI components
├── config/          # Configuration and prompts
├── engines/         # Core business logic engines
├── hooks/           # Custom React hooks
├── i18n/            # Internationalization
├── services/        # External service integrations
├── stores/          # Zustand state stores
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## License

By contributing to PChat, you agree that your contributions will be licensed under the MIT License.
