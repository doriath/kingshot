import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SvSPrepService, SvSPrepEvent, SvSPrepRegistration } from '../svs-prep.service';
import { SvsBoostGridComponent } from '../svs-boost-grid/svs-boost-grid';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { generateTimeSlots, getCompressedSlots, parseTimeInput } from '../svs-time-utils';

@Component({
  selector: 'app-admin-svs-prep-management',
  templateUrl: './admin-svs-prep-management.html',
  styleUrl: './admin-svs-prep-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule, SvsBoostGridComponent]
})
export class AdminSvsPrepManagementComponent {
  private route = inject(ActivatedRoute);
  private svsService = inject(SvSPrepService);

  // Get ID from route
  private params = toSignal(this.route.params);
  public eventId = computed(() => this.params()?.['id']);

  // Load Event
  public event$ = this.route.paramMap.pipe(
    switchMap(params => {
      const id = params.get('id');
      return id ? this.svsService.getEventById(id) : of(undefined);
    })
  );
  public event = toSignal(this.event$);

  // Load Registrations
  public registrations$ = this.route.paramMap.pipe(
    switchMap(params => {
      const id = params.get('id');
      return id ? this.svsService.getEventRegistrations(id) : of([]);
    })
  );
  public registrations = toSignal(this.registrations$, { initialValue: [] });

  public assignedUserIds = computed(() => {
    const evt = this.event();
    if (!evt || !evt.assignments) return {
      construction: new Set<string>(),
      research: new Set<string>(),
      troops: new Set<string>()
    };

    const map = {
      construction: new Set<string>(),
      research: new Set<string>(),
      troops: new Set<string>()
    };

    if (evt.assignments['construction']) Object.values(evt.assignments['construction']).forEach(uid => map.construction.add(uid));
    if (evt.assignments['research']) Object.values(evt.assignments['research']).forEach(uid => map.research.add(uid));
    if (evt.assignments['troops']) Object.values(evt.assignments['troops']).forEach(uid => map.troops.add(uid));

    return map;
  });

  public unassignedRegistrations = computed(() => {
    const regs = this.registrations();
    const assignedMap = this.assignedUserIds();
    const activeTab = this.activeScheduleTab() as 'construction' | 'research' | 'troops';

    return regs.filter(r => {
      // 1. Check if user WANTS this boost type
      const wantsBoost = r.preferences.some(p => p.boostType === activeTab && p.slots.length > 0);
      if (!wantsBoost) return false;

      // 2. Check if user is already assigned in this boost type
      const isAssigned = assignedMap[activeTab].has(r.characterId);
      return !isAssigned;
    });
  });

  public getUnassignedForType(type: 'construction' | 'research' | 'troops') {
    const regs = this.registrations();
    const assignedMap = this.assignedUserIds();
    // Returns regs NOT assigned in THIS type
    return regs.filter(r => !assignedMap[type].has(r.characterId));
  }

  public unassignedConstruction = computed(() => this.getUnassignedForType('construction'));
  public unassignedResearch = computed(() => this.getUnassignedForType('research'));
  public unassignedTroops = computed(() => this.getUnassignedForType('troops'));



  // View State
  // View State
  public view = signal<'registrations' | 'schedule'>('registrations');

  // Manual Assignment State
  public assigningSlot = signal<{ type: string, slot: string } | null>(null);
  public manualAssignmentId = signal<string | null>(null);

  // Manual Registration State
  // Manual Registration State
  public newManualName = signal('');
  public newManualTimeRange = signal('');
  public isAdding = signal(false);

  // Schedule View State
  public activeScheduleTab = signal<string>('construction');

  // Editing State
  public editingRegId = signal<string | null>(null);
  public editingSameTimeForAll = signal(true);
  public editingTimeRangeInput = signal('');

  // Time Slots (Shared with User component, duplicate for now or extract to service? extract to service better but simple enough here)
  // Time Slots (Shared with User component, duplicate for now or extract to service? extract to service better but simple enough here)
  public timeSlots = computed(() => generateTimeSlots());

