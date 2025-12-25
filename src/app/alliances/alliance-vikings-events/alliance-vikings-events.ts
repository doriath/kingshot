import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VikingsService, VikingsEventView } from '../../vikings-event/vikings.service';
import { Alliance } from '../alliances.service';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs'; // Import of
import { VikingsEvent } from '../../vikings-event/vikings.service';

@Component({
    selector: 'app-alliance-vikings-events',
    template: `
        <div class="events-container">
            <div class="create-card">
                <h3>📅 Schedule New Event</h3>
                <div class="create-form">
                    <div class="form-group">
                        <label>Event Date & Time (UTC)</label>
                        <input type="datetime-local" [(ngModel)]="newEventDate">
                    </div>
                    <button class="create-btn" (click)="createEvent()" [disabled]="!newEventDate">Create Event</button>
                    <p class="hint">Creates a "Voting" event and adds all current alliance members.</p>
                </div>
            </div>

            <div class="events-list">
                <h3>Manage Events</h3>
                
                @for (event of allianceEvents(); track event.id) {
                <div class="event-row" [class.finalized]="event.status === 'finalized'">
                    <div class="event-info">
                        <span class="event-date">{{ event.date.toDate() | date:'medium' }}</span>
                        <span class="status-badge" [class]="event.status">{{ event.status | uppercase }}</span>
                    </div>
                    <div class="event-actions">
                         <a class="action-btn manage-btn" [routerLink]="['/admin/vikingsEvents', event.id, 'manage']">Manage</a>
                        @if (event.status === 'voting') {
                            <button class="action-btn finalize-btn" (click)="finalizeEvent(event)">Finalize Assignments</button>
                        }
                        <button class="action-btn delete-btn" (click)="deleteEvent(event)">🗑️</button>
                    </div>
                </div>
                } @empty {
                    <div class="empty-state">No events found for this alliance.</div>
                }
            </div>
        </div>
    `,
    styles: [`
        .events-container { display: flex; flex-direction: column; gap: 2rem; }
        
        .create-card {
            background: #2a2a2a; padding: 1.5rem; border-radius: 8px; border: 1px solid #444;
        }
        .create-card h3 { margin-top: 0; color: #81c784; }
        
        .create-form { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
        .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
        .form-group label { font-size: 0.85rem; color: #ccc; }
        input[type="datetime-local"] {
            padding: 0.5rem; background: #1a1a1a; border: 1px solid #555; color: white; border-radius: 4px;
        }
        
        .create-btn {
            background: #4caf50; color: white; border: none; padding: 0.6rem 1.2rem;
            border-radius: 4px; cursor: pointer; font-weight: bold;
        }
        .create-btn:disabled { background: #555; cursor: not-allowed; }
        .hint { flex-basis: 100%; color: #888; font-size: 0.8rem; margin: 0.5rem 0 0; }

        .events-list h3 { margin-bottom: 1rem; color: #ffb74d; }
        .event-row {
            display: flex; justify-content: space-between; align-items: center;
            padding: 1rem; background: #222; border-bottom: 1px solid #333;
        }
        .event-row:first-of-type { border-top-left-radius: 8px; border-top-right-radius: 8px; }
        .event-row:last-of-type { border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; border-bottom: none; }
        
        .event-info { display: flex; align-items: center; gap: 1rem; }
        .event-date { font-weight: bold; color: #eee; }
        
        .status-badge {
            font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: bold;
        }
        .status-badge.voting { background: rgba(33, 150, 243, 0.2); color: #64b5f6; }
        .status-badge.finalized { background: rgba(76, 175, 80, 0.2); color: #81c784; }
        .status-badge.past { background: #333; color: #888; }

        .event-actions { display: flex; gap: 0.5rem; }
        .action-btn {
            border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.9rem;
            text-decoration: none; display: inline-block;
        }
        .manage-btn { background: #9c27b0; color: white; }
        .manage-btn:hover { background: #7b1fa2; }
        .finalize-btn { background: #ff9800; color: white; }
        .finalize-btn:hover { background: #f57c00; }
        .delete-btn { background: transparent; }
        .delete-btn:hover { background: rgba(255, 0, 0, 0.2); }
    `],
    imports: [CommonModule, FormsModule, RouterLink]
})
export class AllianceVikingsEventsComponent {
    public alliance = input.required<Alliance>();

    private vikingsService = inject(VikingsService);

    public newEventDate = '';

    public allianceEvents = toSignal(
        toObservable(this.alliance).pipe(
            switchMap(ally => {
                if (!ally) return of([]);
                return this.vikingsService.getVikingsEvent(ally.uuid);
            })
        ),
        { initialValue: [] }
    );

    public async createEvent() {
        if (!this.newEventDate) return;
        // datetime-local gives "YYYY-MM-DDTHH:mm", appending "Z" treats it as UTC
        const date = new Date(this.newEventDate + ':00Z');

        try {
            await this.vikingsService.createVikingsEvent(this.alliance(), date);
            this.newEventDate = '';
            alert('Event created!');
        } catch (err) {
            console.error(err);
            alert('Failed to create event.');
        }
    }

    public async deleteEvent(event: any) {
        if (!confirm('Are you sure you want to delete this event?')) return;
        try {
            await this.vikingsService.deleteVikingsEvent(event.id);
        } catch (err) {
            console.error(err);
            alert('Failed to delete event.');
        }
    }

    public async finalizeEvent(event: any) {
        if (!confirm('Finalize this event? Assignments will be locked.')) return;
        try {
            await this.vikingsService.finalizeEvent(event.id);
        } catch (err) {
            console.error(err);
            alert('Failed to finalize event.');
        }
    }
}
