import { Routes } from '@angular/router';
import { BearEventComponent } from './bear-event/bear-event';
import { BearOptimizerComponent } from './bear-optimizer/bear-optimizer';

export const BEAR_ROUTES: Routes = [
    {
        path: 'events/bear',
        component: BearEventComponent,
        title: 'Bear Event',
    },
    {
        path: 'bear',
        component: BearEventComponent,
        title: 'Bear Event',
    },
    {
        path: 'tools/bear-optimizer',
        component: BearOptimizerComponent,
        title: 'Bear Optimizer',
    },
];
