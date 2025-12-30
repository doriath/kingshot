import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AlliancesService, Alliance, AllianceMember } from '../alliances.service';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AllianceVikingsEventsComponent } from '../alliance-vikings-events/alliance-vikings-events';
import { AllianceSwordlandEventsComponent } from '../alliance-swordland-events/alliance-swordland-events';

@Component({
    selector: 'app-alliance-management',
    template: `
        <div class="manage-container" *ngIf="alliance() as ally">
            <header>
                <a routerLink="/admin/alliances" class="back-link">← Back to Alliances</a>
                <h1>Manage: [{{ ally.tag }}] {{ ally.name }}</h1>
            </header>

            <div class="tabs">
                <button class="tab-btn" [class.active]="activeTab === 'members'" (click)="activeTab = 'members'">Members</button>
                <button class="tab-btn" [class.active]="activeTab === 'events'" (click)="activeTab = 'events'">Vikings Events</button>
                <button class="tab-btn" [class.active]="activeTab === 'swordland'" (click)="activeTab = 'swordland'">Swordland Events</button>
            </div>

            <section class="members-section" *ngIf="activeTab === 'members'">
                <div class="add-member-card">
                    <h3>Add New Member</h3>
                    <form (submit)="$event.preventDefault(); addMember()">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Character Name</label>
                                <input [(ngModel)]="newMemberName" name="name" placeholder="e.g. Ragnar" required>
                            </div>
                            <div class="form-group">
                                <label>Character ID</label>
                                <input [(ngModel)]="newMemberId" name="id" placeholder="e.g. 123456" required>
                            </div>
                            <div class="form-group">
                                <label>Power</label>
                                <input [(ngModel)]="newMemberPower" name="power" type="number" placeholder="e.g. 1000000" required>
                            </div>
                            <div class="form-group">
                                <label>Reinforcement Capacity (Optional)</label>
                                <input [(ngModel)]="newMemberReinforcementCapacity" name="reinforcementCapacity" type="number" placeholder="e.g. 500000">
                            </div>
                            <div class="form-group">
                                <label>Marches Count (Optional)</label>
                                <input [(ngModel)]="newMemberMarchesCount" name="marchesCount" type="number" placeholder="e.g. 6">
                            </div>
                            <div class="form-group">
                                <label>Main Character (Optional)</label>
                                <select [(ngModel)]="newMemberMainId" name="mainId">
                                    <option [ngValue]="null">-- None (Regular Account) --</option>
                                    @for (m of members(); track m.characterId) {
                                        @if (m.characterId !== newMemberId) {
                                            <option [value]="m.characterId">{{ m.name }} ({{ m.power | number }})</option>
                                        }
                                    }
                                </select>
                            </div>
                            <div class="form-group checkbox-group">
                                <label>
                                    <input type="checkbox" [(ngModel)]="newMemberQuit" name="quit">
                                    Quit / Stopped Playing
                                </label>
                            </div>
                            <div class="form-group btn-container">
                                <button type="submit" [disabled]="!isValidMember()" class="add-btn">{{ newMemberId ? 'Update' : 'Add' }} Member</button>
                            </div>
                        </div>
                    </form>
                </div>

                <div class="members-list">
                    <h3>Members ({{ members().length || 0 }})</h3>
                    
                    <div class="list-header">
                        <span>#</span>
                        <span>Name/ID</span>
                        <span>Power</span>
                        <span>Cap</span>
                        <span>Marches</span>
                        <span>Actions</span>
                    </div>
                    
                    @for (member of members(); track member.characterId; let i = $index) {
                    <div class="member-row">
                        <span class="member-pos">{{ i + 1 }}</span>
                        <span class="member-name">
                            <div class="name-text">
                                {{ member.name }}
                                @if (member.quit) {
                                    <span class="quit-badge">QUIT</span>
                                }
                                @if (member.mainCharacterId) {
                                    <span class="alt-badge" title="Alt Account">Alt of {{ getMemberName(member.mainCharacterId) }}</span>
                                }
                            </div>
                            <div class="id-subline">{{ member.characterId }}</div>
                        </span>
                        <span class="member-power">{{ member.power | number }}</span>
                        <span class="member-cap">{{ member.reinforcementCapacity ? (member.reinforcementCapacity | number) : '-' }}</span>
                        <span class="member-marches">{{ member.marchesCount !== undefined ? member.marchesCount : '-' }}</span>
                        <span class="member-actions">
                            <button class="action-btn icon-btn" title="Edit" (click)="editMember(member)">✏️</button>
                            <button class="action-btn icon-btn delete-btn" title="Remove" (click)="removeMember(member)">🗑️</button>
                        </span>
                    </div>
                    } @empty {
                        <div class="empty-list">No members added yet.</div>
                    }
                </div>
            </section>

            <section class="events-section" *ngIf="activeTab === 'events'">
                <app-alliance-vikings-events [alliance]="ally"></app-alliance-vikings-events>
            </section>

            <section class="events-section" *ngIf="activeTab === 'swordland'">
                <app-alliance-swordland-events [alliance]="ally"></app-alliance-swordland-events>
            </section>

            <!-- Edit Modal -->
            @if (isEditModalOpen && editingMember_) {
            <div class="modal-backdrop">
                <div class="modal">
                    <h3>Edit Member: {{ editingMember_.name }}</h3>
                    <div class="form-group">
                        <label>Name</label>
                        <input [(ngModel)]="editingMember_.name" placeholder="Name">
                    </div>
                    <!-- ID is usually fixed, but maybe allow edit if it was wrong? For now mostly fixed or careful edit. -->
                     <div class="form-group">
                        <label>ID (Read-only)</label>
                        <input [value]="editingMember_.characterId" disabled title="ID cannot be changed directly">
                    </div>
                    <div class="form-group">
                        <label>Power</label>
                        <input type="number" [(ngModel)]="editingMember_.power" placeholder="Power">
                    </div>
                    <div class="form-group">
                        <label>Reinforcement Capacity</label>
                        <input type="number" [(ngModel)]="editingMember_.reinforcementCapacity" placeholder="Capacity">
                    </div>
                    <div class="form-group">
                        <label>Marches Count</label>
                        <input type="number" [(ngModel)]="editingMember_.marchesCount" placeholder="Marches">
                    </div>
                     <div class="form-group">
                        <label>Main Character (Optional)</label>
                        <select [(ngModel)]="editingMember_.mainCharacterId">
                            <option [ngValue]="undefined">-- None (Regular Account) --</option>
                            @for (m of members(); track m.characterId) {
                                @if (m.characterId !== editingMember_.characterId) {
                                    <option [value]="m.characterId">{{ m.name }} ({{ m.power | number }})</option>
                                }
                            }
                        </select>
                    </div>
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" [(ngModel)]="editingMember_.quit" name="editQuit">
                            Quit / Stopped Playing
                        </label>
                    </div>

                    <div class="modal-actions">
                        <button class="save-btn" (click)="saveEdit()">Save Changes</button>
                        <button class="cancel-btn" (click)="cancelEdit()">Cancel</button>
                    </div>
                </div>
            </div>
            }
        </div>
        <div *ngIf="!alliance()" class="loading">Loading...</div>
    `,
    styles: [`
        .manage-container { max-width: 900px; margin: 0 auto; padding: 2rem; color: #eee; }
        /* Existing styles... */
        .checkbox-group { display: flex; align-items: center; }
        .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: #ccc; font-size: 0.9rem; }
        .checkbox-group input { width: auto; margin: 0; }

        .back-link { color: #aaa; text-decoration: none; font-size: 0.9rem; }
        .back-link:hover { color: white; }
        
        header { margin-bottom: 2rem; border-bottom: 1px solid #444; padding-bottom: 1rem; }
        h1 { margin: 0.5rem 0 0; color: #ffca28; }

        .tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .tab-btn {
            background: transparent;
            border: none;
            color: #888;
            font-size: 1rem;
            padding: 0.5rem 1rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }
        .tab-btn.active { color: white; border-bottom-color: #2196f3; }

        /* ... Include original form/list styles ... */
        .add-member-card { background: #2a2a2a; border: 1px solid #444; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
        .add-member-card h3 { margin-top: 0; color: #81c784; }

        .form-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
        .form-group { flex: 1; min-width: 150px; margin-bottom: 1rem; } /* added margin-bottom for modal vertical stacking */
        .form-group label { display: block; color: #ccc; margin-bottom: 0.3rem; font-size: 0.85rem; }
        .form-group input, .form-group select { width: 100%; padding: 0.5rem; background: #1a1a1a; border: 1px solid #555; border-radius: 4px; color: white; }
        .btn-container { flex: 0; }
        
        .add-btn { background: #4caf50; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; cursor: pointer; font-weight: bold; white-space: nowrap; }
        .add-btn:disabled { background: #555; cursor: not-allowed; color: #888; }

        .members-list { background: #222; border-radius: 8px; overflow-x: auto; }
        .members-list h3 { padding: 1rem; margin: 0; background: #333; font-size: 1rem; }

        .list-header { 
            display: grid; grid-template-columns: 50px 3fr 1.2fr 1fr 0.8fr 100px; 
            padding: 0.8rem 1rem; background: #2a2a2a; color: #aaa; font-size: 0.85rem; font-weight: bold; min-width: 600px;
        }
        .member-row {
            display: grid; grid-template-columns: 50px 3fr 1.2fr 1fr 0.8fr 100px;
            padding: 0.8rem 1rem; border-bottom: 1px solid #333; align-items: center; min-width: 600px;
        }
        .member-row:last-child { border-bottom: none; }
        .member-name { font-weight: 500; color: white; }
        .name-text { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
        .id-subline { font-family: monospace; color: #666; font-size: 0.75rem; margin-top: 2px; }
        
        .member-pos { color: #888; font-weight: bold; }
        .member-power { color: #ffb74d; }
        .member-cap { color: #81c784; font-size: 0.9rem; }
        .member-marches { color: #ce93d8; font-size: 0.9rem; }
        
        .icon-btn { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.7; }
        .icon-btn:hover { opacity: 1; }

        .alt-badge {
            background-color: #5d4037;
            color: #d7ccc8;
            font-size: 0.75rem;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 8px;
            vertical-align: middle;
        }

        .quit-badge {
            background-color: #b71c1c;
            color: white;
            font-size: 0.75rem;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 8px;
            vertical-align: middle;
            font-weight: bold;
        }

        .empty-list { padding: 2rem; text-align: center; color: #666; font-style: italic; }
        .loading { text-align: center; margin-top: 3rem; color: #888; }

        /* Modal Styles */
        .modal-backdrop {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex; justify-content: center; align-items: center;
            z-index: 1000;
        }
        .modal {
            background: #2a2a2a;
            padding: 2rem;
            border-radius: 8px;
            width: 100%;
            max-width: 500px;
            border: 1px solid #444;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .modal h3 { margin-top: 0; color: #ffca28; margin-bottom: 1.5rem; }
        .modal-actions {
            display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;
        }
        .save-btn { background: #2196f3; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .cancel-btn { background: transparent; color: #aaa; border: 1px solid #555; padding: 0.6rem 1.2rem; border-radius: 4px; cursor: pointer; }
        .cancel-btn:hover { color: white; border-color: #888; }
    `],
    imports: [CommonModule, RouterLink, FormsModule, AllianceVikingsEventsComponent, AllianceSwordlandEventsComponent]
})
export class AllianceManagementComponent {
    private route = inject(ActivatedRoute);
    private alliancesService = inject(AlliancesService);

