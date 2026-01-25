import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminBreadcrumbService } from '../../admin-layout/admin-breadcrumb.service';
import { FormsModule } from '@angular/forms';
import { VikingsService } from '../../vikings-event/vikings.service';
import { VikingsEventView, CharacterAssignment, CharacterAssignmentView, VikingsRegistration, VikingsStatus } from '../../vikings-event/vikings.types';
import { getCharacterStatus } from '../../vikings-event/vikings.helpers';
import { AssignmentAlgorithm } from '../../vikings-event/vikings-assignment-logic';
import { AlliancesService, AllianceMember, Alliance } from '../alliances.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of, combineLatest } from 'rxjs';

interface ManagementRow {
    assignment: CharacterAssignmentView;
    registration?: VikingsRegistration;
    allianceMember?: AllianceMember;
    hasDiff: boolean; // True if registration OR alliance data differs from assignment
    isRemovedFromAlliance: boolean; // True if member is no longer in the allianceholder to switch strategy.
    isQuit: boolean; // True if member is marked as quit
    mainCharacterName?: string; // Resolved name of the main character
    resolvedReinforcements?: ResolvedReinforcement[]; // Resolved names and status of reinforcement targets
    reinforcedBy?: ResolvedReinforcement[]; // Resolved names and status of characters reinforcing THIS character
    expectedMarches?: number; // Expected number of incoming reinforcements
    actualStatus?: VikingsStatus | 'unknown'; // Actual status of the character during the event
}

interface ResolvedReinforcement {
    name: string;
    marchType?: string;
    status: VikingsStatus | 'unknown';
    scoreValue?: number;
    confidenceLevel?: number;
}

