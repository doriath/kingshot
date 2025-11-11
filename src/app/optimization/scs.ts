import { Injectable } from '@angular/core';
import { ScsData, ScsCone, ScsResult } from './scs.model';
import { create, all, matrix, format } from 'mathjs';

// Re-export the models for other modules to use
export * from './scs.model';

// Create a mathjs instance
const math = create(all);

export interface MarchConfig {
  name: string,
  max_troops: number,
  // How many of those marches we want to use in parallel
  parallel: number,
  // How many times this march will cause dmg
  used: number,
  // we assume 1 is average dmg
  dmg: number,
}

export interface ScsConfig {
  infCount: number,
  cavCount: number,
  arcCount: number,
  infDmg: number,
  cavDmg: number,
  arcDmg: number,
}

export interface MarchResult {
  // inf/cav/arc
  troops: number[],
  max_troops: number,
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
  async solve(config: ScsConfig, marches: MarchConfig[]): Promise<MarchResult[]> {
    //console.log(config);
    //console.log(marches);
    const scs = await createSCS();

    let inf_dmg = config.infDmg;
    let cav_dmg = config.cavDmg;
    let arc_dmg = config.arcDmg;

    let troop_types = 3;
    // 3 - sum of troos in each march <= total
    // marches.length - inf+cav+arc <= max_troops
    // marches.length - inf < 3% (inf + cav + arc)
    // marches.length * 3 - troop >= 0
    let linear = 3 + 2 * marches.length + marches.length * troop_types;
    let quadratic = 3 * marches.length * troop_types;
    let num_rows = linear + quadratic;
    let num_cols = 2 * marches.length * troop_types;

    let a = matrix([], 'sparse');
    a.resize([num_rows, num_cols], 0);

    // create array of size linear filled with 0
    let b = new Array(num_rows).fill(0);
    // What we are optimizing
    // 0-11 - variables for number of troops
    // 12-23 - variables for base_dmg * sqrt(troops)
    let c = new Array(num_cols).fill(0);


    // linear
    let row = 0;

    // sum of inf <= total inf
    let total = [config.infCount, config.cavCount, config.arcCount];
    for (let j = 0; j < troop_types; j += 1) {
      for (let i = 0; i < marches.length; i += 1) {
        a.set([row, i * troop_types + j], marches[i].parallel);
      }
      b[row] = total[j];
      row += 1;
    }

    for (let i = 0; i < marches.length; i += 1) {
      // inf+cav+arc <= max_troops
      a.set([row, i * troop_types], 1);
      a.set([row, i * troop_types + 1], 1);
      a.set([row, i * troop_types + 2], 1);
      b[row] = marches[i].max_troops;
      row += 1;
      // inf < 3% (inf + cav + arc)
      // 97 inf - 3 cav - 3 arc <= 0
      // inf < cav / 9
      a.set([row, i * troop_types], 9);
      a.set([row, i * troop_types + 1], -1);
      //a.set([row, i * troop_types + 2], -3);
      row += 1;

      for (let j = 0; j < troop_types; j+= 1) {
        // -inf < 0 (inf >= 0)
        a.set([row, i * troop_types + j], -1);
        b[row] = 0;
        row += 1;
      }

      // What we are optimizing, SCS finds minimum, so we use -1
      c[marches.length * troop_types + i * troop_types] = -1;
      c[marches.length * troop_types + i * troop_types + 1] = -1;
      c[marches.length * troop_types + i * troop_types + 2] = -1;
    }

    // quadratic
    for (let i = 0; i < marches.length; i += 1) {
      let mul = marches[i].used * marches[i].dmg;
      let dmg = [inf_dmg * mul, cav_dmg * mul, arc_dmg * mul];
      //console.log(dmg);
      for (let j = 0; j < troop_types; j += 1) {
        a.set([row, i * troop_types + j], -1);
        b[row] = dmg[j] * dmg[j] / 2;
        row += 1;

        a.set([row, marches.length * troop_types + i * troop_types + j], -2);
        b[row] = 0;
        row += 1;

        a.set([row, i * troop_types + j], -1);
        b[row] = -dmg[j] * dmg[j] / 2;
        row += 1;
      }
    }

    //console.table(format(matrix(a, 'dense'), 1));
    //console.log(b);
    //console.log(c);

    // Convert math.js matrices to plain arrays for the SCS solver
    const plainData = {
      m: num_rows, // number of rows
      n: num_cols, // number of columns
      A_x: (a as any)._values,
      A_i: (a as any)._index,
      A_p: (a as any)._ptr,
      b: b,
      c: c,
    };
    //console.log(plainData);
    let cone = {
      l: linear,
      q: new Array(marches.length * troop_types).fill(3),
      qsize: marches.length * troop_types,
    };
    //console.log(cone);
    let settings = new scs.ScsSettings();
    scs.setDefaultSettings(settings);
    // settings.maxIters = 1000000;
    settings.warmStart = true;
    settings.verbose = false;
    //console.log(settings);

    let start = {
        x: new Array(num_cols).fill(0),
        y: new Array(num_rows).fill(0),
        s: b, 
    };
    let result = scs.solve(plainData, cone, settings, start);
    //console.log(result);
    if (result.status == "INFEASIBLE") {
      throw "failed to find best formations"
    }

    let results = [];
    for (let i = 0; i < marches.length; i += 1) {
      results.push({
        troops: [result.x[i * troop_types], result.x[i * troop_types + 1], result.x[i * troop_types + 2]],
        max_troops: marches[i].max_troops,
      })
    }
    return results;
  }
}
