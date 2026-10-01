# Vendly Frontend Guide

## Project Context

Vendly is a multi-vendor marketplace that helps sellers present listings and shoppers discover shops and products.

## Stack And Architecture

- The frontend uses React, TypeScript, Vite, and React Router.
- Preserve the existing frontend architecture and local patterns unless a clear task requirement justifies changing them.
- Prefer simple, maintainable, professional solutions over unnecessary abstraction or complexity.
- Reuse existing components, utilities, and patterns when appropriate; do not introduce duplicate implementations.
- Use clear, descriptive names for components, functions, variables, and routes.

## Routing And UI

- Follow the existing routing structure and conventions, with routes defined centrally in `src/App.tsx`.
- Preserve responsive behavior and established UI patterns unless the task specifically calls for a change.
- Where relevant, handle loading, error, empty, and success states deliberately.

## API And Security

- Keep API communication consistent with the existing backend API and environment-variable configuration.
- Never hard-code API URLs, secrets, credentials, tokens, or other environment-specific values.
- Treat authentication and authorization state carefully: frontend checks are not sufficient security controls.
- Do not expose sensitive information unnecessarily in code, logs, UI, or documentation.

## Working Practices

- Keep changes focused on the requested work; avoid unrelated refactors or cleanup.
- For ambiguous tasks, inspect the existing code and ask for clarification rather than guessing.
- For educational tasks, explain the intended approach before making substantial changes.
- When suggesting commit messages, use Conventional Commits.
