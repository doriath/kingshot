import { ChangeDetectionStrategy, Component, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SvSPrepService, SvSPrepEvent, SvSPrepRegistration, BoostType } from '../svs-prep.service';
import { ImgbbService } from '../../services/imgbb.service';
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
    private imgbbService = inject(ImgbbService);
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
    public expandedCharacterId = signal<number | null>(null);
    public characters = this.userDataService.characters;

    // Combining Characters and Registrations
    public characterViewModels = computed(() => {
        const chars = this.characters();
        const regs = this.registrations();

        return chars.map(c => {
            const reg = regs.find(r => r.characterId === String(c.id));
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

    // Image Upload State
    public selectedFiles = signal<File[]>([]);
    public uploadedImageUrls = signal<string[]>([]);


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

    toggleExpand(characterId: number) {
        if (this.expandedCharacterId() === characterId) {
            this.expandedCharacterId.set(null);
        } else {
            this.expandedCharacterId.set(characterId);
            this.hydrateSelections(characterId);
        }
    }

    hydrateSelections(characterId: number) {
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
        this.uploadedImageUrls.set(reg?.backpackImages ?? []);
        this.selectedFiles.set([]); // Reset new files on load
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

    // Helpers to generate time slots (-23:45 to 23:45)
    public timeSlots = computed(() => {
        const slots: string[] = [];
        // Start from -15 minutes (representing 23:45 of previous day)
        // End at 1425 minutes (23:45 of current day)
        // Step 30 minutes
        for (let m = -15; m <= 1425; m += 30) {
            if (m < 0) {
                // Special case for previous day
                slots.push("-23:45");
            } else {
                const h = Math.floor(m / 60);
                const min = m % 60;
                const hStr = h.toString().padStart(2, '0');
                const mStr = min.toString().padStart(2, '0');
                slots.push(`${hStr}:${mStr}`);
            }
        }
        return slots;
    });

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const files = Array.from(input.files);
        const currentFiles = this.selectedFiles();

        // Limit total files (existing uploaded + new selection) to 2
        const currentCount = this.uploadedImageUrls().length;
        const maxNew = Math.max(0, 2 - currentCount);

        const validFiles = files.slice(0, maxNew);
        this.selectedFiles.set(validFiles);
    }

    removeFile(index: number) {
        this.selectedFiles.update(files => files.filter((_, i) => i !== index));
    }

    removeUploadedImage(url: string) {
        this.uploadedImageUrls.update(urls => urls.filter(u => u !== url));
    }

    async save(characterId: number) {
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

            // Upload new images
            const newImageUrls: string[] = [];
            for (const file of this.selectedFiles()) {
                const url = await this.imgbbService.uploadImage(file);
                newImageUrls.push(url);
            }

            // Combine with existing kept URLs
            const finalImages = [...this.uploadedImageUrls(), ...newImageUrls];

            const reg: SvSPrepRegistration = {
                eventId: evt.id,
                userId: user.uid,
                updatedAt: new Date(),
                preferences,
                characterId: String(characterId),
                characterName: character?.name || 'Unknown',
                characterVerified: !!character?.verified,
                backpackImages: finalImages
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
