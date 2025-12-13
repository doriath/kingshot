import { ChangeDetectionStrategy, Component, signal, effect, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SolverService } from '../solver.service';

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
  beforeScore: number;
  afterScore: number;
}

export interface OptimizationOutput {
  results: OptimizationResult[];
  totalBeforeScore: number;
  totalAfterScore: number;
}

@Component({
  selector: 'app-hero-gear',
  templateUrl: './hero-gear.html',
  styleUrls: ['./hero-gear.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class HeroGearComponent {
  private readonly HEROES_STORAGE_KEY = 'heroGearOptimizer.heroes';
  private readonly EXP_STORAGE_KEY = 'heroGearOptimizer.exp';
  private readonly HAMMERS_STORAGE_KEY = 'heroGearOptimizer.hammers';
  private readonly MYTHICS_STORAGE_KEY = 'heroGearOptimizer.mythics';
  private readonly MYTHRIL_STORAGE_KEY = 'heroGearOptimizer.mythril';
  private readonly defaultHeroes: HeroWeights[] = [
    {
      name: 'Infantry',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
      weights: { lethality: 0.5, health: 2.5 },
    },
    {
      name: 'Cavalry',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
      weights: { lethality: 1.75, health: 0.5 },
    },
    {
      name: 'Archers',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
      weights: { lethality: 2.5, health: 1 },
    },
  ];

  heroes = signal<HeroWeights[]>(this.defaultHeroes);
  exp = signal(0);
  hammers = signal(0);
  mythics = signal(0);
  mythril = signal(0);
  optimizationResult = signal<OptimizationOutput | null>(null);
  isAdvancedCollapsed = signal(true);

  private solverService = inject(SolverService);

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    this.reset();
    if (isPlatformBrowser(this.platformId)) {
      const savedHeroes = localStorage.getItem(this.HEROES_STORAGE_KEY);
      if (savedHeroes) {
        this.heroes.set(JSON.parse(savedHeroes));
      }
      const savedExp = localStorage.getItem(this.EXP_STORAGE_KEY);
      if (savedExp) {
        this.exp.set(JSON.parse(savedExp));
      }
      const savedHammers = localStorage.getItem(this.HAMMERS_STORAGE_KEY);
      if (savedHammers) {
        this.hammers.set(JSON.parse(savedHammers));
      }
      const savedMythics = localStorage.getItem(this.MYTHICS_STORAGE_KEY);
      if (savedMythics) {
        this.mythics.set(JSON.parse(savedMythics));
      }
      const savedMythril = localStorage.getItem(this.MYTHRIL_STORAGE_KEY);
      if (savedMythril) {
        this.mythril.set(JSON.parse(savedMythril));
      }
    }

    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(this.HEROES_STORAGE_KEY, JSON.stringify(this.heroes()));
        localStorage.setItem(this.EXP_STORAGE_KEY, JSON.stringify(this.exp()));
        localStorage.setItem(this.HAMMERS_STORAGE_KEY, JSON.stringify(this.hammers()));
        localStorage.setItem(this.MYTHICS_STORAGE_KEY, JSON.stringify(this.mythics()));
        localStorage.setItem(this.MYTHRIL_STORAGE_KEY, JSON.stringify(this.mythril()));
      }
    });
  }

  reset() {
    this.heroes.set(this.defaultHeroes);
    this.exp.set(0);
    this.hammers.set(0);
    this.mythics.set(0);
    this.mythril.set(0);
    this.optimizationResult.set(null);
  }

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

  updateMythics(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.mythics.set(+value);
  }

  updateMythril(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.mythril.set(+value);
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

  optimize() {
    if (!this.solverService.isSolverLoaded()) {
      console.warn('Solver not loaded yet');
      return;
    }

    const inputData = {
      heroes: this.heroes(),
      exp: this.exp(),
      hammers: this.hammers(),
      mythics: this.mythics(),
      mythril: this.mythril()
    };

    try {
      const result = this.solverService.solve(inputData);
      this.optimizationResult.set(result);
    } catch (e) {
      console.error('Optimization failed:', e);
    }
  }

  objectKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[];
  }
}
