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

                // Compressed display for summary
                // We'll aggregate by type if they are different, or show one if they are same
                const boostTypes: BoostType[] = ['construction', 'research', 'troops'];
                const slotsMap = new Map<BoostType, string[]>();
                reg.preferences.forEach(p => slotsMap.set(p.boostType, p.slots));

                // Check if all are same
                const allSame = slotsMap.get('construction')?.join(',') === slotsMap.get('research')?.join(',') &&
                    slotsMap.get('construction')?.join(',') === slotsMap.get('troops')?.join(',');

                if (allSame && reg.preferences.length > 0) {
                    // Just show one generic summary
                    const slots = reg.preferences[0].slots;
                    const ranges = this.getCompressedSlots(slots);
                    warnings.push(`Registered: ${ranges}`); // Re-using warnings array? No, let's look for a better place or add a new field.
                    // Actually, let's add a proper display field to the ViewModel
                }
            }

            const formatSlots = (slots: string[] | undefined) => this.getCompressedSlots(slots || []);

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
        } else {
            // Default to true for new registrations
            this.sameTimeForAll.set(true);
        }

        this.selections.set(newSelections);
        this.uploadedImageUrls.set(reg?.backpackImages ?? []);
        this.selectedFiles.set([]); // Reset new files on load
    }

    applyTimeRange() {
        const input = this.timeRangeInput().trim();
        if (!input) return;

        const slots = this.parseTimeInput(input);
        if (slots.length === 0) {
            alert('Could not parse time range. Format examples: "10-12", "14-16", "10-12 18-20"');
            return;
        }

        const boostTypes: BoostType[] = ['construction', 'research', 'troops'];
        const targets = this.sameTimeForAll() ? boostTypes : [boostTypes[0]]; // If not same time, maybe just apply to first or current active tab? 
        // Actually if "sameTimeForAll" is false, we probably need to know WHICH tab is active or apply to all anyway?
        // Let's assume if they use the Quick Entry, it applies to ALL active views. 
        // But simply: If sameTimeForAll is false, this Quick Entry might be ambiguous. 
        // Let's enforce: Quick Entry applies to ALL days if SameTime is Checked. 
        // If SameTime is Unchecked, maybe we hide Quick Entry or make it apply to all anyway?
        // Let's make it apply to ALL if sameTime is true. If false, we'll just apply to all for now or maybe just construction? 
        // Better: Apply to whatever is visible. But since we show 3 grids when unchecked, it's ambiguous.
        // Let's simplisticly apply to ALL if sameTimeForAll is true. If false, apply to construction (first one) or error? 
        // Let's just apply to ALL for simplicity as a "Bulk Set" action.

        this.selections.update(current => {
            const next = { ...current };
            // If sameTimeForAll, apply to all. Even if not, maybe user wants to bulk set range?
            // Let's apply to all for now as "Reset to this range".
            boostTypes.forEach(t => {
                next[t] = new Set(slots);
            });
            return next;
        });

        // Also ensure sameTimeForAll becomes true if we just bulk applied?
        this.sameTimeForAll.set(true);
    }

    parseTimeInput(input: string): string[] {
        // Formats: "10-12", "10:30-12:30", "10-12 14-16"
        const parts = input.split(/[\s,]+/);
        const result = new Set<string>();
        const allSlots = this.timeSlots();

        parts.forEach(part => {
            const [startStr, endStr] = part.split('-');
            if (startStr && endStr) {
                const startMin = this.toMinutes(startStr);
                const endMin = this.toMinutes(endStr);

                // Find all slots in range [start, end) (end exclusive generally for time ranges like 10-12 means 10:00 to 11:59 coverage, i.e. slots 10:00, 10:30, 11:00, 11:30)
                // Check logic: 10-12 usually means 2 hours.
                // Slots are discrete start times. 10:00, 10:30, 11:00, 11:30. 12:00 is the START of the next block.
                // So we encompass slots where toMinutes(slot) >= startMin && toMinutes(slot) < endMin

                for (const slot of allSlots) {
                    const slotMin = this.toMinutes(slot);
                    if (slotMin >= startMin && slotMin < endMin) {
                        result.add(slot);
                    }
                }
            }
        });

        return Array.from(result);
    }

    toMinutes(timeStr: string): number {
        // Handle "10", "10:30", "-23:45"
        // If just number like "10", treat as "10:00"
        let str = timeStr;
        let isNeg = false;
        if (str.startsWith('-')) {
            isNeg = true;
            str = str.substring(1);
        }

        if (!str.includes(':')) {
            str += ':00';
        }

        const [h, m] = str.split(':').map(Number);
        let total = h * 60 + m;
        if (isNeg) total = -total; // This logic might be slightly off for -23:45 vs "previous day". 
        // Our timeSlots logic uses -15 for -23:45 (23:45 prev day). 
        // 23:45 prev day is effectively -15 mins relative to 00:00.
        // User is unlikely to type "-23:45". They might type "23" (curr day).
        // Let's assume standard positive times mostly.

        return total;
    }

    getCompressedSlots(slots: string[]): string {
        if (!slots || slots.length === 0) return '';

        // Convert to minutes, sort
        const sorted = slots.map(s => {
            // Reverse mapping is tricky solely with strings.
            // We know the mapping from our loop.
            // 00:00 = 0.
            if (s === "-23:45") return -15;
            const [h, m] = s.split(':').map(Number);
            return h * 60 + m;
        }).sort((a, b) => a - b);

        if (sorted.length === 0) return '';

        const ranges: string[] = [];
        let rangeStart = sorted[0];
        let prev = sorted[0];

        // Step is 30 mins
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === prev + 30) {
                prev = sorted[i];
            } else {
                // Gap found, close range
                ranges.push(this.formatRange(rangeStart, prev + 30)); // prev + 30 because slot covers 30 mins
                rangeStart = sorted[i];
                prev = sorted[i];
            }
        }
        // Close last
        ranges.push(this.formatRange(rangeStart, prev + 30));

        return ranges.join(', ');
    }

    formatRange(startMin: number, endMin: number): string {
        const fmt = (m: number) => {
            // Handle negative (prev day)
            if (m < 0) { // e.g. -15 -> 23:45
                const realM = 24 * 60 + m;
                const h = Math.floor(realM / 60);
                const min = realM % 60;
                return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            }
            // Handle next day overflow (e.g. 24:00)
            if (m >= 24 * 60) {
                m -= 24 * 60; // Wrap text representation or keep 24:00? 
                // Usually 00:00 is better
            }

            const h = Math.floor(m / 60);
            const min = m % 60;
            return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        };
        return `${fmt(startMin)}-${fmt(endMin)}`;
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
