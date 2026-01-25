import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SwordlandService, SwordlandParticipant, SwordlandEvent, SwordlandBuilding } from '../../swordland-event/swordland.service';
import { AlliancesService, AllianceMember } from '../alliances.service';
import { AdminBreadcrumbService } from '../../admin-layout/admin-breadcrumb.service';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-swordland-event-management',
  template: `
    <div class="manage-container" *ngIf="event() as evt">
      <header>
        <h1>⚔️ Swordland Manager</h1>
        <div class="subtitle">[{{ evt.allianceName }}] Server #{{ evt.server }} - Legion {{ evt.legion }}</div>
        <div class="date">{{ evt.date.toDate() | date:'medium' }}</div>
      </header>
  
      <div class="inline-add-container">
        <h3>Add Participant</h3>
        <div class="add-form">
            <div class="form-group search-group">
                <label>Alliance Member</label>
                <div class="search-wrapper">
                    <input [ngModel]="searchTerm()" 
                           (ngModelChange)="searchTerm.set($event); onSearchInput()"
                           placeholder="Search name..." class="search-input" 
                           (focus)="onInputFocus()" 
                           (blur)="onInputBlur()">
                    <div class="search-results" *ngIf="(searchTerm() || inputFocused()) && !selectedMember" (mousedown)="$event.preventDefault()">
                        @for (member of filteredMembers(); track member.characterId) {
                        <div class="search-item" (click)="selectMember(member)">
                            {{ member.name }} ({{ member.power | number }})
                        </div>
                        }
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label>Squad Score</label>
                <input type="number" [(ngModel)]="formSquadScore" placeholder="Score">
            </div>

            <div class="form-group">
                <label>Role (Optional)</label>
                <select [(ngModel)]="formRole">
                    <option value="unassigned">Unassigned</option>
                    <option value="attacker">Attacker</option>
                    <option value="defender">Defender</option>
                </select>
            </div>

            <div class="form-group">
                <label>Building (Optional)</label>
                <select [(ngModel)]="formBuilding">
                    <option [ngValue]="undefined">None</option>
                    @for (b of buildings; track b) {
                        <option [value]="b">{{ b }}</option>
                    }
                </select>
            </div>

            <button class="add-btn" (click)="addParticipant()" [disabled]="!selectedMember">Add</button>
        </div>
      </div>
  
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Character</th>
              <th>Role</th>
              <th>Squad Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (row of participants(); track row.characterId) {
            <tr>
              <td>
                <div class="char-name">{{ row.characterName }}</div>
                <div class="char-id">{{ row.characterId }}</div>
              </td>
              <td>
                <span class="role-badge" [class]="row.role">{{ row.role | uppercase }}</span>
                <div class="building-badge" *ngIf="row.building">{{ row.building }}</div>
              </td>
              <td>
                <span class="score">{{ row.squadScore | number }}</span>
              </td>
              <td class="actions-cell">
                <button class="edit-btn" (click)="editParticipant(row)" title="Edit">✏️</button>
                <button class="delete-btn" (click)="removeParticipant(row)" title="Remove">🗑️</button>
              </td>
            </tr>
            } @empty {
            <tr>
              <td colspan="4" class="empty-state">No participants added yet.</td>
            </tr>
            }
          </tbody>
        </table>
      </div>
  
      <!-- Edit Modal (Only for editing existing) -->
      <div class="modal-backdrop" *ngIf="showEditModal">
        <div class="modal">
          <h3>Edit {{ editingParticipant?.characterName }}</h3>
          
          <div class="form-group">
            <label>Role</label>
            <select [(ngModel)]="formRole">
              <option value="unassigned">Unassigned</option>
              <option value="attacker">Attacker</option>
              <option value="defender">Defender</option>
            </select>
          </div>

          <div class="form-group">
            <label>Building (Optional)</label>
            <select [(ngModel)]="formBuilding">
                <option [ngValue]="undefined">None</option>
                @for (b of buildings; track b) {
                    <option [value]="b">{{ b }}</option>
                }
            </select>
          </div>
  
          <div class="form-group">
            <label>Squad Score</label>
            <input type="number" [(ngModel)]="formSquadScore">
          </div>
  
          <div class="modal-actions">
            <button class="save-btn" (click)="saveEdit()">Save</button>
            <button class="cancel-btn" (click)="closeEditModal()">Cancel</button>
          </div>
        </div>
      </div>
  
    </div>
    <div *ngIf="!event()" class="loading">Loading Event Data...</div>
  `,
  styles: [`
    .manage-container { padding: 2rem; color: #eee; max-width: 1000px; margin: 0 auto; }
    
    .breadcrumbs { color: #aaa; margin-bottom: 1rem; font-size: 0.9rem; }
    .breadcrumbs a { color: #aaa; text-decoration: none; }
    .breadcrumbs a:hover { color:white; }
    
    header { margin-bottom: 2rem; border-bottom: 1px solid #444; padding-bottom: 1rem; }
    h1 { margin: 0; color: #ffca28; }
    .subtitle { color: #888; font-size: 1.1rem; margin-top: 0.5rem; }
    .date { color: #aaa; font-size: 0.9rem; margin-top: 0.2rem; }

    .inline-add-container {
        background: #2a2a2a; padding: 1.5rem; border-radius: 8px; border: 1px solid #444; margin-bottom: 2rem;
    }
    .inline-add-container h3 { margin-top: 0; margin-bottom: 1rem; color: #81c784; font-size: 1.1rem; }
    .add-form { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
    
    .search-group { flex-grow: 1; min-width: 250px; position: relative; }
    .search-wrapper { position: relative; }
    .search-results {
      position: absolute; top: 100%; left: 0; width: 100%;
      max-height: 200px; overflow-y: auto; background: #1a1a1a; border: 1px solid #444;
      border-radius: 4px; z-index: 10;
    }
    
    .add-btn { background: #4caf50; color: white; border: none; padding: 0.6rem 1.5rem; border-radius: 4px; font-weight: bold; cursor: pointer; height: 38px; }
    .add-btn:disabled { background: #444; color: #888; cursor: not-allowed; }

    .table-container { background: #222; border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 1rem; background: #333; color: #aaa; font-weight: bold; font-size: 0.9rem; }
    td { padding: 1rem; border-bottom: 1px solid #333; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    
    .char-name { font-weight: bold; color: white; }
    .char-id { color: #888; font-size: 0.8rem; font-family: monospace; }
    
    .role-badge { padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold; }
    .role-badge.attacker { background: rgba(244, 67, 54, 0.2); color: #e57373; }
    .role-badge.defender { background: rgba(33, 150, 243, 0.2); color: #64b5f6; }
    .building-badge {
        margin-top: 0.3rem; font-size: 0.75rem; color: #81c784; background: rgba(129, 199, 132, 0.1);
        display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px;
    }
    
    .score { font-family: monospace; color: #ffb74d; font-size: 1.1rem; }

    .actions-cell { display: flex; gap: 0.5rem; }
    .actions-cell button { border: none; background: #444; width: 32px; height: 32px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: background 0.2s; }
    .edit-btn:hover { background: #666; }
    .delete-btn:hover { background: #e57373; color: white; }
    
    .empty-state { text-align: center; color: #666; font-style: italic; padding: 3rem; }
    .loading { text-align: center; margin-top: 3rem; color: #888; }
    
    /* Modal */
    .modal-backdrop { 
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; 
    }
    .modal {
        background: #2a2a2a; padding: 2rem; border-radius: 8px; width: 450px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .modal h3 { margin-top: 0; color: #fff; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1.2rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; color: #ccc; }
    .form-group select, .form-group input { width: 100%; padding: 0.6rem; background: #111; border: 1px solid #444; color: white; border-radius: 4px; }
    .static-value { padding: 0.6rem; background: #1a1a1a; color: #aaa; border-radius: 4px; }
    
    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }
    .modal-actions button { padding: 0.6rem 1.2rem; cursor: pointer; border-radius: 4px; border:none; font-weight: bold; }
    .save-btn { background: #4caf50; color: white; }
    .save-btn:disabled { background: #555; cursor: not-allowed; }
    .cancel-btn { background: #444; color: white; }

    .search-results {
      max-height: 150px; overflow-y: auto; background: #1a1a1a; border: 1px solid #444;
      margin-top: 0.2rem; border-radius: 4px;
    }
    .search-item { padding: 0.5rem; cursor: pointer; color: #ccc; }
    .search-item:hover { background: #333; color: white; }
    .selected-member { margin-top: 0.5rem; color: #81c784; font-size: 0.9rem; }
  `],
  imports: [CommonModule, FormsModule]
})
export class SwordlandEventManagementComponent {
  private route = inject(ActivatedRoute);
  private swordlandService = inject(SwordlandService);
  private alliancesService = inject(AlliancesService);
  private breadcrumbService = inject(AdminBreadcrumbService);

