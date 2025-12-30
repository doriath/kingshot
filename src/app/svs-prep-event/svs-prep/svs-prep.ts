import { ChangeDetectionStrategy, Component, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SvSPrepService, SvSPrepEvent, SvSPrepRegistration, BoostType } from '../svs-prep.service';
import { ImgbbService } from '../../services/imgbb.service';
import { generateTimeSlots, getCompressedSlots, parseTimeInput } from '../svs-time-utils';
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
            const warnings: string[] = [];

            if (reg) {
                // Images
                if ((reg.backpackImages?.length || 0) < 2) {
                    warnings.push(`Missing backpack screenshots (${reg.backpackImages?.length || 0}/2)`);
                }

                // Slots
                reg.preferences.forEach(p => {
                    if (p.slots.length < 10) {
                        const typeStr = p.boostType.charAt(0).toUpperCase() + p.boostType.slice(1);
                        warnings.push(`${typeStr}: Less than 5h selected (${p.slots.length} slots)`);
                    }
                });
            }

            const formatSlots = (slots: string[] | undefined) => getCompressedSlots(slots || []);

            // Summary text generation
            let summary = '';
            if (reg) {
                const constSlots = reg.preferences.find(p => p.boostType === 'construction')?.slots || [];
                const resSlots = reg.preferences.find(p => p.boostType === 'research')?.slots || [];
                const trSlots = reg.preferences.find(p => p.boostType === 'troops')?.slots || [];

                const cStr = formatSlots(constSlots);
                const rStr = formatSlots(resSlots);
                const tStr = formatSlots(trSlots);

                if (cStr === rStr && cStr === tStr && cStr.length > 0) {
                    summary = `All Days: ${cStr}`;
                } else {
                    const parts = [];
                    if (cStr) parts.push(`Construction: ${cStr}`);
                    if (rStr) parts.push(`Research: ${rStr}`);
                    if (tStr) parts.push(`Troops: ${tStr}`);
                    summary = parts.join(' | ');
                }
                if (!summary) summary = 'No slots selected';
            }

            return {
                ...c,
                registration: reg,
                isRegistered: !!reg,
                warnings,
                summary
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

    // New Registration Controls
    public entryMode = signal<'simple' | 'advanced'>('simple');
    public simpleModeTargets = signal({
        construction: true,
        research: true,
        troops: true
    });

    public setSimpleTarget(type: BoostType, value: boolean) {
        this.simpleModeTargets.update(curr => ({
            ...curr,
            [type]: value
        }));
    }

    public sameTimeForAll = signal<boolean>(true);
    public timeRangeInput = signal<string>('');

    // Image Upload State
    public selectedFiles = signal<File[]>([]);
    public uploadedImageUrls = signal<string[]>([]);

    public currentEditWarnings = computed(() => {
        const charId = this.expandedCharacterId();
        if (!charId) return [];

        const warnings: string[] = [];

        // Check images
        const currentImagesCount = this.uploadedImageUrls().length + this.selectedFiles().length;
        if (currentImagesCount < 2) {
            warnings.push(`Missing backpack screenshots (${currentImagesCount}/2)`);
        }

        // Check slots
        const sels = this.selections();
        (['construction', 'research', 'troops'] as BoostType[]).forEach(type => {
            const count = sels[type].size;
            if (count > 0 && count < 10) {
                const typeStr = type.charAt(0).toUpperCase() + type.slice(1);
                warnings.push(`${typeStr}: Less than 5h selected (${count} slots)`);
            }
        });

        return warnings;
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
            // Detect if all are same
            const cStr = Array.from(newSelections.construction).sort().join(',');
            const rStr = Array.from(newSelections.research).sort().join(',');
            const tStr = Array.from(newSelections.troops).sort().join(',');

            this.sameTimeForAll.set(cStr === rStr && cStr === tStr);

            // Set targets based on what has slots
            this.simpleModeTargets.set({
                construction: newSelections.construction.size > 0,
                research: newSelections.research.size > 0,
                troops: newSelections.troops.size > 0
            });
        } else {
            // Default to true for new registrations
            this.sameTimeForAll.set(true);
            this.simpleModeTargets.set({ construction: true, research: true, troops: true });
        }

        this.selections.set(newSelections);
        this.uploadedImageUrls.set(reg?.backpackImages ?? []);
        this.selectedFiles.set([]); // Reset new files on load
        this.entryMode.set('simple'); // Default to simple
    }

    applySimpleMode() {
        const input = this.timeRangeInput().trim();
        const slots = parseTimeInput(input, this.timeSlots());

        // Even if empty, we might want to apply (clearing slots) if the user intends to clear?
        // But usually text input driven. If empty and they click apply, maybe clear?
        // Let's assume if empty => empty set.

        const targets = this.simpleModeTargets();
        const slotsSet = new Set(slots);

        this.selections.update(current => {
            const next = { ...current };
            if (targets.construction) next.construction = new Set(slotsSet);
            if (targets.research) next.research = new Set(slotsSet);
            if (targets.troops) next.troops = new Set(slotsSet);
            return next;
        });

        // Give feedback? 
        // Maybe toast or just visual update.
    }

    // Old direct apply method replaced/adapted
    applyTimeRange() {
        if (this.entryMode() === 'simple') {
            this.applySimpleMode();
        } else {
            // Advanced mode usage of the quick box
            this.applySimpleMode(); // Re-use logic?
            // In advanced mode, "Same Time For All" toggle controls the scope usually,
            // but we can just use the Simple Mode logic if we expose the targets or just assume "All if sameTimeForAll check is true".
            // Actually, the plan says: "Advanced Mode: Keep 'Same time for all' toggle".
            // If we use the Quick Input in Advanced Mode, it should respect the "Same Time" toggle.

            const input = this.timeRangeInput().trim();
            const slots = parseTimeInput(input, this.timeSlots());
            const s = new Set(slots);

            if (this.sameTimeForAll()) {
                this.selections.update(c => ({
                    construction: new Set(s),
                    research: new Set(s),
                    troops: new Set(s)
                }));
            } else {
                // If unified off, Quick Entry is ambiguous. Apply to all? Apply to first?
                // Let's just Apply to All for convenience.
                this.selections.update(c => ({
                    construction: new Set(s),
                    research: new Set(s),
                    troops: new Set(s)
                }));
            }
        }
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

    // Removed local implementations of parseTimeInput, toMinutes, getCompressedSlots, formatRange 
    // in favor of imported utils.

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
            const typesToUpdate = this.sameTimeForAll() ? (['construction', 'research', 'troops'] as BoostType[]) : [type];
            const next = { ...current };

            typesToUpdate.forEach(t => {
                const set = new Set(next[t]);
                if (shouldSelect) {
                    set.add(time);
                } else {
                    set.delete(time);
                }
                next[t] = set;
            });

            return next;
        });
        this.cdr.markForCheck();
    }

    // Kept for simple toggle clicks if needed, though drag logic handles the initial click too
    toggleSlot(type: BoostType, time: string) {
        // We defer to setSlot based on current state
        const current = this.isSelected(type, time);
        this.setSlot(type, time, !current);
    }

    // Time Slots
    public timeSlots = computed(() => generateTimeSlots());

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