    public activeTab: 'members' | 'events' | 'swordland' = 'members';

    public newMemberName = '';
    public newMemberId = '';
    public newMemberPower: number | null = null;
    public newMemberReinforcementCapacity: number | null = null;
    public newMemberMarchesCount: number | null = null;
    public newMemberMainId: string | null = null;
    public newMemberQuit = false;

    // Edit State
    public editingMember_: Partial<AllianceMember> | null = null;
    public isEditModalOpen = false;

    public allianceData = toSignal(
        this.route.paramMap.pipe(
            map(params => params.get('id')),
            switchMap(id => {
                if (!id) return of(null);
                return this.alliancesService.getAlliance(id).pipe(
                    map(ally => ally ? { ...ally, uuid: id } : null)
                ); // Pass uuid too? Alliance interface has uuid.
            })
        )
    );

    // Alias for template convenience
    public alliance = this.allianceData;

    public members = toSignal(
        this.route.paramMap.pipe(
            map(params => params.get('id')),
            switchMap(id => {
                if (!id) return of([]);
                return this.alliancesService.getAllianceMembers(id).pipe(
                    map(members => [...members].sort((a, b) => b.power - a.power))
                );
            })
        ),
        { initialValue: [] }
    );

    public isValidMember(): boolean {
        return !!this.newMemberName && !!this.newMemberId && (this.newMemberPower !== null && this.newMemberPower >= 0);
    }

