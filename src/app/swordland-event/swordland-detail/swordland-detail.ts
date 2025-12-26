import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SwordlandEvent } from '../swordland.service';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'app-swordland-detail',
    templateUrl: './swordland-detail.html',
    styleUrls: ['./swordland-detail.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe]
})
export class SwordlandDetailComponent {
    event = input.required<SwordlandEvent>();
    back = output<void>();

    attackers = computed(() => {
        return this.event().participants.filter(p => p.role === 'attacker');
    });

    defenders = computed(() => {
        return this.event().participants.filter(p => p.role === 'defender');
    });
}
