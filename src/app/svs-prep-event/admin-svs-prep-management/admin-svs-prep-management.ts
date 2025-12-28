import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SvSPrepService, SvSPrepEvent, SvSPrepRegistration } from '../svs-prep.service';
import { SvsBoostGridComponent } from '../svs-boost-grid/svs-boost-grid';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';

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
    // For general list: show players assigned to NOTHING? Or allow them to appear if they missed ANY preference?
    // Let's stick effectively to "Partial unassigned" list might be too huge.
    // "Unassigned Players" usually implies "Fully Unassigned".
    // A player is fully unassigned if they are not in construction AND not in research AND not in troops.

    return regs.filter(r =>
      !assignedMap.construction.has(r.characterId) &&
      !assignedMap.research.has(r.characterId) &&
      !assignedMap.troops.has(r.characterId)
    );
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
  public newManualName = signal('');
  public isAdding = signal(false);

  // Editing State
  public editingRegId = signal<string | null>(null);

  // Time Slots (Shared with User component, duplicate for now or extract to service? extract to service better but simple enough here)
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

  async addManualRegistration() {
    const name = this.newManualName().trim();
    const evtId = this.eventId();
    if (!name || !evtId) return;

    this.isAdding.set(true);
    try {
      // Create unique ID
      const charId = 'manual_' + Date.now();
      const reg: SvSPrepRegistration = {
        eventId: evtId,
        userId: 'manual', // Special user ID
        characterId: charId,
        characterName: name,
        isManual: true,
        preferences: [],
        updatedAt: new Date(),
        characterVerified: true // Manual ones are trusted/verified by admin
      };
      await this.svsService.saveRegistration(reg);
      this.newManualName.set('');
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

  // --- Scheduling Logic ---

  async runSchedule() {
    const event = this.event();
    const regs = this.registrations();
    if (!event || !event.id) return;

    if (!confirm('This will assign players to empty slots based on their preferences. Continue?')) return;

    const assignments = event.assignments ? JSON.parse(JSON.stringify(event.assignments)) : {};
    const boostTypes: ('construction' | 'research' | 'troops')[] = ['construction', 'research', 'troops'];

    // Initialize assignments structure if missing
    boostTypes.forEach(t => {
      if (!assignments[t]) assignments[t] = {};
    });

    const slots = this.timeSlots();

    // Iterate boosts
    for (const type of boostTypes) {
      const assignedInThisType = new Set<string>();
      if (assignments[type]) {
        Object.values(assignments[type]).forEach((cid) => assignedInThisType.add(cid as string));
      }

      // Iterate slots
      for (const slot of slots) {
        // Skip if already assigned
        if (assignments[type][slot]) continue;

        // Find candidates
        const candidates = regs.filter(r => {
          // Must NOT be assigned in THIS type
          if (assignedInThisType.has(r.characterId)) return false;

          const pref = r.preferences.find(p => p.boostType === type);
          return pref?.slots.includes(slot);
        });

        if (candidates.length === 0) continue;

        // Sort candidates
        // Prioritize people who have FEWER options? Or just random/stable ID?
        // For now, stable sort by ID.
        candidates.sort((a, b) => a.characterId.localeCompare(b.characterId));

        // Pick best candidate
        const chosen = candidates[0];
        assignments[type][slot] = chosen.characterId;
        assignedInThisType.add(chosen.characterId);
      }
    }

    // Save
    try {
      await this.svsService.updateEvent(event.id, { assignments });
      alert('Schedule updated!');
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
