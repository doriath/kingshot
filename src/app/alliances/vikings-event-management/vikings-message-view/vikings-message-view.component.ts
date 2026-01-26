import { Component, computed, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { VikingsService } from '../../../vikings-event/vikings.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
    selector: 'app-vikings-message-view',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="message-view-container" *ngIf="data() as d">
            <header>
                <div class="header-left">
                    <button class="back-btn" (click)="goBack()">← Back to Event</button>
                    <h1>📨 Messaging View</h1>
                </div>
                <div class="header-right">
                    <div class="subtitle" *ngIf="d.event">
                        {{ d.event.date.toDate() | date:'medium' }}
                    </div>
                </div>
            </header>

            <div class="info-banner">
                <p>Click on a row to copy the message for that user. Showing <strong>Online</strong> and <strong>Offline (Empty)</strong> members.</p>
            </div>

            @if (notificationMessage()) {
                <div class="notification-toast">{{ notificationMessage() }}</div>
            }

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th class="col-name">Name</th>
                            <th class="col-power">Power</th>
                            <th class="col-status">Status</th>
                            <th class="col-action">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        @for (row of messagingList(); track row.characterId) {
                            <tr (click)="copyMessage(row)">
                                <td class="col-name">{{ row.name }}</td>
                                <td class="col-power">{{ row.power | number }}</td>
                                <td class="col-status">
                                    <span class="status-dot" [class]="row.status" [title]="row.status"></span>
                                </td>
                                <td class="col-action">
                                    <span class="copy-icon">📋</span>
                                </td>
                            </tr>
                        } @empty {
                            <tr>
                                <td colspan="4" class="empty-state">No members found with Online or Offline (Empty) status.</td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>
        </div>
        <div *ngIf="!data()" class="loading">Loading...</div>
    `,
    styles: [`
        .message-view-container { padding: 2rem; color: #eee; max-width: 1000px; margin: 0 auto; min-height: 100vh; background: #121212; }
        
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid #333; padding-bottom: 1rem; }
        h1 { margin: 0; color: #ff9800; font-size: 1.8rem; }
        .back-btn { background: none; border: none; color: #aaa; cursor: pointer; font-size: 1rem; margin-bottom: 0.5rem; display: block; padding: 0; }
        .back-btn:hover { color: white; text-decoration: underline; }
        .subtitle { color: #888; }
        
        .info-banner { background: #333; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem; border-left: 4px solid #ff9800; color: #ddd; }
        .info-banner p { margin: 0; }

        .table-container { background: #1e1e1e; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 1rem; background: #2c2c2c; color: #aaa; font-weight: bold; font-size: 0.9rem; text-transform: uppercase; }
        td { padding: 0.8rem 1rem; border-bottom: 1px solid #333; vertical-align: middle; cursor: pointer; transition: background 0.2s; }
        tr:hover td { background: #333; }
        tr:last-child td { border-bottom: none; }

        .col-name { font-weight: bold; color: white; width: 40%; }
        .col-power { color: #aaa; width: 25%; text-align: right; font-family: monospace; }
        .col-status { width: 15%; text-align: center; }
        .col-action { width: 10%; text-align: center; }

        .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .status-dot.online { background: #81c784; box-shadow: 0 0 6px #81c784; }
        .status-dot.offline_empty { background: #ffb74d; }
        .status-dot.unknown { background: #666; }

        .copy-icon { font-size: 1.2rem; filter: grayscale(1); transition: filter 0.2s; }
        tr:hover .copy-icon { filter: grayscale(0); }

        .empty-state { text-align: center; color: #666; padding: 3rem; font-style: italic; }
        
        .loading { text-align: center; margin-top: 3rem; color: #888; }

        .notification-toast {
            position: fixed; top: 2rem; left: 50%; transform: translateX(-50%);
            background: #4caf50; color: white; padding: 0.5rem 1.5rem; border-radius: 24px;
            font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 100;
            animation: fadeInOut 2s forwards;
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            10% { opacity: 1; transform: translate(-50%, 0); }
            90% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VikingsMessageViewComponent {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private vikingsService = inject(VikingsService);

    public notificationMessage = signal<string | null>(null);

    public data = toSignal(
        this.route.paramMap.pipe(
            map(p => p.get('id')),
            switchMap(id => {
                if (!id) return of(null);
                return this.vikingsService.getVikingsEventById(id).pipe(
                    map(event => ({ event }))
                );
            })
        )
    );

    public messagingList = computed(() => {
        const d = this.data();
        if (!d || !d.event || !d.event.characters) return [];

        return d.event.characters
            .filter(c => c.status === 'online' || c.status === 'offline_empty')
            .map(c => ({
                characterId: c.characterId,
                name: c.characterName,
                power: c.powerLevel,
                status: c.status
            }))
            .sort((a, b) => b.status.localeCompare(a.status));
    });

    goBack() {
        this.router.navigate(['../../manage'], { relativeTo: this.route });
    }

    copyMessage(row: any) {
        const textToCopy = `@${row.name}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            this.showNotification(`Copied: ${textToCopy}`);
        });
    }

    private showNotification(msg: string) {
        this.notificationMessage.set(msg);
        setTimeout(() => {
            this.notificationMessage.set(null);
        }, 2000);
    }
}
