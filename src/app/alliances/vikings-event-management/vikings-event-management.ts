import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VikingsService, VikingsEventView, CharacterAssignment, VikingsRegistration } from '../../vikings-event/vikings.service';
import { AlliancesService, AllianceMember, Alliance } from '../alliances.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of, combineLatest } from 'rxjs';

interface ManagementRow {
    assignment: CharacterAssignment;
    registration?: VikingsRegistration;
    hasDiff: boolean; // True if registration differs from assignment
    isRemovedFromAlliance: boolean; // True if member is no longer in the alliance
    mainCharacterName?: string; // Resolved name of the main character
}

@Component({
    selector: 'app-vikings-event-management',
    template: `
        <div class="manage-container" *ngIf="data() as d">
            <ng-container *ngIf="d.event as evt">
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
                <button class="tool-btn meta-btn" (click)="syncAllianceMetadata()">🔄 Sync Alliance Metadata</button>
                <button class="tool-btn simulate-btn" (click)="simulateAssignments()">🎲 Simulate Assignments</button>
            </div>

            <!-- Missing Members Section -->
            @if (missingMembers().length > 0) {
                <div class="missing-members-section">
                    <h3>⚠️ Missing Alliance Members</h3>
                    <div class="missing-list">
                        @for (member of missingMembers(); track member.characterId) {
                            <div class="missing-item">
                                <span class="name">{{ member.name }}</span>
                                <span class="power">{{ member.power | number }}</span>
                                <button class="add-missing-btn" (click)="addMissingMember(member)">Add to Event</button>
                            </div>
                        }
                    </div>
                </div>
            }

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Character</th>
                            <th>Type</th>
                            <th>Power</th>
                            <th>Current Assignment</th>
                            <th>Registration (User Submitted)</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @for (row of rows(); track row.assignment.characterId) {
                        <tr [class.has-diff]="row.hasDiff" [class.removed-member]="row.isRemovedFromAlliance">
                            <td>
                                <div class="char-name">{{ row.assignment.characterName }}</div>
                                <div class="char-id">{{ row.assignment.characterId }}</div>
                                @if (row.isRemovedFromAlliance) {
                                    <div class="removed-badge">🚫 Left Alliance</div>
                                }
                            </td>
                            <td>
                                @if (row.assignment.mainCharacterId) {
                                    <div class="farm-badge">🚜 Farm</div>
                                    <div class="main-char-link">Main: {{ row.mainCharacterName }}</div>
                                    @if ((row.assignment.extraMarches ?? 0) > 0) {
                                        <div class="extra-marches-badge">+{{ row.assignment.extraMarches }} Marches</div>
                                    }
                                } @else {
                                    <div class="main-badge">👑 Main</div>
                                }
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
                                        <div class="verification-badge" [class.verified]="row.registration.verified">
                                            {{ row.registration.verified ? '✓ Verified' : '⚠ Unverified' }}
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
                    <div class="form-group relative">
                        <label>Main Character (Optional - for Farm)</label>
                        <input [(ngModel)]="mainCharSearch" 
                               (focus)="showMainCharDropdown = true" 
                               (input)="showMainCharDropdown = true"
                               placeholder="Search for main character...">
                        <input type="hidden" [(ngModel)]="editMainCharacterId">
                        
                        @if (showMainCharDropdown && filteredMainCharCandidates().length > 0) {
                            <ul class="dropdown-list">
                                @for (candidate of filteredMainCharCandidates(); track candidate.characterId) {
                                    <li (click)="selectMainChar(candidate)">
                                        <div class="dd-name">{{ candidate.name }}</div>
                                        <div class="dd-id">Power: {{ candidate.power | number }}</div>
                                    </li>
                                }
                            </ul>
                        }
                        @if (editMainCharacterId) {
                             <div class="selected-helper">Selected ID: {{ editMainCharacterId }} <button class="clear-btn" (click)="clearMainChar()">×</button></div>
                        }
                    </div>
                    <div class="form-group">
                        <label>Extra Marches (for Farm)</label>
                        <input type="number" [(ngModel)]="editExtraMarches">
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
                    <div class="form-group">
                        <label>Main Character ID (Optional)</label>
                        <input [(ngModel)]="newMainCharacterId">
                    </div>
                    <div class="form-group">
                        <label>Extra Marches</label>
                        <input type="number" [(ngModel)]="newExtraMarches">
                    </div>
                    <div class="modal-actions">
                        <button (click)="addCharacter()">Add</button>
                        <button (click)="showAddModal = false">Cancel</button>
                    </div>
                </div>
            </div>
            </ng-container>
        </div>
        <div *ngIf="!data()" class="loading">Loading Event Data...</div>
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
        .meta-btn { background: #9c27b0; color: white; }
        .simulate-btn { background: #00bcd4; color: white; }

        .missing-members-section {
            background: #332b00; border: 1px solid #665500; border-radius: 8px; padding: 1rem; margin-bottom: 2rem;
        }
        .missing-members-section h3 { margin-top: 0; color: #ffd54f; font-size: 1rem; }
        .missing-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .missing-item { 
            background: rgba(0,0,0,0.3); padding: 0.5rem 1rem; border-radius: 20px; display: flex; align-items: center; gap: 0.5rem; border: 1px solid #665500;
        }
        .missing-item .name { font-weight: bold; }
        .missing-item .power { font-size: 0.8rem; color: #aaa; }
        .add-missing-btn { 
            background: #ffd54f; color: #000; border: none; padding: 0.2rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;
        }
        .add-missing-btn:hover { background: #ffca28; }

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

        .verification-badge { display: inline-block; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.5rem; background: #3d2b2b; color: #e57373; border: 1px solid #e57373; }
        .verification-badge.verified { background: #2b3d2b; color: #81c784; border: 1px solid #81c784; }

        .marches { font-size: 0.85rem; color: #ddd; }
        .timestamp { font-size: 0.75rem; color: #888; margin-top: 0.2rem; }
        .no-reg { color: #666; font-style: italic; font-size: 0.9rem; }

        .has-diff { background: rgba(33, 150, 243, 0.05); }
        .has-diff .reg-info { border: 1px solid #2196f3; padding: 0.5rem; border-radius: 4px; background: rgba(33, 150, 243, 0.1); }

        .removed-member td { background: rgba(244, 67, 54, 0.1); }
        .removed-member .char-name { color: #e57373; }
        .removed-badge { 
            display: inline-block; background: #c62828; color: white; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; margin-top: 0.3rem;
        }

        .farm-badge { display: inline-block; background: #795548; color: white; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; }
        .main-badge { display: inline-block; background: #5d4037; color: #ffd54f; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid #ffd54f; }
        .main-char-link { font-size: 0.75rem; color: #aaa; margin-top: 0.2rem; }
        .extra-marches-badge { font-size: 0.7rem; color: #81c784; margin-top: 0.2rem; }

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
        .relative { position: relative; }
        .dropdown-list {
            position: absolute; top: 100%; left: 0; width: 100%; max-height: 200px; overflow-y: auto;
            background: #222; border: 1px solid #444; border-radius: 4px; padding: 0; margin: 0; z-index: 10;
            list-style: none; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }
        .dropdown-list li {
            padding: 0.5rem; border-bottom: 1px solid #333; cursor: pointer;
        }
        .dropdown-list li:hover { background: #333; }
        .dropdown-list li:last-child { border-bottom: none; }
        .dd-name { font-weight: bold; color: white; }
        .dd-id { font-size: 0.75rem; color: #888; }
        
        .selected-helper { font-size: 0.8rem; color: #81c784; margin-top: 0.3rem; display: flex; align-items: center; gap: 0.5rem;}
        .clear-btn { background: none; border: none; color: #e57373; font-weight: bold; cursor: pointer; font-size: 1rem; padding: 0 0.3rem; }
    `],
    imports: [CommonModule, RouterLink, FormsModule]
})
export class VikingsEventManagementComponent {
    private route = inject(ActivatedRoute);
    private vikingsService = inject(VikingsService);
    private alliancesService = inject(AlliancesService);

