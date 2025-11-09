import { ChangeDetectionStrategy, Component, signal, effect, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

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
      weights: { lethality: 1, health: 2.5 },
    },
  ];

  private readonly expCosts = [0,
    10,
    25,
    45,
    70,
    100,
    135,
    175,
    220,
    270,
    325,
    385,
    450,
    520,
    595,
    675,
    760,
    850,
    945,
    1045,
    1150,
    1260,
    1375,
    1495,
    1620,
    1750,
    1885,
    2025,
    2170,
    2320,
    2480,
    2650,
    2830,
    3020,
    3220,
    3430,
    3650,
    3880,
    4120,
    4370,
    4640,
    4930,
    5240,
    5570,
    5920,
    6290,
    6680,
    7090,
    7520,
    7970,
    8440,
    8930,
    9440,
    9970,
    10520,
    11090,
    11680,
    12290,
    12920,
    13570,
    14250,
    14960,
    15700,
    16470,
    17270,
    18100,
    18960,
    19850,
    20770,
    21720,
    22710,
    23740,
    24810,
    25920,
    27070,
    28260,
    29490,
    30760,
    32070,
    33420,
    34820,
    36270,
    37770,
    39320,
    40920,
    42570,
    44270,
    46020,
    47820,
    49670,
    51570,
    53520,
    55520,
    57570,
    59670,
    61820,
    64020,
    66270,
    68570,
    70920,
    73320,
    73320,
    75820,
    78370,
    80970,
    83620,
    86320,
    89070,
    91870,
    94720,
    97620,
    100570,
    103570,
    106620,
    109720,
    112870,
    116070,
    119320,
    122620,
    125970,
    125970,
    129470,
    133020,
    136620,
    140270,
    143970,
    147720,
    151520,
    155370,
    159270,
    163220,
    167220,
    171270,
    175370,
    179520,
    183720,
    187970,
    192270,
    196620,
    201020,
    201020,
    205470,
    209970,
    214520,
    219120,
    223770,
    228470,
    233220,
    238020,
    242870,
    247770,
    252720,
    257720,
    262770,
    267870,
    273020,
    278220,
    283470,
    288770,
    294120,
    294120,
    299620,
    305220,
    310920,
    316720,
    322620,
    328620,
    334720,
    340920,
    347220,
    353620,
    360120,
    366720,
    373420,
    380220,
    387120,
    394120,
    401220,
    408420,
    415720,
    415720,
    423220,
    430820,
    438520,
    446320,
    454220,
    462220,
    470320,
    478520,
    486820,
    495220,
    503720,
    512320,
    521020,
    529820,
    538720,
    547720,
    556820,
    566020,
    575320,
    575320];

  maxEnhancement = this.expCosts.length - 1;
  heroes = signal<HeroWeights[]>(this.defaultHeroes);
  exp = signal(0);
  hammers = signal(0);
  optimizationResult = signal<OptimizationOutput | null>(null);
  isAdvancedCollapsed = signal(true);

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
    }

    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(this.HEROES_STORAGE_KEY, JSON.stringify(this.heroes()));
        localStorage.setItem(this.EXP_STORAGE_KEY, JSON.stringify(this.exp()));
        localStorage.setItem(this.HAMMERS_STORAGE_KEY, JSON.stringify(this.hammers()));
      }
    });
  }

  reset() {
    this.heroes.set(this.defaultHeroes);
    this.exp.set(0);
    this.hammers.set(0);
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

  expCost(enhancement: number) {
    return this.expCosts[enhancement];
  }

  calculateStats(gear: Hero['gear']): Stats {
    const lethality = this.stat(gear.helmet.enhancement, gear.helmet.mastery) + this.stat(gear.boots.enhancement, gear.boots.mastery);
    const health = this.stat(gear.breastplate.enhancement, gear.breastplate.mastery) + this.stat(gear.gloves.enhancement, gear.gloves.mastery);
    return { lethality, health };
  }

  optimize() {
    const heroes = this.heroes();
    const extraExp = this.exp();
    const result: OptimizationResult[] = [];

    let totalExp = extraExp;
    for (const hero of heroes) {
      for (const gearType of this.objectKeys(hero.gear)) {
        totalExp += this.expCost(hero.gear[gearType].enhancement);
      }
    }

    const beforeOptimization = heroes.map(hero => {
      const beforeStats = this.calculateStats(hero.gear);
      const beforeScore = beforeStats.lethality * hero.weights.lethality + beforeStats.health * hero.weights.health;
      return {
        heroName: hero.name,
        gear: this.objectKeys(hero.gear).map(type => ({
          type,
          currentMastery: hero.gear[type].mastery,
          currentEnhancement: hero.gear[type].enhancement,
          recommendedMastery: hero.gear[type].mastery,
          recommendedEnhancement: 0,
        })),
        beforeStats: beforeStats,
        beforeScore: beforeScore,
        afterStats: { lethality: 0, health: 0 },
      };
    });

    const optimizedHeroes = heroes.map(hero => ({
      ...hero,
      gear: {
        helmet: { ...hero.gear.helmet, enhancement: 0 },
        gloves: { ...hero.gear.gloves, enhancement: 0 },
        breastplate: { ...hero.gear.breastplate, enhancement: 0 },
        boots: { ...hero.gear.boots, enhancement: 0 },
      }
    }));

    while (true) {
      let bestUpgrade: { heroIndex: number; gearType: keyof Hero['gear']; efficiency: number } | null = null;
      let costOfBestUpgrade = 0;

      for (let i = 0; i < optimizedHeroes.length; i++) {
        const hero = optimizedHeroes[i];
        for (const gearType of this.objectKeys(hero.gear)) {
          const currentGear = hero.gear[gearType];

          if (currentGear.enhancement >= this.maxEnhancement) {
            continue;
          }

          const currentStats = this.calculateStats(hero.gear);
          const currentScore = currentStats.lethality * hero.weights.lethality + currentStats.health * hero.weights.health;
          
          const nextEnhancement = currentGear.enhancement + 1;
          const cost = this.expCost(nextEnhancement) - this.expCost(currentGear.enhancement);
          if (totalExp < cost) {
            continue;
          }

          const nextGear = { ...hero.gear, [gearType]: { ...currentGear, enhancement: nextEnhancement } };
          const nextStats = this.calculateStats(nextGear);
          const nextScore = nextStats.lethality * hero.weights.lethality + nextStats.health * hero.weights.health;

          const efficiency = (nextScore - currentScore) / cost;
          if (!bestUpgrade || efficiency > bestUpgrade.efficiency) {
            bestUpgrade = { heroIndex: i, gearType: gearType, efficiency };
            costOfBestUpgrade = cost;
          }
        }
      }

      if (bestUpgrade) {
        optimizedHeroes[bestUpgrade.heroIndex].gear[bestUpgrade.gearType].enhancement++;
        totalExp -= costOfBestUpgrade;
      } else {
        break;
      }
    }
    
    let totalBeforeScore = 0;
    let totalAfterScore = 0;

    for (let i = 0; i < optimizedHeroes.length; i++) {
      const hero = optimizedHeroes[i];
      const beforeResult = beforeOptimization[i];
      const afterStats = this.calculateStats(hero.gear);
      const afterScore = afterStats.lethality * hero.weights.lethality + afterStats.health * hero.weights.health;

      totalBeforeScore += beforeResult.beforeScore;
      totalAfterScore += afterScore;

      result.push({
        heroName: hero.name,
        gear: this.objectKeys(hero.gear).map(type => ({
          type: type,
          currentMastery: beforeResult.gear.find(g => g.type === type)!.currentMastery,
          recommendedMastery: beforeResult.gear.find(g => g.type === type)!.currentMastery,
          currentEnhancement: beforeResult.gear.find(g => g.type === type)!.currentEnhancement,
          recommendedEnhancement: hero.gear[type].enhancement,
        })),
        beforeStats: beforeResult.beforeStats,
        afterStats: afterStats,
        beforeScore: beforeResult.beforeScore,
        afterScore: afterScore,
      });
    }

    const optimizationOutput: OptimizationOutput = {
      results: result,
      totalBeforeScore,
      totalAfterScore,
    };

    this.optimizationResult.set(optimizationOutput);
  }

  objectKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[];
  }
}
