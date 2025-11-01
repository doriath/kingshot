import { Injectable } from '@angular/core';

/**
 * Interface for the data object required by the SCS solver.
 */
export interface ScsData {
  A: number[][];
  b: number[];
  c: number[];
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

@Injectable({
  providedIn: 'root'
})
export class Scs {

  /**
   * Solves a Second-Order Cone Program using the scs-solver library.
   * @param data The data for the SOCP problem.
   * @param cone The cone for the SOCP problem.
   * @returns A promise that resolves with the solution of the problem.
   */
  async solve(data: ScsData, cone: ScsCone) {
    let scs = await createSCS(); 
    const settings = new scs.ScsSettings();
    scs.setDefaultSettings(settings);
    scs.solve(data, cone, settings);
  }
}
