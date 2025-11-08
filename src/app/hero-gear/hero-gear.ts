import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Gear {
  mastery: number;
  enhancement: number;
}

export interface Hero {
  name: string;
  gear: {
    helmet: Gear;
    gloves: Gear;
    breastplate: Gear;
    boots: Gear;
  };
}

export interface StatWeights {
  lethality: number;
  health: number;
}

export interface HeroWeights extends Hero {
  weights: StatWeights;
}

export interface Stats {
  lethality: number;
  health: number;
}

export interface OptimizationResult {
  heroName: string;
  gear: {
    type: keyof Hero['gear'];
    currentMastery: number;
    recommendedMastery: number;
    currentEnhancement: number;
    recommendedEnhancement: number;
  }[];
  beforeStats: Stats;
  afterStats: Stats;
}

@Component({
  selector: 'app-hero-gear',
  templateUrl: './hero-gear.html',
  styleUrls: ['./hero-gear.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class HeroGearComponent {
  heroes = signal<HeroWeights[]>([
    {
      name: 'Infantry',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
      weights: { lethality: 1, health: 1 },
    },
    {
      name: 'Cavalry',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
      weights: { lethality: 1, health: 1 },
    },
    {
      name: 'Archers',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
      weights: { lethality: 1, health: 1 },
    },
  ]);

  exp = signal(0);
  hammers = signal(0);
  optimizationResult = signal<OptimizationResult[] | null>(null);
  isAdvancedCollapsed = signal(true);

  toggleAdvanced() {
    this.isAdvancedCollapsed.set(!this.isAdvancedCollapsed());
  }

  updateExp(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.exp.set(+value);
  }

  updateHammers(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.hammers.set(+value);
  }

  updateMastery(heroName: string, gearType: keyof Hero['gear'], event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.heroes.update(heroes =>
      heroes.map(hero =>
        hero.name === heroName
          ? { ...hero, gear: { ...hero.gear, [gearType]: { ...hero.gear[gearType], mastery: +value } } }
          : hero
      )
    );
  }

  updateEnhancement(heroName: string, gearType: keyof Hero['gear'], event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.heroes.update(heroes =>
      heroes.map(hero =>
        hero.name === heroName
          ? { ...hero, gear: { ...hero.gear, [gearType]: { ...hero.gear[gearType], enhancement: +value } } }
          : hero
      )
    );
  }

  updateWeight(heroName: string, weightType: keyof StatWeights, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.heroes.update(heroes =>
      heroes.map(hero =>
        hero.name === heroName
          ? { ...hero, weights: { ...hero.weights, [weightType]: +value } }
          : hero
      )
    );
  }

  stat(enh: number, mastery: number): number {
    return (0.15 + Math.min(enh, 100) * 0.0035 + Math.max(enh - 100, 0) * 0.005) * (1 + mastery * 0.1);
  }

  calculateStats(gear: Hero['gear']): Stats {
    const lethality = this.stat(gear.helmet.enhancement, gear.helmet.mastery) + this.stat(gear.boots.enhancement, gear.boots.mastery);
    const health = this.stat(gear.breastplate.enhancement, gear.breastplate.mastery) + this.stat(gear.gloves.enhancement, gear.gloves.mastery);
    return { lethality, health };
  }

  optimize() {
    const heroes = this.heroes();
    const totalExp = this.exp();
    const totalHammers = this.hammers();
    const result: OptimizationResult[] = [];

    const totalMasteryWeight = heroes.reduce((sum, hero) => sum + hero.weights.lethality, 0);
    const totalEnhancementWeight = heroes.reduce((sum, hero) => sum + hero.weights.health, 0);

    for (const hero of heroes) {
      const beforeStats = this.calculateStats(hero.gear);

      const heroExpAllocation = totalMasteryWeight > 0 ? totalExp * (hero.weights.lethality / totalMasteryWeight) : 0;
      const heroHammersAllocation = totalEnhancementWeight > 0 ? totalHammers * (hero.weights.health / totalEnhancementWeight) : 0;

      const numGearPieces = this.objectKeys(hero.gear).length;
      const expPerGear = heroExpAllocation / numGearPieces;
      const hammersPerGear = heroHammersAllocation / numGearPieces;

      const recommendedGear: Hero['gear'] = { ...hero.gear };

      const heroResult: OptimizationResult = {
        heroName: hero.name,
        gear: [],
        beforeStats: beforeStats,
        afterStats: { lethality: 0, health: 0 }, // Will be calculated below
      };

      for (const gearType of this.objectKeys(hero.gear)) {
        const currentGear = hero.gear[gearType];
        const recommendedMastery = currentGear.mastery + Math.floor(expPerGear);
        const recommendedEnhancement = currentGear.enhancement + Math.floor(hammersPerGear);

        recommendedGear[gearType] = { mastery: recommendedMastery, enhancement: recommendedEnhancement };

        heroResult.gear.push({
          type: gearType,
          currentMastery: currentGear.mastery,
          recommendedMastery: recommendedMastery,
          currentEnhancement: currentGear.enhancement,
          recommendedEnhancement: recommendedEnhancement,
        });
      }

      const afterStats = this.calculateStats(recommendedGear);
      heroResult.afterStats = afterStats;
      result.push(heroResult);
    }

    this.optimizationResult.set(result);
  }

  objectKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[];
  }
}
