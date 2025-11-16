
# Project Blueprint

## Overview

This project is an Angular application that helps users optimize their hero gear in a game. It uses modern Angular features like standalone components, signals, and the new control flow syntax.

## Implemented Features

*   **Hero Gear Optimizer:** Allows users to input their hero and gear information to find the optimal gear enhancement setup.
*   **Modern Angular Architecture:** Built with standalone components, signals for state management, and `ChangeDetectionStrategy.OnPush` for performance.

## Current Task: Add WASM-based Optimization

I am currently adding a Rust-based WASM module to handle the optimization logic, which is expected to provide better performance than the current TypeScript implementation.

### Plan

1.  **DONE** Create a `blueprint.md` file to document the project and the changes I'm making.
2.  Install `wasm-pack` so I can use it to build the wasm package.
3.  Create a `solver` directory and initialize the Rust project inside it.
4.  Update `Cargo.toml` to add `wasm-bindgen` and `serde` dependencies and configure the crate type.
5.  Create the initial Rust code with a placeholder function in `src/lib.rs`.
6.  Add a new `build:solver` npm script to `package.json` to build the wasm package.
7.  Update `.gitignore` to exclude the `solver/pkg` and `solver/target` directories.
8.  Update `blueprint.md` to document the new project structure and outline the plan for the next phase.
