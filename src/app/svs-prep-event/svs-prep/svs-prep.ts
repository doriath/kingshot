import { ChangeDetectionStrategy, Component, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SvSPrepService, SvSPrepEvent, SvSPrepRegistration, BoostType } from '../svs-prep.service';
import { Auth, user } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { UserDataService } from '../../user-data.service';

@Component({
    selector: 'app-svs-prep',
    templateUrl: './svs-prep.html',
    styleUrl: './svs-prep.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule]
})
export class SvsPrepComponent {
    private svsService = inject(SvSPrepService);
    private auth = inject(Auth);
    private userDataService = inject(UserDataService);
    private cdr = inject(ChangeDetectorRef);

    public user$ = user(this.auth);
    public events$ = this.svsService.getEvents();

    // State
    public selectedEventIdx = signal<number>(0);
    public currentEvent = computed(() => {
        return this.fetchedEvents()[this.selectedEventIdx()];
    });

    public fetchedEvents = signal<SvSPrepEvent[]>([]);
    public registrations = signal<SvSPrepRegistration[]>([]); // All user registrations
    public loading = signal<boolean>(true);
    public saving = signal<boolean>(false);

    // Character View Models
    public expandedCharacterId = signal<string | null>(null);
    public characters = this.userDataService.characters;

    // Combining Characters and Registrations
    public characterViewModels = computed(() => {
        const chars = this.characters();
        const regs = this.registrations();

        return chars.map(c => {
            const reg = regs.find(r => r.characterId === c.id);
            return {
                ...c,
                registration: reg,
                isRegistered: !!reg
            };
        });
    });

    // Storage for user selections for the CURRENTLY expanded character
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
                await this.loadRegistrations(events[0].id!);
            }
        } catch (e) {
            console.error("Failed to load events", e);
        } finally {
            this.loading.set(false);
        }
    }

    async loadRegistrations(eventId: string) {
        const user = this.auth.currentUser;
        if (!user) return;

        const regs = await firstValueFrom(this.svsService.getUserRegistrations(eventId, user.uid));
        this.registrations.set(regs);
    }

    toggleExpand(characterId: string) {
        if (this.expandedCharacterId() === characterId) {
            this.expandedCharacterId.set(null);
        } else {
            this.expandedCharacterId.set(characterId);
            this.hydrateSelections(characterId);
        }
    }

    hydrateSelections(characterId: string) {
        const vm = this.characterViewModels().find(c => c.id === characterId);
        const reg = vm?.registration;

        const newSelections: Record<BoostType, Set<string>> = {
            construction: new Set(),
            research: new Set(),
            troops: new Set()
        };

        if (reg) {
            reg.preferences.forEach(p => {
                p.slots.forEach(s => newSelections[p.boostType].add(s));
            });
        }
        this.selections.set(newSelections);
    }


    // Drag Support
    private isDragging = false;
    private dragMode = true; // true = select, false = deselect

    startDrag(event: Event, type: BoostType, time: string) {
        // Prevent default text selection
        if (event instanceof MouseEvent) {
            event.preventDefault();
        }

        const currentSelected = this.isSelected(type, time);
        this.dragMode = !currentSelected; // If currently selected, we want to deselect, and vice versa
        this.isDragging = true;

        this.setSlot(type, time, this.dragMode);
    }

    onMouseEnter(type: BoostType, time: string) {
        if (this.isDragging) {
            this.setSlot(type, time, this.dragMode);
        }
    }

    stopDrag() {
        this.isDragging = false;
    }

    handleTouchMove(event: TouchEvent, boostType: BoostType) {
        if (!this.isDragging) return;
        event.preventDefault(); // Prevent scrolling

        const touch = event.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);

        if (element && element.hasAttribute('data-time')) {
            const time = element.getAttribute('data-time');
            if (time) {
                this.setSlot(boostType, time, this.dragMode);
            }
        }
    }

    // Consolidated update method
    setSlot(type: BoostType, time: string, shouldSelect: boolean) {
        this.selections.update(current => {
            const set = new Set(current[type]);
            if (shouldSelect) {
                set.add(time);
            } else {
                set.delete(time);
            }
            return {
                ...current,
                [type]: set
            };
        });
        this.cdr.markForCheck();
    }

    // Kept for simple toggle clicks if needed, though drag logic handles the initial click too
    toggleSlot(type: BoostType, time: string) {
        // We defer to setSlot based on current state
        const current = this.isSelected(type, time);
        this.setSlot(type, time, !current);
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

    async save(characterId: string) {
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

            const character = this.characters().find(c => c.id === characterId);

            const reg: SvSPrepRegistration = {
                eventId: evt.id,
                userId: user.uid,
                updatedAt: new Date(),
                preferences,
                characterId: characterId,
                characterName: character?.name || 'Unknown',
                characterVerified: !!character?.verified
            };

            await this.svsService.saveRegistration(reg);

            // Reload registrations to update UI status
            await this.loadRegistrations(evt.id);
            alert('Saved!');
            this.expandedCharacterId.set(null); // Collapse on save
        } catch (e) {
            console.error(e);
            alert('Error saving');
        } finally {
            this.saving.set(false);
        }
    }

    isSelected(type: BoostType, time: string): boolean {
        return this.selections()[type].has(time);
    }
}
