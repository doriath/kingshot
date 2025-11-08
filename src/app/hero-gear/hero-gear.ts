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

export interface OptimizationResult {
  heroName: string;
  gear: {
    type: keyof Hero['gear'];
    currentMastery: number;
    recommendedMastery: number;
    currentEnhancement: number;
    recommendedEnhancement: number;
  }[];
}

@Component({
  selector: 'app-hero-gear',
  templateUrl: './hero-gear.html',
  styleUrls: ['./hero-gear.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class HeroGearComponent {
  heroes = signal<Hero[]>([
    {
      name: 'Infantry',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
    },
    {
      name: 'Cavalry',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
    },
    {
      name: 'Archers',
      gear: {
        helmet: { mastery: 0, enhancement: 0 },
        gloves: { mastery: 0, enhancement: 0 },
        breastplate: { mastery: 0, enhancement: 0 },
        boots: { mastery: 0, enhancement: 0 },
      },
    },
  ]);
  optimizationResult = signal<OptimizationResult[] | null>(null);

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

  optimize() {
    const heroes = this.heroes();
    const result: OptimizationResult[] = [];

    for (const hero of heroes) {
      const gearValues = this.objectKeys(hero.gear).map(key => hero.gear[key]);
      const totalMastery = gearValues.reduce((sum, gear) => sum + gear.mastery, 0);
      const totalEnhancement = gearValues.reduce((sum, gear) => sum + gear.enhancement, 0);
      const avgMastery = Math.round(totalMastery / gearValues.length);
      const avgEnhancement = Math.round(totalEnhancement / gearValues.length);

      const heroResult: OptimizationResult = {
        heroName: hero.name,
        gear: [],
      };

      for (const gearType of this.objectKeys(hero.gear)) {
        const currentGear = hero.gear[gearType];
        heroResult.gear.push({
          type: gearType,
          currentMastery: currentGear.mastery,
          recommendedMastery: Math.max(currentGear.enhancement, avgMastery),
          currentEnhancement: currentGear.enhancement,
          recommendedEnhancement: avgEnhancement,
        });
      }
      result.push(heroResult);
    }

    this.optimizationResult.set(result);
  }

  objectKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[];
  }
}
