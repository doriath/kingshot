import { Matrix } from 'mathjs';

/**
 * Interface for the data object required by the SCS solver.
 * Uses math.js Matrix for simplified matrix operations.
 */
export interface ScsData {
  A: Matrix;
  b: Matrix;
  c: Matrix;
}

/**
 * Interface for the cone object required by the SCS solver.
 */
export interface ScsCone {
  q: number[];
}

/**
 * Interface for the result object returned by the SCS solver.
 */
export interface ScsResult {
  x: number[];
  y: number[];
  s: number[];
}