  async addManualRegistration() {
    const name = this.newManualName().trim();
    const evtId = this.eventId();
    if (!name || !evtId) return;

    this.isAdding.set(true);
    try {
      // Create unique ID
      const charId = 'manual_' + Date.now();

      const preferences: any[] = [];
      const rangeInput = this.newManualTimeRange().trim();
      if (rangeInput) {
        const slots = parseTimeInput(rangeInput, this.timeSlots());
        if (slots.length === 0) {
          alert('Invalid time range. No slots matched.');
          this.isAdding.set(false);
          return;
        }
        preferences.push({ boostType: 'construction', slots: slots });
        preferences.push({ boostType: 'research', slots: slots });
        preferences.push({ boostType: 'troops', slots: slots });
      }

      const reg: SvSPrepRegistration = {
        eventId: evtId,
        userId: 'manual', // Special user ID
        characterId: charId,
        characterName: name,
        isManual: true,
        preferences: preferences,
        updatedAt: new Date(),
        characterVerified: true // Manual ones are trusted/verified by admin
      };
      await this.svsService.saveRegistration(reg);
      this.newManualName.set('');
      this.newManualTimeRange.set('');
    } catch (e) {
      console.error(e);
      alert('Failed to add');
    } finally {
      this.isAdding.set(false);
    }
  }

