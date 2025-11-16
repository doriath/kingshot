import { Injectable, signal } from '@angular/core';

// Import the initializer and the function you want to use
import init, { solve } from 'solver';

@Injectable({
  providedIn: 'root'
})
export class SolverService {
  private solverLoaded = signal(false);

  constructor() {
    // Initialize the wasm module, telling it where to find the wasm file
    init()
      .then(() => {
        this.solverLoaded.set(true);
        console.log('Solver loaded!');
      })
      .catch(console.error);
  }

  isSolverLoaded() {
    return this.solverLoaded();
  }

  solve(data: any): any {
    if (!this.isSolverLoaded()) {
      throw new Error('Solver not yet loaded.');
    }
    // The 'solve' function is now directly available
    return JSON.parse(solve(JSON.stringify(data)));
  }
}
