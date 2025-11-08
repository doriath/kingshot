import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { BearComponent } from './bear/bear';
import { VikingsComponent } from './vikings/vikings';
import { SwordlandComponent } from './swordland/swordland';
import { BearSimulatorComponent } from './bear-simulator/bear-simulator';
import { MyResearchComponent } from './my-research/my-research';
import { HeroGearComponent } from './hero-gear/hero-gear';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent, title: 'Home' },
    { path: 'bear', component: BearComponent, title: 'Bear' },
    { path: 'vikings', component: VikingsComponent, title: 'Vikings' },
    { path: 'swordland', component: SwordlandComponent, title: 'Swordland' },
    { path: 'bear-simulator', component: BearSimulatorComponent, title: 'Bear Simulator' },
    { path: 'my-research', component: MyResearchComponent, title: 'My Research' },
    { path: 'hero-gear', component: HeroGearComponent, title: 'Hero Gear' },
];
