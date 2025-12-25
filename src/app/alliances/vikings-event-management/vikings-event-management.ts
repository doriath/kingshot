import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VikingsService, VikingsEventView, CharacterAssignment, VikingsRegistration } from '../../vikings-event/vikings.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of, combineLatest } from 'rxjs';

interface ManagementRow {
    assignment: CharacterAssignment;
    registration?: VikingsRegistration;
    hasDiff: boolean; // True if registration differs from assignment
}

@Component({
    selector: 'app-vikings-event-management',
    template: `
        <div class="manage-container" *ngIf="event() as evt">
            <header>
                <div class="breadcrumbs">
                    <a routerLink="/admin/alliances">Alliances</a> &gt; 
                    <span>Events</span> &gt;
                    <span>Manage</span>
                </div>
                <h1>⚔️ Manage Assignments: {{ evt.date.toDate() | date:'medium' }}</h1>
                <div class="subtitle">[{{ evt.allianceTag }}] Server #{{ evt.server }}</div>
            </header>

            <div class="toolbar">
                <button class="tool-btn add-btn" (click)="showAddModal = true">➕ Add Character</button>
                <button class="tool-btn sync-btn" (click)="acceptAllRegs()">📥 Accept All Differences</button>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Character</th>
                            <th>Power</th>
                            <th>Current Assignment</th>
                            <th>Registration (User Submitted)</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @for (row of rows(); track row.assignment.characterId) {
                        <tr [class.has-diff]="row.hasDiff">
                            <td>
                                <div class="char-name">{{ row.assignment.characterName }}</div>
                                <div class="char-id">{{ row.assignment.characterId }}</div>
                            </td>
                            <td>{{ row.assignment.powerLevel | number }}</td>
                            <td>
                                <div class="status-pill" [class]="row.assignment.status">
                                    {{ row.assignment.status | uppercase }}
                                </div>
                                <div class="marches">Marches: {{ row.assignment.marchesCount }}</div>
                            </td>
                            <td>
                                @if (row.registration) {
                                    <div class="reg-info">
                                        <div class="status-pill" [class]="row.registration.status">
                                            {{ row.registration.status | uppercase }}
                                        </div>
                                        <div class="marches">Marches: {{ row.registration.marchesCount }}</div>
                                        <div class="timestamp">
                                            {{ row.registration.updatedAt.toDate() | date:'short' }}
                                        </div>
                                    </div>
                                } @else {
                                    <span class="no-reg">No Registration</span>
                                }
                            </td>
                            <td class="actions-cell">
                                <button *ngIf="row.hasDiff" class="accept-btn" (click)="acceptRegistration(row)" title="Accept Registration">📥</button>
                                <button class="edit-btn" (click)="editRow(row)" title="Edit">✏️</button>
                                <button class="delete-btn" (click)="deleteRow(row)" title="Remove">🗑️</button>
                            </td>
                        </tr>
                        }
                    </tbody>
                </table>
            </div>
            
            <!-- Comparison/Edit Modal could go here, simplifying to inline alerts/prompts for MVP or simple edit modal -->
             <div class="modal-backdrop" *ngIf="editingRow">
                <div class="modal">
                    <h3>Edit Assignment: {{ editingRow.assignment.characterName }}</h3>
                    <div class="form-group">
                        <label>Status</label>
                        <select [(ngModel)]="editStatus">
                            <option value="online">ONLINE</option>
                            <option value="offline_empty">OFFLINE (Empty)</option>
                            <option value="not_available">NOT AVAILABLE</option>
                            <option value="unknown">UNKNOWN</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Marches Count</label>
                        <input type="number" [(ngModel)]="editMarches">
                    </div>
                     <div class="form-group">
                        <label>Power</label>
                        <input type="number" [(ngModel)]="editPower">
                    </div>
                    <div class="modal-actions">
                        <button (click)="saveEdit()">Save</button>
                        <button (click)="editingRow = null">Cancel</button>
                    </div>
                </div>
            </div>

            <div class="modal-backdrop" *ngIf="showAddModal">
                <div class="modal">
                    <h3>Add Character to Event</h3>
                    <div class="form-group">
                        <label>Name</label>
                        <input [(ngModel)]="newCharName">
                    </div>
                    <div class="form-group">
                        <label>ID</label>
                        <input [(ngModel)]="newCharId">
                    </div>
                    <div class="form-group">
                        <label>Power</label>
                        <input type="number" [(ngModel)]="newCharPower">
                    </div>
                    <div class="modal-actions">
                        <button (click)="addCharacter()">Add</button>
                        <button (click)="showAddModal = false">Cancel</button>
                    </div>
                </div>
            </div>

        </div>
        <div *ngIf="!event()" class="loading">Loading Event Data...</div>
    `,
    styles: [`
        .manage-container { padding: 2rem; color: #eee; max-width: 1200px; margin: 0 auto; }
        .breadcrumbs { color: #aaa; margin-bottom: 1rem; font-size: 0.9rem; }
        .breadcrumbs a { color: #aaa; text-decoration: none; }
        .breadcrumbs a:hover { color:white; }
        
        header { margin-bottom: 2rem; border-bottom: 1px solid #444; padding-bottom: 1rem; }
        h1 { margin: 0; color: #ffca28; }
        .subtitle { color: #888; font-size: 1.1rem; margin-top: 0.5rem; }

        .toolbar { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .tool-btn { border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .add-btn { background: #4caf50; color: white; }
        .sync-btn { background: #2196f3; color: white; }

        .table-container { background: #222; border-radius: 8px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 1rem; background: #333; color: #aaa; font-weight: bold; font-size: 0.9rem; }
        td { padding: 1rem; border-bottom: 1px solid #333; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        
        .char-name { font-weight: bold; color: white; }
        .char-id { color: #888; font-size: 0.8rem; font-family: monospace; }
        
        .status-pill {
            display: inline-block; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold; margin-bottom: 0.3rem;
        }
        .status-pill.online { background: rgba(76, 175, 80, 0.2); color: #81c784; }
        .status-pill.offline_empty { background: rgba(255, 152, 0, 0.2); color: #ffb74d; }
        .status-pill.not_available { background: rgba(244, 67, 54, 0.2); color: #e57373; }
        .status-pill.unknown { background: #444; color: #aaa; }

        .marches { font-size: 0.85rem; color: #ddd; }
        .timestamp { font-size: 0.75rem; color: #888; margin-top: 0.2rem; }
        .no-reg { color: #666; font-style: italic; font-size: 0.9rem; }

        .has-diff { background: rgba(33, 150, 243, 0.05); }
        .has-diff .reg-info { border: 1px solid #2196f3; padding: 0.5rem; border-radius: 4px; background: rgba(33, 150, 243, 0.1); }

        .actions-cell { display: flex; gap: 0.5rem; }
        .actions-cell button { border: none; background: #444; width: 32px; height: 32px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: background 0.2s; }
        .accept-btn { background: #2196f3 !important; color: white; }
        .edit-btn:hover { background: #666; }
        .delete-btn:hover { background: #e57373; color: white; }
        
        .loading { text-align: center; margin-top: 3rem; color: #888; }

        /* Modal */
        .modal-backdrop { 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; 
        }
        .modal {
            background: #2a2a2a; padding: 2rem; border-radius: 8px; width: 400px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .modal h3 { margin-top: 0; color: #fff; }
        .form-group { margin-bottom: 1rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; color: #ccc; }
        .form-group select, .form-group input { width: 100%; padding: 0.5rem; background: #111; border: 1px solid #444; color: white; border-radius: 4px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
        .modal-actions button { padding: 0.5rem 1rem; cursor: pointer; border-radius: 4px; border:none; font-weight: bold; }
        .modal-actions button:first-child { background: #4caf50; color: white; }
        .modal-actions button:last-child { background: #444; color: white; }
    `],
    imports: [CommonModule, RouterLink, FormsModule]
})
export class VikingsEventManagementComponent {
    private route = inject(ActivatedRoute);
    private vikingsService = inject(VikingsService);