    public async addMember() {
        const ally = this.alliance();
        if (!ally || !this.isValidMember()) return;

        const newMember: AllianceMember = {
            characterId: this.newMemberId,
            name: this.newMemberName,
            power: Number(this.newMemberPower),

            ...(this.newMemberMainId ? { mainCharacterId: this.newMemberMainId } : {}),
            ...(this.newMemberReinforcementCapacity ? { reinforcementCapacity: Number(this.newMemberReinforcementCapacity) } : {}),
            ...(this.newMemberMarchesCount !== null ? { marchesCount: Number(this.newMemberMarchesCount) } : {}),
            ...(this.newMemberQuit ? { quit: true } : {})
        };

        try {
            await this.alliancesService.addAllianceMember(ally.uuid, newMember);

            // Reset form
            this.newMemberName = '';
            this.newMemberId = '';
            this.newMemberPower = null;
            this.newMemberMainId = null;
            this.newMemberReinforcementCapacity = null;
            this.newMemberMarchesCount = null;
            this.newMemberQuit = false;

            // Optional: Show toast
        } catch (err) {
            console.error(err);
            alert('Failed to add member. Make sure you are an admin.');
        }
    }

    public editMember(member: AllianceMember) {
        this.editingMember_ = { ...member };
        this.isEditModalOpen = true;
    }

