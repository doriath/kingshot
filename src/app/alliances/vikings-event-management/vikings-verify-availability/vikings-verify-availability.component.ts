import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { VikingsService } from '../../../vikings-event/vikings.service';
import { CharacterAssignmentView, VikingsStatus } from '../../../vikings-event/vikings.types';
import { AdminBreadcrumbService } from '../../../admin-layout/admin-breadcrumb.service';
import { AlliancesService } from '../../alliances.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-vikings-verify-availability',
    templateUrl: './vikings-verify-availability.component.html',
    styleUrl: './vikings-verify-availability.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink, FormsModule]
})
export class VikingsVerifyAvailabilityComponent {
    private route = inject(ActivatedRoute);
    private vikingsService = inject(VikingsService);
    private alliancesService = inject(AlliancesService);
    private breadcrumbService = inject(AdminBreadcrumbService);

    // Filter Signal
    public viewFilter = signal<'online' | 'offline_empty'>('online');

    // Fetch Event Data
    public event = toSignal(
        this.route.paramMap.pipe(
            map(p => p.get('id')),
            switchMap(id => {
                if (!id) return of(null);
                return this.vikingsService.getVikingsEventById(id).pipe(
                    switchMap(evt => {
                        if (!evt) return of(null);
                        // Ideally fetch alliance to get name for breadcrumb
                        return this.alliancesService.getAlliance(evt.allianceId).pipe(
                            map(ally => {
                                if (ally) {
                                    this.breadcrumbService.setLabel(ally.uuid, `[${ally.tag}] ${ally.name || 'Unknown'}`);
                                }
                                if (evt.id) {
                                    this.breadcrumbService.setLabel(evt.id, `Vikings (${evt.date?.toDate ? evt.date.toDate().toLocaleDateString() : 'Event'})`);
                                }
                                return evt;
                            })
                        );
                    })
                );
            })
        )
    );

    // Computed Lists
    public filteredCharacters = computed(() => {
        const e = this.event();
        const filter = this.viewFilter();
        if (!e) return [];
        return e.characters.filter(c => c.status === filter);
    });

    public groupedCharacters = computed(() => {
        const chars = this.filteredCharacters();

        // Sort by power descending
        const sorted = [...chars].sort((a, b) => (b.powerLevel || 0) - (a.powerLevel || 0));

        return {
            verified: sorted.filter(c => !!c.actualStatus && c.actualStatus !== 'unknown'),
            unverified: sorted.filter(c => !c.actualStatus || c.actualStatus === 'unknown')
        };
    });

    // Interaction State
    public selectedChar = signal<CharacterAssignmentView | null>(null);

    // Actions
    public setFilter(filter: 'online' | 'offline_empty') {
        this.viewFilter.set(filter);
        this.selectedChar.set(null);
    }

    public openVerificationPopup(char: CharacterAssignmentView) {
        this.selectedChar.set(char);
    }

    public closePopup() {
        this.selectedChar.set(null);
    }

    public async updateStatus(char: CharacterAssignmentView, status: VikingsStatus) {
        const evt = this.event();
        if (!char || !evt || !evt.id) return;

        // If clicking the same status as currently set, maybe create toggle? 
        // For now, let's just set it.

        const updatedCharacters = evt.characters.map(c => {
            if (c.characterId === char.characterId) {
                return {
                    ...c,
                    actualStatus: status
                };
            }
            return c;
        }).map(c => this.mapViewToModel(c));

        await this.vikingsService.updateEventCharacters(evt.id, updatedCharacters);

        // Close popup after selection
        this.closePopup();
    }

    // Helper (copied from availability component, could be shared util)
    private mapViewToModel(view: CharacterAssignmentView): any {
        const reinforce = view.reinforce.map(r => ({
            characterId: r.characterId,
            marchType: r.marchType
        }));

        return {
            ...view,
            reinforce
        };
    }

    public copyVerifiedEmptyMessage() {
        const evt = this.event();
        if (!evt) return;

        // Get characters that were supposed to be offline_empty AND are verified as offline_empty
        // (Assuming checking 'status' for original assignment and 'actualStatus' for verification)
        const verifiedEmpty = evt.characters.filter(c =>
            c.status === 'offline_empty' &&
            c.actualStatus === 'offline_empty'
        );

        if (verifiedEmpty.length === 0) {
            alert('No players verified as empty yet.');
            return;
        }

        const names = verifiedEmpty.map(c => {
            const powerM = ((c.powerLevel || 0) / 1000000).toFixed(1);
            return `${c.characterName} (${powerM}M)`;
        }).join(', ');
        const message = `Following players are empty: ${names}`;

        navigator.clipboard.writeText(message).then(() => {
            alert('Message copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy to clipboard.');
        });
    }
}