@Component({
    selector: 'app-vikings-event-management',
    template: `
        <div class="manage-container" *ngIf="data() as d">
            <ng-container *ngIf="d.event as evt">
            <header>
                <h1>⚔️ Manage Assignments: {{ evt.date.toDate() | date:'medium' }}</h1>
                <div class="subtitle">
                    <a [routerLink]="['/admin', 'alliances', evt.allianceId]" class="alliance-link">
                        [{{ evt.allianceTag }}] Server #{{ evt.server }}
                    </a>
                    <span class="status-badge" [class]="evt.status">{{ evt.status | uppercase }}</span>
                    <button class="status-btn" (click)="openStatusModal()">Change Status</button>
                </div>
                <!-- Stats Summary -->
                <div class="stats-summary" *ngIf="stats() as s">
                    <div class="stat-pill total">Total: {{ s.total }}</div>
                    <div class="stat-pill online">Online: {{ s.online }}</div>
                    <div class="stat-pill offline_empty">Offline (Empty): {{ s.offline_empty }}</div>
                    <div class="stat-pill offline_not_empty">Offline (Not Empty): {{ s.offline_not_empty }}</div>
                    <div class="stat-pill unknown" *ngIf="s.unknown > 0">Unknown: {{ s.unknown }}</div>
                </div>
            </header>

            <div class="toolbar">
                <button class="tool-btn add-btn" (click)="showAddModal = true">➕ Add Character</button>
                <a *ngIf="data()?.event as evt" [routerLink]="['/admin', 'alliances', evt.allianceId, 'vikings', evt.id, 'availability']" class="tool-btn status-btn-link">📅 Availability</a>
                <button class="tool-btn sync-btn" (click)="acceptAllRegs()">📥 Accept All Differences</button>
                <button class="tool-btn meta-btn" (click)="syncAllianceMetadata()">🔄 Sync Alliance Metadata</button>
                <a *ngIf="data()?.alliance as ally" [routerLink]="['/admin', 'alliances', ally.uuid, 'confidence']" class="tool-btn conf-btn">
                    📈 Confidence
                </a>
                <button class="tool-btn simulate-btn" (click)="simulateAssignments()">🎲 Simulate Assignments</button>
                <button class="tool-btn show-hide-btn" (click)="showAssignments = !showAssignments">
                    {{ showAssignments ? '👁️ Hide Assignments' : '👁️ Show Assignments' }}
                </button>
                <button class="tool-btn msg-btn" (click)="showMessagingView = true">📨 Messaging View</button>
            </div>

            <!-- Quit Members Warning -->
            @if (quitMembersInEvent().length > 0) {
                <div class="quit-members-section">
                    <h3>🛑 Quit Members in Event</h3>
                    <div class="quit-list">
                        @for (char of quitMembersInEvent(); track char.characterId) {
                            <div class="quit-item">
                                <span class="name">{{ char.characterName }}</span>
                                <button class="remove-quit-btn" (click)="removeCharacterById(char.characterId, char.characterName)">Remove</button>
                            </div>
                        }
                    </div>
                </div>
            }

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
                            <th>Stats</th>
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
                                <div class="char-power">⚡ {{ formatPower(row.assignment.powerLevel) }}</div>
                                @if (row.assignment.mainCharacterId) {
                                    <div class="farm-badge">🚜 Farm</div>
                                    <div class="main-char-link">Main: {{ row.mainCharacterName }}</div>
                                    @if ((row.assignment.maxReinforcementMarches ?? 0) > 0) {
                                        <div class="extra-marches-badge">Max Reinforcements: {{ row.assignment.maxReinforcementMarches }}</div>
                                    }
                                } @else {
                                    <div class="main-badge">👑 Main</div>
                                }
                                @if (row.isRemovedFromAlliance) {
                                    <div class="removed-badge">🚫 Left Alliance</div>
                                }
                                @if (row.isQuit) {
                                    <div class="quit-badge">🛑 Quit</div>
                                }
                            </td>
                            <td>
                                <!-- Confidence -->
                                @if (row.assignment.confidenceLevel !== undefined) {
                                    <span class="conf-badge" 
                                          [class.high]="row.assignment.confidenceLevel >= 0.7"
                                          [class.low]="row.assignment.confidenceLevel < 0.5">
                                        Conf: {{ row.assignment.confidenceLevel | number:'1.2-2' }}
                                    </span>
                                } @else {
                                    <span class="conf-badge neutral">Conf: -</span>
                                }
                                
                                <!-- Expected Marches -->
                                @if (row.expectedMarches !== undefined) {
                                    <br>
                                    <span class="surv-badge"
                                          [class.good]="row.expectedMarches >= (row.assignment.reinforcementCapacity || 0)"
                                          [class.ok]="row.expectedMarches >= ((row.assignment.reinforcementCapacity || 1) - 1) && row.expectedMarches < (row.assignment.reinforcementCapacity || 0)"
                                          [class.bad]="row.expectedMarches < ((row.assignment.reinforcementCapacity || 1) - 1)">
                                        Exp: {{ row.expectedMarches | number:'1.1-1' }}
                                    </span>
                                }

                                <!-- Score -->
                                <span class="score-info" *ngIf="row.assignment.score">(Exp Sc: {{ row.assignment.score | number:'1.2-2' }})</span>
                            </td>
                            <td>
                                <div class="status-pill" [class]="row.assignment.status">
                                    {{ row.assignment.status | uppercase }}
                                </div>
                                <div *ngIf="row.assignment.actualStatus" class="status-pill actual" [class]="row.assignment.actualStatus">
                                    Expected: {{ row.assignment.status | uppercase }} | Actual: {{ row.assignment.actualStatus | uppercase }}
                                </div>

                                <div class="marches">
                                    Marches: {{ row.assignment.marchesCount }} | 
                                    Cap: {{ row.assignment.reinforcementCapacity ? (row.assignment.reinforcementCapacity | number) : '-' }}
                                </div>
                                @if (showAssignments) {
                                    @if (row.resolvedReinforcements && row.resolvedReinforcements.length > 0) {
                                        <div class="reinforcements-list">
                                            <div class="reinforce-header">Reinforces:</div>
                                            @for (item of row.resolvedReinforcements; track $index) {
                                                <div class="reinforce-item">
                                                    <span class="status-dot" [class]="item.status" [title]="item.status"></span>
                                                    🛡️ {{ item.name }} {{ item.marchType ? '(' + item.marchType + ')' : '' }}
                                                    @if (item.confidenceLevel !== undefined) {
                                                        <span class="mini-conf" [class.high]="item.confidenceLevel >= 1.5" [class.low]="item.confidenceLevel < 1.0">
                                                            {{ item.confidenceLevel | number:'1.1-1' }}
                                                        </span>
                                                    }
                                                    @if (item.scoreValue) {
                                                        <span class="score-badge">({{ item.scoreValue | number:'1.2-2' }})</span>
                                                    }
                                                </div>
                                            }
                                        </div>
                                    }
                                    @if (row.reinforcedBy && row.reinforcedBy.length > 0) {
                                        <div class="reinforcements-list incoming">
                                            <div class="reinforce-header">Reinforced By:</div>
                                            @for (item of row.reinforcedBy; track $index) {
                                                <div class="reinforce-item">
                                                    <span class="status-dot" [class]="item.status" [title]="item.status"></span>
                                                    🛡️ {{ item.name }} {{ item.marchType ? '(' + item.marchType + ')' : '' }}
                                                    @if (item.confidenceLevel !== undefined) {
                                                        <span class="mini-conf" [class.high]="item.confidenceLevel >= 1.5" [class.low]="item.confidenceLevel < 1.0">
                                                            {{ item.confidenceLevel | number:'1.1-1' }}
                                                        </span>
                                                    }
                                                </div>
                                            }
                                        </div>
                                    }
                                }
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
                            <option value="offline_not_empty">OFFLINE (Not Empty)</option>
                            <option value="unknown">UNKNOWN</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Actual Status</label>
                        <select [(ngModel)]="editActualStatus">
                            <option [ngValue]="undefined">Same as Expected</option>
                            <option value="online">ONLINE</option>
                            <option value="offline_empty">OFFLINE (Empty)</option>
                            <option value="offline_not_empty">OFFLINE (Not Empty)</option>
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
                        <label>Reinforcement Capacity</label>
                        <input type="number" [(ngModel)]="editReinforcementCapacity">
                    </div>
                    <div class="form-group">
                        <label>Max Reinforcement Marches</label>
                        <input type="number" [(ngModel)]="editMaxReinforcementMarches">
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
                        <label>Reinforcement Capacity</label>
                        <input type="number" [(ngModel)]="newReinforcementCapacity">
                    </div>
                    <div class="form-group">
                        <label>Max Reinforcement Marches</label>
                        <input type="number" [(ngModel)]="newMaxReinforcementMarches">
                    </div>
                    <div class="modal-actions">
                        <button (click)="addCharacter()">Add</button>
                        <button (click)="showAddModal = false">Cancel</button>
                    </div>
                </div>
            </div>

            <!-- Simulation Modal -->
            <div class="modal-backdrop" *ngIf="showSimulationModal">
                <div class="modal">
                    <h3>🎲 Simulate Assignments</h3>
                    <p>Select an algorithm to distribute reinforcements:</p>
                    <div class="form-group">
                        <label>Algorithm</label>
                        <select [(ngModel)]="selectedAlgorithmName">
                            @for (algo of availableAlgorithms; track algo.name) {
                                <option [value]="algo.name">{{ algo.name | titlecase }}</option>
                            }
                        </select>
                        <div class="help-text" *ngIf="selectedAlgorithmDescription">
                            {{ selectedAlgorithmDescription }}
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button (click)="runSimulation()">Run Simulation</button>
                        <button (click)="showSimulationModal = false; selectedAlgorithmName = 'greedy'">Cancel</button>
                    </div>
                </div>
            </div>

            <!-- Status Change Modal -->
            <div class="modal-backdrop" *ngIf="showStatusModal">
                <div class="modal">
                    <h3>Change Event Status</h3>
                    <div class="form-group">
                        <label>Status</label>
                        <select [(ngModel)]="selectedStatus">
                            <option value="voting">VOTING</option>
                            <option value="finalized">FINALIZED</option>
                            <option value="finished">FINISHED</option>
                            <option value="past">PAST</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button (click)="updateStatus()">Save</button>
                        <button (click)="showStatusModal = false">Cancel</button>
                    </div>
                </div>
            </div>

            <!-- Messaging View Overlay -->
            <div class="messaging-view-overlay" *ngIf="showMessagingView">
                <div class="mv-header">
                    <h2>📨 Messaging View (Online & Offline Empty)</h2>
                    @if (notificationMessage) {
                        <div class="notification-toast">{{ notificationMessage }}</div>
                    }
                    <button class="close-btn" (click)="closeMessagingView()">Close</button>
                </div>
                <div class="mv-content">
                    <div class="mv-table-container">
                        <table class="mv-table">
                            <thead>
                                <tr>
                                    <th class="col-name">Name</th>
                                    <th class="col-power">Power</th>
                                    <th class="col-status">Status</th>
                                    <th class="col-action">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (row of messagingList(); track row.assignment.characterId) {
                                    <tr (click)="copyMessage(row)">
                                        <td class="col-name">{{ row.assignment.characterName }}</td>
                                        <td class="col-power">{{ row.assignment.powerLevel | number }}</td>
                                        <td class="col-status">
                                            <span class="status-dot" [class]="row.assignment.status" [title]="row.assignment.status"></span>
                                        </td>
                                        <td class="col-action">
                                            <span class="copy-icon">📋</span>
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        </table>
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
        .alliance-link { color: #888; text-decoration: none; transition: color 0.2s; }
        .alliance-link:hover { color: #2196f3; text-decoration: underline; }

        .stats-summary { display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap; }
        .stat-pill { padding: 0.3rem 0.8rem; border-radius: 16px; font-weight: bold; font-size: 0.85rem; border: 1px solid transparent; }
        .stat-pill.total { background: #333; color: #fff; border-color: #555; }
        .stat-pill.online { background: rgba(76, 175, 80, 0.1); color: #81c784; border-color: #81c784; }
        .stat-pill.offline_empty { background: rgba(255, 152, 0, 0.1); color: #ffb74d; border-color: #ffb74d; }
        .stat-pill.offline_not_empty { background: rgba(244, 67, 54, 0.1); color: #e57373; border-color: #e57373; }
        .stat-pill.unknown { background: #444; color: #aaa; border-color: #666; }
        
        /* Removed surv-config styles */

        .toolbar { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .tool-btn { border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .add-btn { background: #4caf50; color: white; }
        .sync-btn { background: #2196f3; color: white; }
        .meta-btn { background: #9c27b0; color: white; }
        .conf-btn { background: #673ab7; color: white; text-decoration: none; display: flex; align-items: center; }
        .simulate-btn { background: #00bcd4; color: white; }
        .show-hide-btn { background: #607d8b; color: white; }
        .show-hide-btn { background: #607d8b; color: white; }
        .msg-btn { background: #ff9800; color: white; }
        .status-btn-link { background: #e91e63; color: white; text-decoration: none; display: flex; align-items: center; }
        
        .status-badge { 
            display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: bold; margin-left: 1rem; font-size: 0.8rem; vertical-align: middle;
        }
        .status-badge.voting { background: #2196f3; color: white; }
        .status-badge.finalized { background: #4caf50; color: white; }
        .status-badge.finished { background: #9e9e9e; color: white; border: 1px solid #777; }

        .status-btn {
            background: none; border: 1px solid #555; color: #aaa; padding: 0.2rem 0.6rem; border-radius: 4px; margin-left: 0.5rem; cursor: pointer; font-size: 0.75rem; vertical-align: middle;
        }
        .status-btn:hover { background: #333; color: white; }

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

        .quit-members-section {
            background: #3e2723; border: 1px solid #c62828; border-radius: 8px; padding: 1rem; margin-bottom: 2rem;
        }
        .quit-members-section h3 { margin-top: 0; color: #e57373; font-size: 1rem; }
        .quit-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .quit-item {
            background: rgba(0,0,0,0.3); padding: 0.5rem 1rem; border-radius: 20px; display: flex; align-items: center; gap: 0.5rem; border: 1px solid #c62828;
        }
        .quit-item .name { font-weight: bold; color: #e57373; }
        .remove-quit-btn {
            background: #c62828; color: white; border: none; padding: 0.2rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;
        }

        .table-container { background: #222; border-radius: 8px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 1rem; background: #333; color: #aaa; font-weight: bold; font-size: 0.9rem; }
        td { padding: 1rem; border-bottom: 1px solid #333; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        
        .char-name { font-weight: bold; color: white; }
        .char-id { color: #888; font-size: 0.8rem; font-family: monospace; }
        .char-power { color: #ffd54f; font-size: 0.8rem; font-weight: bold; margin-top: 0.2rem; }
        
        .status-pill {
            display: inline-block; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold; margin-bottom: 0.3rem;
        }
        .status-pill.actual { border: 1px solid #fff; } 
        .status-pill.online { background: rgba(76, 175, 80, 0.2); color: #81c784; }
        .status-pill.offline_empty { background: rgba(255, 152, 0, 0.2); color: #ffb74d; }
        .status-pill.not_available, .status-pill.offline_not_empty { background: rgba(244, 67, 54, 0.2); color: #e57373; }
        .status-pill.unknown { background: #444; color: #aaa; }

        .conf-badge { font-weight: bold; font-size: 0.85rem; padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; }
        .conf-badge.high { color: #81c784; background: rgba(76, 175, 80, 0.1); border: 1px solid #2e7d32; }
        .conf-badge.low { color: #e57373; background: rgba(244, 67, 54, 0.1); border: 1px solid #c62828; }
        .conf-badge.low { color: #e57373; background: rgba(244, 67, 54, 0.1); border: 1px solid #c62828; }
        .conf-badge.neutral { color: #aaa; }

        .mini-conf { font-size: 0.7rem; padding: 0 0.3rem; border-radius: 3px; border: 1px solid #444; color: #aaa; background: #333; margin-left: 0.3rem; font-weight: bold; }
        .mini-conf.high { color: #81c784; border-color: #2e7d32; background: rgba(76, 175, 80, 0.1); }
        .mini-conf.high { color: #81c784; border-color: #2e7d32; background: rgba(76, 175, 80, 0.1); }
        .mini-conf.low { color: #e57373; border-color: #c62828; background: rgba(244, 67, 54, 0.1); }

        .surv-badge { font-weight: bold; font-size: 0.85rem; padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin-top: 0.3rem; }
        .surv-badge.good { background: rgba(76, 175, 80, 0.1); color: #81c784; border: 1px solid #2e7d32; }
        .surv-badge.ok { background: rgba(255, 152, 0, 0.1); color: #ffb74d; border: 1px solid #ef6c00; }
        .surv-badge.bad { background: rgba(244, 67, 54, 0.1); color: #e57373; border: 1px solid #c62828; }
        
        .score-info { font-size: 0.75rem; color: #888; display: block; margin-top: 0.2rem; }

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
        .quit-badge {
            display: inline-block; background: #b71c1c; color: white; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; margin-top: 0.3rem; font-weight: bold;
        }

        .farm-badge { display: inline-block; background: #795548; color: white; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; }
        .main-badge { display: inline-block; background: #5d4037; color: #ffd54f; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid #ffd54f; }
        .main-char-link { font-size: 0.75rem; color: #aaa; margin-top: 0.2rem; }
        .extra-marches-badge { font-size: 0.7rem; color: #81c784; margin-top: 0.2rem; }
        
        .reinforcements-list { margin-top: 0.5rem; border-top: 1px solid #444; padding-top: 0.3rem; }
        .reinforcements-list.incoming { border-top: none; border-top: 1px dashed #444; margin-top: 0.3rem; }
        .reinforcements-list.incoming .reinforce-header { color: #81c784; }
        
        .reinforce-header { font-size: 0.7rem; color: #aaa; text-transform: uppercase; margin-bottom: 0.2rem; }
        .reinforce-item { font-size: 0.8rem; color: #fff; margin-bottom: 0.1rem; display: flex; align-items: center; gap: 0.3rem; }
        
        .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .status-dot.online { background: #81c784; box-shadow: 0 0 4px #81c784; }
        .status-dot.offline_empty { background: #ffb74d; }
        .status-dot.not_available, .status-dot.offline_not_empty { background: #e57373; }
        .status-dot.unknown { background: #666; }

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

        /* Messaging View */
        .messaging-view-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #1a1a1a; z-index: 2000;
            display: flex; flex-direction: column;
            overflow: hidden;
        }
        .mv-header {
            padding: 0.5rem 1rem; background: #333; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            flex-shrink: 0;
        }
        .mv-header h2 { margin: 0; color: #ff9800; font-size: 1.1rem; }
        .mv-content {
            flex: 1; overflow-y: auto; padding: 0.5rem; background: #222;
        }
        .mv-table-container { 
            width: 100%; overflow-x: auto; 
        }
        .mv-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .mv-table th { 
            text-align: left; padding: 0.5rem; background: #333; color: #aaa; position: sticky; top: 0; z-index: 10;
            border-bottom: 2px solid #555;
        }
        .mv-table td { 
            padding: 0.4rem 0.5rem; border-bottom: 1px solid #333; vertical-align: middle; 
            cursor: pointer;
        }
        .mv-table tr:hover td { background: #333; }
        
        /* Compact columns */
        .col-name { font-weight: bold; color: white; width: 40%; }
        .col-power { color: #aaa; width: 25%; text-align: right; }
        .col-status { width: 15%; text-align: center; }
        .col-action { width: 10%; text-align: center; }

        .copy-icon { font-size: 1.2rem; }
        
        .close-btn {
            background: #444; color: white; border: none; padding: 0.3rem 0.8rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.9rem;
        }
        .notification-toast {
            background: #4caf50; color: white; padding: 0.3rem 0.8rem; border-radius: 20px; animation: fadeIn 0.3s; font-weight: bold; font-size: 0.8rem;
            position: absolute; top: 3.5rem; left: 50%; transform: translateX(-50%); z-index: 2001;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }

        /* Status Dot specific for table */
        .mv-table .status-dot { margin: 0 auto; display: block; }
        
        .help-text { font-size: 0.8rem; color: #888; margin-top: 0.3rem; font-style: italic; }
    `],
    imports: [CommonModule, RouterLink, FormsModule]
})
export class VikingsEventManagementComponent {
    private route = inject(ActivatedRoute);
    private vikingsService = inject(VikingsService);
    private alliancesService = inject(AlliancesService);
    private breadcrumbService = inject(AdminBreadcrumbService);