  public eventId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));

  public event = toSignal<SwordlandEvent | undefined>(
    this.route.paramMap.pipe(
      map(p => p.get('id')),
      switchMap(id => {
        if (!id) return of(undefined);
        return this.swordlandService.getEventById(id).pipe(
          map(evt => {
            if (evt) {
              this.breadcrumbService.setLabel(evt.id!, `Swordland (Legion ${evt.legion})`);
              // We also need alliance label, but we don't have alliance object loaded here yet?
              // Actually we assume it might be loaded or we can fetch it. Alliance Name is on the event object!
              // evt.allianceName is available. We assume evt.allianceId is valid.
              if (evt.allianceId && evt.allianceName) {
                // We might not have the TAG here, so we use Name.
                this.breadcrumbService.setLabel(evt.allianceId, evt.allianceName);
              }
            }
            return evt;
          })
        );
      })
    )
  );

  public allianceMembers = toSignal(
    toObservable(this.event).pipe(
      switchMap((evt: SwordlandEvent | undefined) => {
        if (!evt) return of([]);
        return this.alliancesService.getAllianceMembers(evt.allianceId);
      })
    ),
    { initialValue: [] as AllianceMember[] }
  );

  public participants = computed(() => {
    const p = this.event()?.participants || [];
    return [...p].sort((a, b) => (b.squadScore || 0) - (a.squadScore || 0));
  });

  // State
  public showEditModal = false;
  public editingParticipant: SwordlandParticipant | null = null;

  // Add Form State
  // Add Form State
  public searchTerm = signal('');
  public selectedMember: AllianceMember | null = null;
  public formRole: 'attacker' | 'defender' | 'unassigned' = 'defender'; // Default to defender
  public formSquadScore: number = 0;
  public formBuilding: SwordlandBuilding | undefined = undefined;

  public buildings: SwordlandBuilding[] = [
    'Sanctum', 'Abbey Top', 'Abbey Bottom', 'Abbey Left', 'Abbey Right', 'Belltower', 'Royal Stables'
  ];

  public inputFocused = signal(false);

  public filteredMembers = computed(() => {
    const term = this.searchTerm().toLowerCase();

    // Already participating members
    const currentIds = new Set(this.participants().map(p => p.characterId));
    return this.allianceMembers().filter(m =>
      !currentIds.has(m.characterId) &&
      (!term || m.name.toLowerCase().includes(term) || m.characterId.includes(term))
    ).slice(0, 10);
  });

  public onSearchInput() {
    this.selectedMember = null; // Clear selection on type
  }

  public onInputFocus() {
    this.inputFocused.set(true);
  }

  public onInputBlur() {
    this.inputFocused.set(false);
  }

  public selectMember(m: AllianceMember) {
    this.selectedMember = m;
    this.searchTerm.set(m.name); // Show name in input
  }

  public async addParticipant() {
    if (!this.selectedMember) return;
    const evt = this.event();
    if (!evt || !evt.id) return;

    const newParticipant: SwordlandParticipant = {
      characterId: this.selectedMember.characterId,
      characterName: this.selectedMember.name,
      role: this.formRole,
      squadScore: this.formSquadScore,
    };

    if (this.formBuilding) {
      newParticipant.building = this.formBuilding;
    }

    const newParticipants: SwordlandParticipant[] = [...evt.participants, newParticipant];

    try {
      await this.swordlandService.updateEventParticipants(evt.id, newParticipants);
      // Reset form
      this.searchTerm.set('');
      this.selectedMember = null;
      this.formRole = 'defender'; // Reset to default
      this.formSquadScore = 0;
      this.formBuilding = undefined;
    } catch (err) {
      console.error(err);
      alert('Failed to add participant.');
    }
  }

  // Edit Logic
  public editParticipant(p: SwordlandParticipant) {
    this.editingParticipant = p;
    this.formRole = p.role;
    this.formSquadScore = p.squadScore || 0;
    this.formBuilding = p.building;
    this.showEditModal = true;
  }

  public closeEditModal() {
    this.showEditModal = false;
    this.editingParticipant = null;
  }

  public async saveEdit() {
    if (!this.editingParticipant) return;
    const evt = this.event();
    if (!evt || !evt.id) return;

    const newParticipants = evt.participants.map(p => {
      if (p.characterId === this.editingParticipant!.characterId) {
        const updated: SwordlandParticipant = {
          ...p,
          role: this.formRole,
          squadScore: this.formSquadScore,
        };
        // Explicitly handle building: if defined add it, else ensure it's removed (by not adding it to this new object if we were building from scratch, but since we spread ...p, we need to delete or override)
        // Actually, since ...p might have 'building', and if formBuilding is undefined, we want to remove it.

        if (this.formBuilding) {
          updated.building = this.formBuilding;
        } else {
          delete updated.building;
        }
        return updated;
      }
      return p;
    });

    try {
      await this.swordlandService.updateEventParticipants(evt.id, newParticipants);
      this.closeEditModal();
    } catch (err) {
      console.error(err);
      alert('Failed to update participant.');
    }
  }
  public async removeParticipant(p: SwordlandParticipant) {
    if (!confirm(`Remove ${p.characterName} from event?`)) return;
    const evt = this.event();
    if (!evt || !evt.id) return;

    const newParticipants = evt.participants.filter(x => x.characterId !== p.characterId);

    try {
      await this.swordlandService.updateEventParticipants(evt.id, newParticipants);
    } catch (err) {
      console.error(err);
      alert('Failed to remove participant.');
    }
  }
}