    public eventId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));

    // Combined data source
    public data = toSignal(
        this.route.paramMap.pipe(
            map(p => p.get('id')),
            switchMap(id => {
                if (!id) return of(null);
                return combineLatest([
                    this.vikingsService.getVikingsEventById(id),
                    this.vikingsService.getEventRegistrations(id)
                ]).pipe(
                    map(([event, regs]) => ({ event, regs }))
                );
            })
        )
    );

    public event = computed(() => this.data()?.event);

    // Process rows primarily for display
    public rows = computed(() => {
        const data = this.data();
        if (!data || !data.event) return [];

        const assignments = data.event.characters || [];
        const regMap = new Map((data.regs || []).map(r => [r.characterId, r]));

        return assignments.map(a => {
            const r = regMap.get(a.characterId);
            // Diff logic: Check if status or marches count differs
            const hasDiff = !!r && (r.status !== a.status || r.marchesCount !== a.marchesCount);
            return {
                assignment: a,
                registration: r,
                hasDiff
            } as ManagementRow;
        }).sort((a, b) => b.assignment.powerLevel - a.assignment.powerLevel); // Sort by power
    });

    // Edit State
    public editingRow: ManagementRow | null = null;
    public editStatus: any = 'unknown';
    public editMarches: number = 0;
    public editPower: number = 0;

    // Add State
    public showAddModal = false;
    public newCharName = '';
    public newCharId = '';
    public newCharPower = 0;

    public async acceptRegistration(row: ManagementRow) {
        if (!row.registration) return;

        await this.updateCharacter(row.assignment.characterId, {
            status: row.registration.status,
            marchesCount: row.registration.marchesCount
        });
    }

    public async acceptAllRegs() {
        if (!confirm('Are you sure you want to update all assignments to match user registrations?')) return;

        const rows = this.rows();
        const eventId = this.eventId();
        const event = this.event();
        if (!eventId || !event) return;

        const newCharacters = event.characters.map(char => {
            const row = rows.find(r => r.assignment.characterId === char.characterId);
            if (row && row.hasDiff && row.registration) {
                return {
                    ...char,
                    status: row.registration.status,
                    marchesCount: row.registration.marchesCount
                };
            }
            return char;
        });

        try {
            await this.vikingsService.updateEventCharacters(eventId, newCharacters);
        } catch (e) {
            console.error(e);
            alert('Failed to sync registrations.');
        }
    }

    public editRow(row: ManagementRow) {
        this.editingRow = row;
        this.editStatus = row.assignment.status;
        this.editMarches = row.assignment.marchesCount;
        this.editPower = row.assignment.powerLevel;
    }

    public async saveEdit() {
        if (!this.editingRow) return;

        await this.updateCharacter(this.editingRow.assignment.characterId, {
            status: this.editStatus,
            marchesCount: this.editMarches,
            powerLevel: this.editPower
        });
        this.editingRow = null;
    }

    public async deleteRow(row: ManagementRow) {
        if (!confirm(`Remove ${row.assignment.characterName} from event?`)) return;

        const eventId = this.eventId();
        const event = this.event();
        if (!eventId || !event) return;

        const newCharacters = event.characters.filter(c => c.characterId !== row.assignment.characterId);

        try {
            await this.vikingsService.updateEventCharacters(eventId, newCharacters);
        } catch (e) {
            console.error(e);
            alert('Failed to remove character');
        }
    }

    public async addCharacter() {
        if (!this.newCharName || !this.newCharId) return;

        const eventId = this.eventId();
        const event = this.event();
        if (!eventId || !event) return;

        const newChar: CharacterAssignment = {
            characterId: this.newCharId,
            characterName: this.newCharName,
            powerLevel: this.newCharPower,
            status: 'unknown',
            marchesCount: 0,
            reinforce: []
        };

        const newCharacters = [...event.characters, newChar];

        try {
            await this.vikingsService.updateEventCharacters(eventId, newCharacters);
            this.showAddModal = false;
            this.newCharName = '';
            this.newCharId = '';
            this.newCharPower = 0;
        } catch (e) {
            console.error(e);
            alert('Failed to add character');
        }
    }

    // Helper to update a single character in the array -> writes whole array
    private async updateCharacter(charId: string, changes: Partial<CharacterAssignment>) {
        const eventId = this.eventId();
        const event = this.event();
        if (!eventId || !event) return;

        const newCharacters = event.characters.map(c => {
            if (c.characterId === charId) {
                return { ...c, ...changes };
            }
            return c;
        });

        try {
            await this.vikingsService.updateEventCharacters(eventId, newCharacters);
        } catch (e) {
            console.error(e);
            alert('Action failed.');
        }
    }
}
