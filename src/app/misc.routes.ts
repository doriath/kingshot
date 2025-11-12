import { Routes } from '@angular/router';
import { BearSimulatorComponent } from './bear-simulator/bear-simulator';
import { MyResearchComponent } from './my-research/my-research';
import { HeroGearComponent } from './hero-gear/hero-gear';

export const MISC_ROUTES: Routes = [
    {
        path: 'bear-simulator',
        component: BearSimulatorComponent,
        title: 'Bear Simulator',
    },
    {
        path: 'my-research',
        component: MyResearchComponent,
        title: 'My Research',
    },
    {
        path: 'hero-gear',
        component: HeroGearComponent,
        title: 'Hero Gear',
    },
];
