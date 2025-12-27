import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvSPrepService, SvSPrepEvent, SvSPrepRegistration, BoostType } from '../svs-prep.service';
import { Auth, user } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { UserDataService } from '../../user-data.service';

@Component({
    selector: 'app-svs-prep',
    templateUrl: './svs-prep.html',
    styleUrl: './svs-prep.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule]
})
export class SvsPrepComponent {
    private svsService = inject(SvSPrepService);
    private auth = inject(Auth);
    private userDataService = inject(UserDataService);

    public user$ = user(this.auth);
    public events$ = this.svsService.getEvents();

    // State
    public selectedEventIdx = signal<number>(0);
    public currentEvent = computed(() => {
        // This assumes the events$ async pipe in template or we subscribe. 
        // Actually better to use resource or signal, but standard rxjs integration is fine.
        // We will just expose the raw list and let the template or a signal wrapper handle it.
        // For simplicity, let's load events into a signal.
        return this.fetchedEvents()[this.selectedEventIdx()];
    });

    public fetchedEvents = signal<SvSPrepEvent[]>([]);
    public activeRegistration = signal<SvSPrepRegistration | null>(null);
    public loading = signal<boolean>(true);
    public saving = signal<boolean>(false);

    // Selection State
    public selectedBoostTab = signal<BoostType>('construction');

    // Storage for user selections before saving
    // Map of BoostType -> Set of slot IDs (e.g. "13:00", "13:30")
    public selections = signal<Record<BoostType, Set<string>>>({
        construction: new Set(),
        research: new Set(),
        troops: new Set()
    });

    constructor() {
        this.init();
    }

    async init() {
        this.loading.set(true);
        try {
            const events = await firstValueFrom(this.svsService.getEvents());
            this.fetchedEvents.set(events);

            if (events.length > 0) {
                await this.loadRegistration(events[0].id!);
            }
        } catch (e) {
            console.error("Failed to load events", e);
        } finally {
            this.loading.set(false);
        }
    }

    async loadRegistration(eventId: string) {
        const user = this.auth.currentUser;
        if (!user) return;

        const reg = await firstValueFrom(this.svsService.getUserRegistration(eventId, user.uid));
        this.activeRegistration.set(reg || null);

        if (reg) {
            // Hydrate selections
            const newSelections: Record<BoostType, Set<string>> = {
                construction: new Set(),
                research: new Set(),
                troops: new Set()
            };

            reg.preferences.forEach(p => {
                p.slots.forEach(s => newSelections[p.boostType].add(s));
            });
            this.selections.set(newSelections);
        } else {
            // Clear if new
            this.selections.set({
                construction: new Set(),
                research: new Set(),
                troops: new Set()
            });
        }
    }

    toggleSlot(time: string) {
        const type = this.selectedBoostTab();
        const current = this.selections();
        const set = new Set(current[type]);

        if (set.has(time)) {
            set.delete(time);
        } else {
            set.add(time);
        }

        this.selections.set({
            ...current,
            [type]: set
        });
    }

    // Helpers to generate time slots (00:00 to 23:30)
    public timeSlots = computed(() => {
        const slots: string[] = [];
        for (let h = 0; h < 24; h++) {
            const hStr = h.toString().padStart(2, '0');
            slots.push(`${hStr}:00`);
            slots.push(`${hStr}:30`);
        }
        return slots;
    });

    async save() {
        const evt = this.currentEvent();
        const user = this.auth.currentUser;
        if (!evt || !user || !evt.id) return;

        this.saving.set(true);
        try {
            const sels = this.selections();
            const preferences = [
                { boostType: 'construction' as BoostType, slots: Array.from(sels.construction).sort() },
                { boostType: 'research' as BoostType, slots: Array.from(sels.research).sort() },
                { boostType: 'troops' as BoostType, slots: Array.from(sels.troops).sort() }
            ].filter(p => p.slots.length > 0);

            const reg: SvSPrepRegistration = {
                eventId: evt.id,
                userId: user.uid,
                updatedAt: new Date(),
                preferences,
                // Ideally we fetch character name from UserDataService but for now partial is fine or we update logic
            };

            await this.svsService.saveRegistration(reg);
            this.activeRegistration.set(reg);
            alert('Saved!');
        } catch (e) {
            console.error(e);
            alert('Error saving');
        } finally {
            this.saving.set(false);
        }
    }

    isSelected(time: string): boolean {
        return this.selections()[this.selectedBoostTab()].has(time);
    }

    getBoostDay(type: BoostType): string {
        const evt = this.currentEvent();
        if (!evt) return '';
        if (type === 'construction') return evt.constructionDay;
        if (type === 'research') return evt.researchDay;
        if (type === 'troops') return evt.troopsDay;
        return '';
    }
}
