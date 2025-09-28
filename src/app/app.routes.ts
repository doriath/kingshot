import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { BearComponent } from './bear/bear';
import { VikingsComponent } from './vikings/vikings';
import { SwordlandComponent } from './swordland/swordland';

export const routes: Routes = [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent },
    { path: 'bear', component: BearComponent },
    { path: 'vikings', component: VikingsComponent },
    { path: 'swordland', component: SwordlandComponent },
];