    public eventId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));

    public formatPower(power: number | undefined): string {
        if (power === undefined || power === null) return '-';
        if (power >= 1_000_000_000) return (power / 1_000_000_000).toFixed(1) + ' B';
        if (power >= 1_000_000) return (power / 1_000_000).toFixed(1) + ' M';
        if (power >= 1_000) return (power / 1_000).toFixed(1) + ' k';
        return power.toString();
    }

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
                            map(([regs, alliance]) => {
                                // Set Breadcrumbs
                                if (alliance) {
                                    this.breadcrumbService.setLabel(alliance.uuid, `[${alliance.tag}] ${alliance.name || 'Unknown'}`);
                                }
                                if (event && event.id) {
                                    // Format date for display
                                    const dateStr = event.date?.toDate ? event.date.toDate().toLocaleDateString() : 'Event';
                                    // Using event.id as the segment key
                                    this.breadcrumbService.setLabel(event.id, `Vikings (${dateStr})`);

                                    // Also set 'vikings' segment label if needed, though 'Vikings' heuristic handles it.
                                }
                                return { event, regs, alliance };
                            })
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
        return (data.alliance.members || []).filter(m => !eventCharIds.has(m.characterId) && !m.quit);
    });

    public quitMembersInEvent = computed(() => {
        const data = this.data();
        if (!data || !data.event || !data.alliance) return [];

        const allianceMemberMap = new Map((data.alliance.members || []).map(m => [m.characterId, m]));
        return data.event.characters.filter(c => {
            const m = allianceMemberMap.get(c.characterId);
            return m && m.quit;
        });
    });

    public stats = computed(() => {
        const rows = this.rows();
        const s = {
            online: 0,
            offline_empty: 0,
            offline_not_empty: 0,
            unknown: 0,
            total: rows.length
        };
        rows.forEach(r => {
            const status = r.assignment.status;
            if (status === 'online') s.online++;
            else if (status === 'offline_empty') s.offline_empty++;
            else if (status === 'offline_not_empty') s.offline_not_empty++;
            else s.unknown++;
        });
        return s;
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
            const m = data.alliance?.members?.find(mem => mem.characterId === a.characterId);

            // Diff logic: Check if status or marches count differs
            // Target Marches: Registration > Alliance Member > Current
            const regMarches = r ? r.marchesCount : undefined;
            const allyMarches = m ? m.marchesCount : undefined;

            let targetMarches = a.marchesCount;
            if (regMarches !== undefined) {
                targetMarches = regMarches;
            } else if (allyMarches !== undefined) {
                targetMarches = allyMarches;
            }

            const marchesDiff = a.marchesCount !== targetMarches;
            const statusDiff = !!r && (r.status !== a.status);
            const hasDiff = statusDiff || marchesDiff;

            // Check if removed from alliance (only if we have alliance data)
            const isRemovedFromAlliance = !!data.alliance && !allianceMemberIds.has(a.characterId);
            const isQuit = !!m && !!m.quit;

            // Resolve Main Character Name
            let mainCharacterName = undefined;
            if (a.mainCharacterId) {
                mainCharacterName = nameMap.get(a.mainCharacterId) || `ID: ${a.mainCharacterId}`;
            }



            // Status & Confidence Map for Reinforcements
            const statusMap = new Map<string, string>();
            const confidenceMap = new Map<string, number | undefined>();
            const incomingReinforcementMap = new Map<string, ResolvedReinforcement[]>();

            assignments.forEach(c => {
                statusMap.set(c.characterId, c.status);
                confidenceMap.set(c.characterId, c.confidenceLevel);

                // Build incoming map
                if (c.reinforce) {
                    c.reinforce.forEach(r => {
                        const targetId = r.characterId;
                        const sourceName = nameMap.get(c.characterId) || `ID: ${c.characterId}`;
                        const sourceStatus = getCharacterStatus(c);
                        const sourceConfidence = c.confidenceLevel;

                        const list = incomingReinforcementMap.get(targetId) || [];
                        list.push({
                            name: sourceName,
                            status: sourceStatus,
                            marchType: r.marchType,
                            confidenceLevel: sourceConfidence
                        });
                        incomingReinforcementMap.set(targetId, list);
                    });
                }
            });

            // Resolve Reinforcements (Outgoing)
            const resolvedReinforcements: ResolvedReinforcement[] = (a.reinforce || []).map(r => {
                const name = nameMap.get(r.characterId) || `ID: ${r.characterId}`;
                const rawStatus = statusMap.get(r.characterId);
                const status = getCharacterStatus({ status: rawStatus });
                const confidenceLevel = confidenceMap.get(r.characterId);
                return { name, marchType: r.marchType, status, scoreValue: r.scoreValue, confidenceLevel };
            });

            // Resolve Reinforced By (Incoming)
            const reinforcedBy = incomingReinforcementMap.get(a.characterId) || [];

            // Calculate Expected Marches
            // Sum of incoming confidence levels
            const expectedMarches = reinforcedBy.reduce((sum, r) => sum + (r.confidenceLevel !== undefined ? r.confidenceLevel : 0.5), 0);

            return {
                assignment: a,
                registration: r,
                allianceMember: m,
                hasDiff,
                isRemovedFromAlliance,
                isQuit,
                mainCharacterName,
                resolvedReinforcements,
                reinforcedBy,
                expectedMarches,
                actualStatus: a.actualStatus
            } as ManagementRow;
        }).sort((a, b) => b.assignment.powerLevel - a.assignment.powerLevel); // Sort by power
    });

    // Edit State
    public editingRow: ManagementRow | null = null;
    public editStatus: any = 'unknown';
    public editActualStatus: any = undefined;
    public editMarches: number = 0;
    public editPower: number = 0;
    public editMainCharacterId: string = '';

    public editReinforcementCapacity: number | null = null;
    public editMaxReinforcementMarches: number | null = null;

    // Add State
    public showAddModal = false;
    public newCharName = '';
    public newCharId = '';
    public newCharPower = 0;
    public newMainCharacterId = '';

    public newReinforcementCapacity = 0;
    public newMaxReinforcementMarches = 0;

    // Simulation State
    public showSimulationModal = false;
    public availableAlgorithms: AssignmentAlgorithm[] = [];
    public selectedAlgorithmName = 'greedy';

    public get selectedAlgorithmDescription(): string {
        return this.availableAlgorithms.find(a => a.name === this.selectedAlgorithmName)?.description || '';
    }

    // View State
    public showAssignments = true;

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
        // Source of truth: Registration > Alliance Member
        let newStatus = row.assignment.status;
        let newMarches = row.assignment.marchesCount;

        if (row.registration) {
            newStatus = row.registration.status;
            newMarches = row.registration.marchesCount;
        } else if (row.allianceMember && row.allianceMember.marchesCount !== undefined) {
            newMarches = row.allianceMember.marchesCount;
        }

        await this.updateCharacter(row.assignment.characterId, {
            status: newStatus,
            marchesCount: newMarches
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
            reinforcementCapacity: member.reinforcementCapacity,
            status: 'unknown',
            marchesCount: member.marchesCount !== undefined ? member.marchesCount : 0,
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
        this.editActualStatus = row.assignment.actualStatus;
        this.editMarches = row.assignment.marchesCount;
        this.editPower = row.assignment.powerLevel;
        this.editMainCharacterId = row.assignment.mainCharacterId || '';

        this.editReinforcementCapacity = row.assignment.reinforcementCapacity ?? null;
        this.editMaxReinforcementMarches = row.assignment.maxReinforcementMarches ?? null;

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
            actualStatus: this.editActualStatus,
            marchesCount: this.editMarches,
            powerLevel: this.editPower,

            mainCharacterId: this.editMainCharacterId || undefined,
            reinforcementCapacity: this.editReinforcementCapacity ?? undefined,
            maxReinforcementMarches: this.editMaxReinforcementMarches ?? undefined
        };

        if (changes.mainCharacterId === undefined || changes.mainCharacterId === '') delete changes.mainCharacterId;
        if (changes.reinforcementCapacity === undefined || changes.reinforcementCapacity === null) delete changes.reinforcementCapacity;
        if (changes.maxReinforcementMarches === undefined || changes.maxReinforcementMarches === null) delete changes.maxReinforcementMarches;

        await this.updateCharacter(this.editingRow.assignment.characterId, changes);
        this.editingRow = null;
    }

    public async deleteRow(row: ManagementRow) {
        await this.removeCharacterById(row.assignment.characterId, row.assignment.characterName);
    }

    public async removeCharacterById(charId: string, name: string) {
        if (!confirm(`Remove ${name} from event?`)) return;

        const eventId = this.eventId();
        const event = this.event();
        if (!eventId || !event) return;

        const newCharacters = event.characters.filter(c => c.characterId !== charId);

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
            reinforcementCapacity: this.newReinforcementCapacity || undefined,
            maxReinforcementMarches: this.newMaxReinforcementMarches || 0,
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
            this.newReinforcementCapacity = 0;
            this.newMaxReinforcementMarches = 0;
        } catch (e) {
            console.error(e);
            alert('Failed to add character');
        }
    }

    // Messaging View State
    public showMessagingView = false;
    public notificationMessage: string | null = null; // Reusing or adding new for feedbacks

    public messagingList = computed(() => {
        const rows = this.rows();
        // Filter: Online OR Offline Empty
        // Sort: Power Desc
        return rows
            .filter(r => r.assignment.status === 'online' || r.assignment.status === 'offline_empty')
            .sort((a, b) => b.assignment.powerLevel - a.assignment.powerLevel);
    });

    public async copyMessage(row: ManagementRow) {
        const text = this.vikingsService.generateAssignmentClipboardText(row.assignment);
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification(`Message for ${row.assignment.characterName} copied!`);
        } catch (err) {
            console.error('Failed to copy', err);
            this.showNotification('Failed to copy message', true);
        }
    }

    private showNotification(msg: string, isError = false) {
        this.notificationMessage = msg;
        setTimeout(() => this.notificationMessage = null, 2000);
    }

    public closeMessagingView() {
        this.showMessagingView = false;
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



    public async cycleStatus() {
        // Deprecated - replaced by openStatusModal
    }

    // Status Modal State
    public showStatusModal = false;
    public selectedStatus = '';

    public openStatusModal() {
        const event = this.event();
        if (!event) return;
        this.selectedStatus = event.status;
        this.showStatusModal = true;
    }

    public async updateStatus() {
        const eventId = this.eventId();
        if (!eventId) return;

        try {
            await this.vikingsService.updateVikingsEvent(eventId, { status: this.selectedStatus as any });
            this.showStatusModal = false;
        } catch (e) {
            console.error(e);
            alert('Failed to update status');
        }
    }

    public simulateAssignments() {
        this.availableAlgorithms = this.vikingsService.getAvailableAlgorithms();
        this.selectedAlgorithmName = 'greedy'; // Default
        this.showSimulationModal = true;
    }

    public async runSimulation() {
        if (!confirm('This will overwrite current temporary assignments. Continue?')) return;

        const eventId = this.eventId();
        if (!eventId) return;

        try {
            await this.vikingsService.simulateAssignments(eventId, this.selectedAlgorithmName);
            alert('Assignments simulated!');
            this.showSimulationModal = false;
        } catch (err) {
            console.error(err);
            alert('Failed to simulate assignments.');
        }
    }

    public async syncAllianceMetadata() {
        if (!confirm('Sync metadata (Main Character ID, Reinforcement Capacity, Marches Count) from Alliance member list to this event? This will overwrite manual changes to these fields in this event.')) return;

        const data = this.data();
        if (!data || !data.event || !data.alliance) return;

        const allianceMembers = new Map(data.alliance.members?.map(m => [m.characterId, m]));
        let updateCount = 0;

        const newCharacters = data.event.characters.map(char => {
            const member = allianceMembers.get(char.characterId);
            if (member) {
                const marchDiff = member.marchesCount !== undefined && member.marchesCount !== char.marchesCount;
                const mainDiff = member.mainCharacterId !== char.mainCharacterId;
                const capDiff = member.reinforcementCapacity !== char.reinforcementCapacity;
                const confDiff = member.confidenceLevel !== char.confidenceLevel;

                if (marchDiff || mainDiff || capDiff || confDiff) {
                    updateCount++;
                    const updated: CharacterAssignment = {
                        ...char,
                        mainCharacterId: member.mainCharacterId,
                        reinforcementCapacity: member.reinforcementCapacity,
                        confidenceLevel: member.confidenceLevel
                    };
                    if (member.marchesCount !== undefined) {
                        updated.marchesCount = member.marchesCount;
                    }
                    return updated;
                }
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
