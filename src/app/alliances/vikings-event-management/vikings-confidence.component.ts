import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { VikingsService } from '../../vikings-event/vikings.service';
import { AlliancesService, AllianceMember } from '../alliances.service';
import { VikingsEvent } from '../../vikings-event/vikings.types';
import { toSignal } from '@angular/core/rxjs-interop';
import { getMemberConfidence } from '../../vikings-event/vikings.helpers';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-vikings-confidence',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="page-container">
      <div class="header-row">
        <h1>Confidence Levels</h1>
        <div class="actions">
           <button class="btn back-btn" (click)="goBack()">Back</button>
           <button class="btn save-btn" (click)="saveConfidence()">Save All Changes</button>
        </div>
      </div>

      <div class="content-grid">
         <!-- Summary -->
         <div class="summary-card">
            <p>
               Confidence levels help prioritize reliable players for reinforcement assignments.
               <br>
               <span class="high-conf-text">1.0</span> = High Confidence (Reliable)
               <br>
               <span class="low-conf-text">0.0</span> = Low Confidence (Unreliable)
            </p>
         </div>

         <!-- Members List -->
         <div class="table-container">
             <table class="data-table">
                 <thead>
                     <tr>
                         <th class="col-member">Member</th>
                         <th class="col-center">Current Events</th>
                         <th class="col-center">Calculated Confidence</th>
                         <th class="col-center">Stored Confidence</th>
                         <th class="col-center">Action</th>
                     </tr>
                 </thead>
                 <tbody>
                     @for (member of membersWithScore(); track member.characterId) {
                         <tr class="data-row">
                             <td class="col-member font-semibold">{{ member.name }}</td>
                             <td class="col-center text-muted">{{ member.eventCount }}</td>
                             <td class="col-center clickable-cell" (click)="openDetails(member)" title="Click to view details">
                                <span class="badge"
                                      [class.badge-high]="member.calculatedScore >= 0.7"
                                      [class.badge-low]="member.calculatedScore < 0.5">
                                    {{ member.calculatedScore | number:'1.1-2' }}
                                </span>
                                <div class="confidence-details">
                                    @for (detail of member.details; track detail.eventId) {
                                        <div class="event-dot"
                                             [class.match]="detail.isMatch"
                                             [class.mismatch]="!detail.isMatch">
                                        </div>
                                    }
                                </div>
                             </td>
                             <td class="col-center text-muted">
                                {{ member.storedScore | number:'1.1-2' }}
                             </td>
                             <td class="col-center">
                                 @if (member.storedScore !== member.calculatedScore) {
                                     <button class="link-btn"
                                             (click)="updateMember(member.characterId, member.calculatedScore)">
                                         Update
                                     </button>
                                 } @else {
                                     <span class="synced-text">Synced</span>
                                 }
                             </td>
                         </tr>
                     }
                 </tbody>
             </table>
         </div>
      </div>

      @if (selectedMember(); as selected) {
        <div class="modal-backdrop" (click)="closeDetails()">
            <div class="modal-content" (click)="$event.stopPropagation()">
                <div class="modal-header">
                    <h3>History: {{ selected.name }}</h3>
                    <button class="close-btn" (click)="closeDetails()">×</button>
                </div>
                <div class="modal-body">
                    <table class="details-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Expected</th>
                                <th>Actual</th>
                                <th>Match</th>
                                <th>Weight</th>
                            </tr>
                        </thead>
                        <tbody>
                            @for (detail of selected.details; track detail.eventId) {
                                <tr>
                                    <td>{{ getSafeDate(detail.date) | date:'dd/MM/yyyy' }}</td>
                                    <td>
                                        <span class="status-dot-large" [class]="detail.expectedStatus" [title]="detail.expectedStatus"></span>
                                    </td>
                                    <td>
                                        <span class="status-dot-large" [class]="detail.actualStatus" [title]="detail.actualStatus"></span>
                                    </td>
                                    <td>
                                        @if (detail.isMatch) {
                                            <span class="match-icon">✅</span>
                                        } @else {
                                            <span class="mismatch-icon">❌</span>
                                        }
                                    </td>
                                    <td class="text-muted">{{ detail.weight | number:'1.2-2' }}</td>
                                </tr>
                            } @empty {
                                <tr><td colspan="4">No relevant history found.</td></tr>
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      }
    </div>
  `,
    styles: [`
    .page-container {
        padding: 2rem;
        background-color: #121212; /* Dark bg */
        min-height: 100vh;
        color: #eee;
        font-family: sans-serif;
    }
    @media (max-width: 600px) {
        .page-container {
            padding: 1rem;
        }
    }

    /* ... skipping intermediate styles ... */

    .table-container {
        background-color: #1e1e1e;
        border-radius: 8px;
        overflow-x: auto; /* Enable horizontal scroll */
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        border: 1px solid #333;
    }

    .data-table {
        width: 100%;
        min-width: 600px; /* Ensure table keeps structure and triggers scroll */
        border-collapse: collapse;
        text-align: left;
    }

    th {
        background-color: #121212;
        color: #ffca28;
        text-transform: uppercase;
        font-size: 0.85rem;
        padding: 1rem;
        border-bottom: 1px solid #333;
    }

    td {
        padding: 1rem;
        border-bottom: 1px solid #333;
        vertical-align: middle;
    }

    .data-row:hover {
        background-color: #2c2c2c;
    }

    .data-row:last-child td {
        border-bottom: none;
    }

    .col-member { font-weight: 600; }
    .col-center { text-align: center; }
    
    .clickable-cell {
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .clickable-cell:hover {
        background-color: #333;
    }

    .text-muted { color: #aaa; }

    .badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-weight: bold;
        font-size: 0.9rem;
    }

    .badge-high {
        background-color: rgba(27, 94, 32, 0.4); /* Dark Green bg */
        color: #81c784; /* Light Green text */
        border: 1px solid #2e7d32;
    }

    .badge-low {
        background-color: rgba(183, 28, 28, 0.4); /* Dark Red bg */
        color: #e57373; /* Light Red text */
        border: 1px solid #c62828;
    }

    .link-btn {
        background: none;
        border: none;
        color: #42a5f5; /* Blue */
        text-decoration: underline;
        cursor: pointer;
        font-size: 0.85rem;
    }
    .link-btn:hover { color: #90caf9; }

    .synced-text {
        color: #66bb6a;
        font-size: 0.75rem;
    }

    .confidence-details {
       display: flex;
       gap: 4px;
       justify-content: center;
       margin-top: 6px;
    }

    .event-dot {
       width: 8px;
       height: 8px;
       border-radius: 50%;
       cursor: pointer;
    }

    .match {
       background-color: #66bb6a; /* Green */
    }

    .mismatch {
       background-color: #ef5350; /* Red */
    }

    /* Modal Styles */
    .modal-backdrop {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(2px);
    }

    .modal-content {
        background: #1e1e1e;
        border-radius: 8px;
        width: 100%;
        max-width: 500px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 1px solid #333;
        overflow: hidden;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid #333;
        background: #252525;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; color: #fff; }

    .close-btn {
        background: none;
        border: none;
        color: #aaa;
        font-size: 1.5rem;
        cursor: pointer;
    }

    .modal-body {
        padding: 1rem;
    }

    .details-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
    }
    .details-table th { text-align: left; padding: 0.5rem; border-bottom: 1px solid #444; color: #aaa; }
    .details-table td { padding: 0.5rem; border-bottom: 1px solid #333; color: #ddd; }
    .details-table tr:last-child td { border-bottom: none; }

    .status-dot-large {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }
    .status-dot-large.online { background-color: #66bb6a; box-shadow: 0 0 4px #66bb6a; }
    .status-dot-large.offline_empty { background-color: #ffa726; /* Orange */ }
    .status-dot-large.offline_not_empty { background-color: #ef5350; /* Red */ }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VikingsConfidenceComponent {
    private vikingsService = inject(VikingsService);
    private alliancesService = inject(AlliancesService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    private allianceId = signal<string>('');

    // Data
    private events = toSignal(this.vikingsService.getAllVikingsEvents(), { initialValue: [] as VikingsEvent[] });
    private members = signal<AllianceMember[]>([]);

    // UI State
    public selectedMember = signal<{ name: string; details: any[] } | null>(null);

    // Computed
    public membersWithScore = computed(() => {
        const evs = this.events();
        const mems = this.members();
        const aId = this.allianceId();

        // Filter events for this alliance
        const relevantEvents = evs.filter((e: VikingsEvent) => e.allianceId === aId);

        return mems.map((m: AllianceMember) => {
            const result = this.vikingsService.getConfidenceDetails(m.characterId, relevantEvents);
            return {
                ...m,
                calculatedScore: result.score,
                details: result.details,
                storedScore: getMemberConfidence(m),
                eventCount: relevantEvents.filter((e: VikingsEvent) => e.status === 'finished' && e.characters.some(c => c.characterId === m.characterId)).length
            };
        }).sort((a, b) => b.calculatedScore - a.calculatedScore);
    });

    constructor() {
        this.route.params.subscribe(params => {
            if (params['id']) {
                this.allianceId.set(params['id']);
                this.loadMembers(params['id']);
            }
        });
    }

    private loadMembers(id: string) {
        this.alliancesService.getAllianceMembers(id).subscribe(m => this.members.set(m));
    }

    goBack() {
        this.router.navigate(['..'], { relativeTo: this.route });
    }

    async saveConfidence() {
        const updates = this.membersWithScore().map(m => ({
            characterId: m.characterId,
            confidenceLevel: m.calculatedScore
        }));

        await this.vikingsService.updateAllianceMemberConfidence(this.allianceId(), updates);
        this.loadMembers(this.allianceId());
        alert('Confidence levels saved!');
    }

    openDetails(member: any) {
        this.selectedMember.set({
            name: member.name,
            details: member.details
        });
    }

    closeDetails() {
        this.selectedMember.set(null);
    }

    async updateMember(characterId: string, score: number) {
        await this.vikingsService.updateAllianceMemberConfidence(this.allianceId(), [{ characterId, confidenceLevel: score }]);
        this.loadMembers(this.allianceId());
    }

    getDetailTooltip(detail: any): string {
        const dateStr = detail.date && detail.date.toDate ? detail.date.toDate().toLocaleDateString() : 'Unknown Date';
        return `Date: ${dateStr}\nExpected: ${detail.expectedStatus}\nActual: ${detail.actualStatus}\nMatch: ${detail.isMatch ? 'Yes' : 'No'}`;
    }

    getSafeDate(timestamp: any): Date | null {
        if (!timestamp) return null;
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        if (timestamp instanceof Date) {
            return timestamp;
        }
        // Fallback for seconds/nanoseconds object if not a full Timestamp class instance
        if (timestamp.seconds) {
            return new Date(timestamp.seconds * 1000);
        }
        return null;
    }
}
