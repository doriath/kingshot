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
}
