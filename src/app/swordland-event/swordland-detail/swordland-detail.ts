import { ChangeDetectionStrategy, Component, computed, input, output, signal, inject } from '@angular/core';
import { SwordlandEvent, SwordlandParticipant } from '../swordland.service';
import { UserDataService } from '../../user-data.service';
import { DatePipe, DecimalPipe } from '@angular/common';

@Component({
    selector: 'app-swordland-detail',
    templateUrl: './swordland-detail.html',
    styleUrls: ['./swordland-detail.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe, DecimalPipe]
})
export class SwordlandDetailComponent {
    event = input.required<SwordlandEvent>();
    back = output<void>();

    private userDataService = inject(UserDataService);
    activeCharacterId = this.userDataService.activeCharacterId;

    // Order of display as implicit priority
    private buildingOrder = ['Sanctum', 'Abbey Top', 'Abbey Bottom', 'Abbey Left', 'Abbey Right', 'Belltower', 'Royal Stables'];

    groupedParticipants = computed(() => {
        const participants = this.event().participants;
        const groups = new Map<string, SwordlandParticipant[]>();

        // Initialize groups for known buildings to ensure order/presence
        this.buildingOrder.forEach(b => groups.set(b, []));
        groups.set('Unassigned', []);

        participants.forEach(p => {
            const key = p.building || 'Unassigned';
            const group = groups.get(key);
            if (group) {
                group.push(p);
            } else {
                // Should not happen if typings are strict, but safe fallback
                let other = groups.get('Unassigned');
                other?.push(p);
            }
        });

        // Process each group: Sort Attackers (desc score) then Defenders (desc score)
        const result: { name: string, participants: SwordlandParticipant[] }[] = [];

        // Iterate in specific order
        [...this.buildingOrder, 'Unassigned'].forEach(key => {
            const list = groups.get(key) || [];
            if (list.length === 0) return; // Skip empty sections? Or keep them? User didn't specify, but usually cleaner to skip or showing empty is fine. Let's show only if has participants for now effectively, or maybe just filter at end. 
            // Actually user said "In each section... list the participants". Implies sections exist.
            // Let's filter out empty groups to avoid clutter.

            const attackers = list.filter(p => p.role === 'attacker').sort((a, b) => (b.squadScore || 0) - (a.squadScore || 0));
            const defenders = list.filter(p => p.role === 'defender').sort((a, b) => (b.squadScore || 0) - (a.squadScore || 0));
            // Unassigned role? "The remaining players... with attacker/defender icons". 
            // If role is unassigned, they go last? Or just treat as non-attacker/non-defender.
            // For now, let's just append them at the end if they exist (unlikely if required, but it is optional).
            const others = list.filter(p => p.role === 'unassigned').sort((a, b) => (b.squadScore || 0) - (a.squadScore || 0));

            const sorted = [...attackers, ...defenders, ...others];

            if (sorted.length > 0) {
                result.push({ name: key, participants: sorted });
            }
        });

        return result;
    });

    expandedSet = signal<Set<string>>(new Set());

    toggleParticipant(id: string) {
        const current = new Set(this.expandedSet());
        if (current.has(id)) {
            current.delete(id);
        } else {
            current.add(id);
        }
        this.expandedSet.set(current);
    }

    getInstructions(p: SwordlandParticipant): string {
        if (p.role === 'attacker' && p.building) {
            return `Start of game: Teleport to ${p.building}, take it over, and wait for reinforcements from defenders.`;
        }
        if (p.role === 'defender') {
            if (p.building) {
                return `Start of game: Send your strongest march to ${p.building} (use speedups), and reinforce remaining buildings with defender heroes.`;
            } else {
                return `Start of game: Stay in the safe red zone, and reinforce all buildings with defender heroes.`;
            }
        }
        return 'No specific instructions available.';
    }
}
