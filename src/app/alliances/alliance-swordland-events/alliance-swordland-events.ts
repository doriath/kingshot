import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Alliance } from '../alliances.service';
import { SwordlandService } from '../../swordland-event/swordland.service';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-alliance-swordland-events',
  template: `
    <div class="events-container">
      <div class="create-card">
        <h3>📅 Schedule New Swordland Event</h3>
        <div class="create-form">
          <div class="form-group">
            <label>Event Date & Time (UTC)</label>
            <input type="datetime-local" [(ngModel)]="newEventDate">
          </div>
          <div class="form-group">
            <label>Legion</label>
            <select [(ngModel)]="newEventLegion">
              <option [value]="1">Legion 1</option>
              <option [value]="2">Legion 2</option>
            </select>
          </div>
          <button class="create-btn" (click)="createEvent()" [disabled]="!newEventDate">Create Event</button>
          <p class="hint">Creates a new event with no participants.</p>
        </div>
      </div>

      <div class="events-list">
        <h3>Manage Events</h3>

        @for (event of allianceEvents(); track event.id) {
        <div class="event-row">
          <div class="event-info">
            <span class="event-date">{{ event.date.toDate() | date:'medium' }}</span>
            <span class="legion-badge">Legion {{ event.legion }}</span>
          </div>
          <div class="event-actions">
            <a class="action-btn manage-btn" [routerLink]="['/admin/swordlandEvents', event.id, 'manage']">Manage</a>
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
    input[type="datetime-local"], select {
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
    
    .legion-badge {
        font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: bold;
        background: #673ab7; color: white;
    }

    .event-actions { display: flex; gap: 0.5rem; }
    .action-btn {
        border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.9rem;
        text-decoration: none; display: inline-block;
    }
    .manage-btn { background: #9c27b0; color: white; }
    .manage-btn:hover { background: #7b1fa2; }
    .delete-btn { background: transparent; }
    .delete-btn:hover { background: rgba(255, 0, 0, 0.2); }
    .empty-state { padding: 2rem; text-align: center; color: #666; font-style: italic; background: #222; border-radius: 8px;}
  `],
  imports: [CommonModule, FormsModule, RouterLink]
})
export class AllianceSwordlandEventsComponent {
  public alliance = input.required<Alliance>();

  private swordlandService = inject(SwordlandService);

  public newEventDate = '';
  public newEventLegion: 1 | 2 = 1;

  public allianceEvents = toSignal(
    toObservable(this.alliance).pipe(
      switchMap(ally => {
        if (!ally) return of([]);
        return this.swordlandService.getEventsByAlliance(ally.uuid);
      })
    ),
    { initialValue: [] }
  );

  public async createEvent() {
    if (!this.newEventDate) return;
    const date = new Date(this.newEventDate + ':00Z');

    try {
      await this.swordlandService.createEvent({
        allianceId: this.alliance().uuid,
        allianceName: this.alliance().name || 'Unknown',
        server: this.alliance().server || 0,
        legion: this.newEventLegion,
        date: Timestamp.fromDate(date),
        participants: []
      });
      alert('Event created!');
      this.newEventDate = '';
      this.newEventLegion = 1;
    } catch (err) {
      console.error(err);
      alert('Failed to create event.');
    }
  }

  public async deleteEvent(event: any) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await this.swordlandService.deleteEvent(event.id);
    } catch (err) {
      console.error(err);
      alert('Failed to delete event.');
    }
  }
}