    public cancelEdit() {
        this.editingMember_ = null;
        this.isEditModalOpen = false;
    }

    public async saveEdit() {
        const ally = this.alliance();
        const em = this.editingMember_;
        if (!ally || !em || !em.characterId || !em.name) return;

        // Construct updated member object safely to avoid 'undefined'
        const updatedMember: AllianceMember = {
            characterId: em.characterId, // ID is key, cannot change
            name: em.name,
            power: Number(em.power),

            ...(em.mainCharacterId ? { mainCharacterId: em.mainCharacterId } : {}),
            ...(em.reinforcementCapacity ? { reinforcementCapacity: Number(em.reinforcementCapacity) } : {}),
            ...(em.marchesCount !== undefined && em.marchesCount !== null ? { marchesCount: Number(em.marchesCount) } : {}),
            ...(em.quit ? { quit: true } : {})
        };

        try {
            await this.alliancesService.addAllianceMember(ally.uuid, updatedMember);
            this.isEditModalOpen = false;
            this.editingMember_ = null;
        } catch (err) {
            console.error(err);
            alert('Failed to update member.');
        }
    }

    public async removeMember(member: AllianceMember) {
        if (!confirm(`Are you sure you want to remove ${member.name}?`)) return;

        const ally = this.alliance();
        if (!ally) return;

        try {
            await this.alliancesService.removeAllianceMember(ally.uuid, member.characterId);
        } catch (err) {
            console.error(err);
            alert('Failed to remove member.');
        }
    }

    public getMemberName(id: string): string {
        const m = this.members().find(m => m.characterId === id);
        return m ? m.name : id;
    }
}