  async deleteReg(reg: SvSPrepRegistration) {
    if (!confirm(`Delete registration for ${reg.characterName}?`)) return;
    try {
      // We need to pass eventId and characterId
      // reg.characterId might be missing in some old interface but it's required in new.
      if (reg.eventId && reg.characterId) {
        await this.svsService.deleteRegistration(reg.eventId, reg.characterId);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to delete');
    }
  }

  toggleEdit(regId: string) {
    if (this.editingRegId() === regId) {
      this.editingRegId.set(null);
    } else {
      this.editingRegId.set(regId);

      // Initialize edit state
      const reg = this.registrations().find(r => r.id === regId);
      if (reg) {
        const c = this.getSlotsFor(reg, 'construction');
        const r = this.getSlotsFor(reg, 'research');
        const t = this.getSlotsFor(reg, 'troops');

        const cStr = Array.from(c).sort().join(',');
        const rStr = Array.from(r).sort().join(',');
        const tStr = Array.from(t).sort().join(',');

        this.editingSameTimeForAll.set(cStr === rStr && cStr === tStr);
        this.editingTimeRangeInput.set('');
      }
    }
  }

  // Helpers for Grid
  getSlotsFor(reg: SvSPrepRegistration, type: 'construction' | 'research' | 'troops'): Set<string> {
    const pref = reg.preferences.find(p => p.boostType === type);
    return new Set(pref?.slots || []);
  }

  async updateSlots(reg: SvSPrepRegistration, type: 'construction' | 'research' | 'troops', newSlots: Set<string>) {
    // Merge update
    const prefs = reg.preferences.filter(p => p.boostType !== type);
    if (newSlots.size > 0) {
      prefs.push({
        boostType: type,
        slots: Array.from(newSlots).sort()
      });
    }

    const updatedReg: SvSPrepRegistration = {
      ...reg,
      preferences: prefs,
      updatedAt: new Date()
    };

    // Optimistic ? No, wait for Firestore stream to update UI.
    // But we need to save.
    await this.svsService.saveRegistration(updatedReg);
  }

  async updateSlotsUnified(reg: SvSPrepRegistration, newSlots: Set<string>) {
    const types: ('construction' | 'research' | 'troops')[] = ['construction', 'research', 'troops'];
    const sortedSlots = Array.from(newSlots).sort();

    const prefs = reg.preferences.filter(p => !types.includes(p.boostType)); // Keep others if any? Currently only 3 types exist.

    types.forEach(t => {
      prefs.push({
        boostType: t,
        slots: [...sortedSlots]
      });
    });

    const updatedReg: SvSPrepRegistration = {
      ...reg,
      preferences: prefs,
      updatedAt: new Date()
    };

    await this.svsService.saveRegistration(updatedReg);
  }

  async applyEditingTimeRange(reg: SvSPrepRegistration) {
    const input = this.editingTimeRangeInput().trim();
    if (!input) return;

    // Apply to all types (Unified)
    const slots = parseTimeInput(input, this.timeSlots());
    if (slots.length === 0) {
      alert('Could not parse time range.');
      return;
    }

    const slotsSet = new Set(slots);
    await this.updateSlotsUnified(reg, slotsSet);

    this.editingSameTimeForAll.set(true);
    this.editingTimeRangeInput.set(''); // Clear after apply? Or keep? Clearing is usually better feeback.
  }
  getCompressedSlots(slots: string[]): string {
    return getCompressedSlots(slots);
  }

  // --- Scheduling Logic ---

  async runSchedule() {
    const event = this.event();
    const regs = this.registrations();
    if (!event || !event.id) return;

    const currentType = this.activeScheduleTab() as 'construction' | 'research' | 'troops';
    const typeLabel = currentType.charAt(0).toUpperCase() + currentType.slice(1);

    if (!confirm(`Run schedule for ${typeLabel} ONLY? This will assign players to empty slots based on preferences.`)) return;

    const assignments = event.assignments ? JSON.parse(JSON.stringify(event.assignments)) : {};

    // Initialize if missing
    if (!assignments[currentType]) assignments[currentType] = {};

    const slots = this.timeSlots();

    // Iterate ONLY the active boost type
    const assignedInThisType = new Set<string>();
    if (assignments[currentType]) {
      Object.values(assignments[currentType]).forEach((cid) => assignedInThisType.add(cid as string));
    }

    // Iterate slots
    for (const slot of slots) {
      // Skip if already assigned
      if (assignments[currentType][slot]) continue;

      // Find candidates
      const candidates = regs.filter(r => {
        // Must NOT be assigned in THIS type
        if (assignedInThisType.has(r.characterId)) return false;

        const pref = r.preferences.find(p => p.boostType === currentType);
        return pref?.slots.includes(slot);
      });

      if (candidates.length === 0) continue;

      // Sort candidates
      // Prioritize people who have FEWER options? Or just random/stable ID?
      // For now, stable sort by ID.
      candidates.sort((a, b) => a.characterId.localeCompare(b.characterId));

      // Pick best candidate
      const chosen = candidates[0];
      assignments[currentType][slot] = chosen.characterId;
      assignedInThisType.add(chosen.characterId);
    }

    // Save
    try {
      await this.svsService.updateEvent(event.id, { assignments });
      alert(`Schedule for ${typeLabel} updated!`);
    } catch (e) {
      console.error(e);
      alert('Failed to save schedule');
    }
  }

  async unassign(type: string, slot: string) {
    const event = this.event();
    if (!event || !event.id || !event.assignments) return;

    if (!confirm(`Unassign slot ${slot}?`)) return;

    // Deep copy
    const assignments = JSON.parse(JSON.stringify(event.assignments));
    if (assignments[type] && assignments[type][slot]) {
      delete assignments[type][slot];
      try {
        await this.svsService.updateEvent(event.id, { assignments });
      } catch (e) {
        console.error(e);
        alert('Failed to unassign');
      }
    }
  }

  async clearDay(type: string) {
    const event = this.event();
    if (!event || !event.id || !event.assignments) return;

    if (!confirm(`Clear ALL assignments for ${type}? This cannot be undone.`)) return;

    // Deep copy
    const assignments = JSON.parse(JSON.stringify(event.assignments));
    if (assignments[type]) {
      // Clear the entire object for this type
      assignments[type] = {};
      try {
        await this.svsService.updateEvent(event.id, { assignments });
      } catch (e) {
        console.error(e);
        alert('Failed to clear assignments');
      }
    }
  }

  // Manual Slot Assignment
  startAssigning(type: string, slot: string) {
    this.assigningSlot.set({ type, slot });
    this.manualAssignmentId.set(null);
  }

  cancelAssigning() {
    this.assigningSlot.set(null);
    this.manualAssignmentId.set(null);
  }

  async saveManualAssignment() {
    const slotInfo = this.assigningSlot();
    const charId = this.manualAssignmentId();
    const event = this.event();

    if (!slotInfo || !charId || !event || !event.id) return;

    const assignments = event.assignments ? JSON.parse(JSON.stringify(event.assignments)) : {};
    if (!assignments[slotInfo.type]) assignments[slotInfo.type] = {};

    assignments[slotInfo.type][slotInfo.slot] = charId;

    try {
      await this.svsService.updateEvent(event.id, { assignments });
      this.cancelAssigning();
    } catch (e) {
      console.error(e);
      alert('Failed to manual assign');
    }
  }

  getAssignedName(type: string, slot: string): string | null {
    const evt = this.event();
    if (!evt || !evt.assignments || !evt.assignments[type]) return null;

    const charId = evt.assignments[type][slot];
    if (!charId) return null;

    const reg = this.registrations().find(r => r.characterId === charId);
    return reg ? (reg.characterName || charId) : 'Unknown (' + charId + ')';
  }
}
