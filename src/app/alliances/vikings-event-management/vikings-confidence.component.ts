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
                             <td class="col-center">
                                <span class="badge"
                                      [class.badge-high]="member.calculatedScore >= 0.8"
                                      [class.badge-low]="member.calculatedScore < 0.5">
                                    {{ member.calculatedScore | number:'1.1-2' }}
                                </span>
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

    .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
    }

    h1 {
        font-size: 1.8rem;
        font-weight: bold;
        color: #ffca28; /* Yellow accent */
        margin: 0;
    }

    .actions {
        display: flex;
        gap: 1rem;
    }

    .btn {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .back-btn {
        background-color: #424242;
        color: white;
    }
    .back-btn:hover { background-color: #616161; }

    .save-btn {
        background-color: #43a047; /* Green */
        color: white;
        font-weight: bold;
    }
    .save-btn:hover { background-color: #2e7d32; }

    .content-grid {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .summary-card {
        background-color: #1e1e1e;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        color: #ddd;
    }
    .summary-card p { margin: 0; line-height: 1.5; }

    .high-conf-text { color: #66bb6a; font-weight: bold; }
    .low-conf-text { color: #ef5350; font-weight: bold; }

    .table-container {
        background-color: #1e1e1e;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        border: 1px solid #333;
    }

    .data-table {
        width: 100%;
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

    // Computed
    public membersWithScore = computed(() => {
        const evs = this.events();
        const mems = this.members();
        const aId = this.allianceId();

        // Filter events for this alliance
        const relevantEvents = evs.filter((e: VikingsEvent) => e.allianceId === aId);

        return mems.map((m: AllianceMember) => {
            const calculated = this.vikingsService.calculateMemberConfidence(m.characterId, relevantEvents);
            return {
                ...m,
                calculatedScore: calculated,
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

    async updateMember(characterId: string, score: number) {
        await this.vikingsService.updateAllianceMemberConfidence(this.allianceId(), [{ characterId, confidenceLevel: score }]);
        this.loadMembers(this.allianceId());
    }
}
