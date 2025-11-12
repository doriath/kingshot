import { Routes } from '@angular/router';
import { BearEventComponent } from './bear-event/bear-event';
import { BearFormationOptimizerComponent } from './bear-formation-optimizer/bear-formation-optimizer';

export const BEAR_ROUTES: Routes = [
    {
        path: 'events/bear',
        component: BearEventComponent,
        title: 'Bear Event',
    },
    {
        path: 'tools/bear-formation-optimizer',
        component: BearFormationOptimizerComponent,
        title: 'Bear Optimizer',
    },
];