    public eventId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));

    // Combined data source
    public data = toSignal(
        this.route.paramMap.pipe(
            map(p => p.get('id')),
            switchMap(id => {
                if (!id) return of(null);

                // Get the event first to know which alliance to fetch
                return this.vikingsService.getVikingsEventById(id).pipe(
                    switchMap(event => {
                        if (!event) return of({ event: null, regs: [], alliance: null });

                        return combineLatest([
                            this.vikingsService.getEventRegistrations(event.id!),
                            this.alliancesService.getAlliance(event.allianceId)
                        ]).pipe(
                            map(([regs, alliance]) => ({ event, regs, alliance }))
                        );
                    })
                );
            })
        )
    );

    public event = computed(() => this.data()?.event);

    // Compute missing members (In Alliance but NOT in Event)
    public missingMembers = computed(() => {
        const data = this.data();
        if (!data || !data.event || !data.alliance) return [];

        const eventCharIds = new Set(data.event.characters.map(c => c.characterId));
        return (data.alliance.members || []).filter(m => !eventCharIds.has(m.characterId));
    });

    // Process rows primarily for display
    public rows = computed(() => {
        const data = this.data();
        if (!data || !data.event) return [];

        const assignments = data.event.characters || [];
        const regMap = new Map((data.regs || []).map(r => [r.characterId, r]));

        // Helper to check if still in alliance
        const allianceMemberIds = new Set((data.alliance?.members || []).map(m => m.characterId));

        // Name Resolution Map
        const nameMap = new Map<string, string>();
        if (data.alliance?.members) {
            data.alliance.members.forEach(m => nameMap.set(m.characterId, m.name));
        }
        // Fallback to event characters if not in alliance list (e.g. removed member)
        assignments.forEach(c => {
            if (!nameMap.has(c.characterId)) nameMap.set(c.characterId, c.characterName);
        });

        return assignments.map(a => {
            const r = regMap.get(a.characterId);
            // Diff logic: Check if status or marches count differs
            const hasDiff = !!r && (r.status !== a.status || r.marchesCount !== a.marchesCount);

            // Check if removed from alliance (only if we have alliance data)
            const isRemovedFromAlliance = !!data.alliance && !allianceMemberIds.has(a.characterId);

            // Resolve Main Character Name
            let mainCharacterName = undefined;
            if (a.mainCharacterId) {
                mainCharacterName = nameMap.get(a.mainCharacterId) || `ID: ${a.mainCharacterId}`;
            }

            return {
                assignment: a,
                registration: r,
                hasDiff,
                isRemovedFromAlliance,
                mainCharacterName
            } as ManagementRow;
        }).sort((a, b) => b.assignment.powerLevel - a.assignment.powerLevel); // Sort by power
    });

    // Edit State
    public editingRow: ManagementRow | null = null;
    public editStatus: any = 'unknown';
    public editMarches: number = 0;
    public editPower: number = 0;
    public editMainCharacterId: string = '';
    public editExtraMarches: number = 0;

    // Add State
    public showAddModal = false;
    public newCharName = '';
    public newCharId = '';
    public newCharPower = 0;
    public newMainCharacterId = '';
    public newExtraMarches = 0;

    // Autocomplete State
    public mainCharSearch = '';
    public showMainCharDropdown = false;

    public filteredMainCharCandidates = computed(() => {
        const search = this.mainCharSearch.toLowerCase();
        const data = this.data();
        if (!data || !data.alliance || !data.alliance.members) return [];

        if (!search) return data.alliance.members.slice(0, 5); // Show top 5 if empty

        return data.alliance.members.filter(m =>
            m.name.toLowerCase().includes(search) || m.characterId.includes(search)
        ).slice(0, 10);
    });

    public selectMainChar(candidate: AllianceMember) {
        this.editMainCharacterId = candidate.characterId;
        this.mainCharSearch = candidate.name;
        this.showMainCharDropdown = false;
    }

    public clearMainChar() {
        this.editMainCharacterId = '';
        this.mainCharSearch = '';
    }

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

    public async addMissingMember(member: AllianceMember) {
        const eventId = this.eventId();
        const event = this.event();
        if (!eventId || !event) return;

        const newChar: CharacterAssignment = {
            characterId: member.characterId,
            characterName: member.name,
            powerLevel: member.power,
            mainCharacterId: member.mainCharacterId, // Carry over
            status: 'unknown',
            marchesCount: 0,
            reinforce: []
        };

        const newCharacters = [...event.characters, newChar];

        try {
            await this.vikingsService.updateEventCharacters(eventId, newCharacters);
        } catch (e) {
            console.error(e);
            alert('Failed to add character');
        }
    }

    public editRow(row: ManagementRow) {
        this.editingRow = row;
        this.editStatus = row.assignment.status;
        this.editMarches = row.assignment.marchesCount;
        this.editPower = row.assignment.powerLevel;
        this.editMainCharacterId = row.assignment.mainCharacterId || '';
        this.editExtraMarches = row.assignment.extraMarches || 0;

        // Initialize search field
        this.mainCharSearch = '';
        if (this.editMainCharacterId) {
            // Try to find name in alliance members
            const member = this.data()?.alliance?.members?.find((m: AllianceMember) => m.characterId === this.editMainCharacterId);
            if (member) this.mainCharSearch = member.name;
            else this.mainCharSearch = this.editMainCharacterId; // Fallback to ID
        }
    }

    public async saveEdit() {
        if (!this.editingRow) return;

        const changes: Partial<CharacterAssignment> = {
            status: this.editStatus,
            marchesCount: this.editMarches,
            powerLevel: this.editPower,
            mainCharacterId: this.editMainCharacterId || undefined,
            extraMarches: this.editExtraMarches || 0
        };

        if (!changes.mainCharacterId) delete changes.mainCharacterId; // Ensure undefined if empty
        if (!changes.extraMarches) delete changes.extraMarches;

        await this.updateCharacter(this.editingRow.assignment.characterId, changes);
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
            mainCharacterId: this.newMainCharacterId || undefined,
            extraMarches: this.newExtraMarches || 0,
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
            this.newMainCharacterId = '';
            this.newExtraMarches = 0;
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

    public async simulateAssignments() {
        if (!confirm('Simulate assignments for this event? This will overwrite current temporary assignments.')) return;
        const eventId = this.eventId();
        if (!eventId) return;

        try {
            await this.vikingsService.simulateAssignments(eventId);
            alert('Assignments simulated!');
        } catch (err) {
            console.error(err);
            alert('Failed to simulate assignments.');
        }
    }

    public async syncAllianceMetadata() {
        if (!confirm('Sync metadata (Main Character ID) from Alliance member list to this event? This will overwrite manual changes to Main Character IDs in this event.')) return;

        const data = this.data();
        if (!data || !data.event || !data.alliance) return;

        const allianceMembers = new Map(data.alliance.members?.map(m => [m.characterId, m]));
        let updateCount = 0;

        const newCharacters = data.event.characters.map(char => {
            const member = allianceMembers.get(char.characterId);
            if (member && member.mainCharacterId !== char.mainCharacterId) {
                updateCount++;
                return {
                    ...char,
                    mainCharacterId: member.mainCharacterId
                };
            }
            return char;
        });

        if (updateCount === 0) {
            alert('No metadata differences found.');
            return;
        }

        try {
            await this.vikingsService.updateEventCharacters(data.event.id!, newCharacters);
            alert(`Updated metadata for ${updateCount} characters.`);
        } catch (err) {
            console.error(err);
            alert('Failed to sync metadata.');
        }
    }
}
