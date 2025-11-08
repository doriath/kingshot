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
  recommendations = signal<string[]>([]);

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
    const recommendations: string[] = [];
    const heroes = this.heroes();

    for (const hero of heroes) {
      const gearValues = this.objectKeys(hero.gear).map(key => hero.gear[key]);
      const totalMastery = gearValues.reduce((sum, gear) => sum + gear.mastery, 0);
      const totalEnhancement = gearValues.reduce((sum, gear) => sum + gear.enhancement, 0);
      const avgMastery = totalMastery / gearValues.length;
      const avgEnhancement = totalEnhancement / gearValues.length;

      for (const gearType of this.objectKeys(hero.gear)) {
        const gear = hero.gear[gearType];
        if (gear.enhancement > gear.mastery) {
          recommendations.push(`${hero.name} ${gearType}: Increase mastery level. It's lower than the enhancement level.`);
        }

        if (gear.mastery < avgMastery * 0.8) {
          recommendations.push(`${hero.name} ${gearType}: Mastery level is significantly lower than the average for this hero. Consider upgrading.`);
        }

        if (gear.enhancement < avgEnhancement * 0.8) {
          recommendations.push(`${hero.name} ${gearType}: Enhancement level is significantly lower than the average for this hero. Consider upgrading.`);
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('All gear levels look balanced. Great job!');
    }

    this.recommendations.set(recommendations);
  }

  objectKeys<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[];
  }
}
