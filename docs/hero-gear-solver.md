# Hero Gear Optimization Solver

## Overview
The Hero Gear Optimization Solver is a high-performance tool designed to calculate the optimal enhancement levels for hero gear in Kingshot. It helps players maximize their combat effectiveness (Score) by distributing a limited amount of Experience (EXP) points across multiple heroes and their gear pieces.

## Problem Statement
Players manage multiple heroes (e.g., Infantry, Cavalry, Archers), each equipped with 4 pieces of gear (Helmet, Gloves, Breastplate, Boots).
- **Goal**: Maximize the total weighted score of all heroes.
- **Constraints**: Total EXP used for enhancements must not exceed the player's available EXP.
- **Complexity**: Enhancement costs increase non-linearly, making this a combinatorial optimization problem.

## Features
- **Multi-Hero Optimization**: Optimizes gear for multiple heroes simultaneously to find the best global distribution of resources.
- **Customizable Weights**: Players can define stat priorities (Lethality vs Health) for each hero.
- **High Performance**: Powered by a Rust-based solver compiled to WebAssembly (Wasm) for near-instant calculations.
- **Smart Suggestions**: Recommends exact enhancement levels for each gear piece.

## Technical Details
### Core Logic (`solver/`)
- **Language**: Rust
- **Algorithm**: Dynamic Programming with Memoization.
- **Input**: JSON string containing heroes, gear mastery, weights, and total EXP.
- **Output**: JSON string with optimal enhancement levels and projected stats.

### Frontend Integration (`src/app/hero-gear/`)
- **Framework**: Angular (Standalone Components).
- **Service**: `SolverService` handles Wasm instantiation and communication.
- **State**: Angular Signals manage local state for reactive updates.
