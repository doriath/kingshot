import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlliancesService, Alliance } from '../alliances.service';
import { AuthService } from '../../auth.service';
import { UserDataService } from '../../user-data.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';

@Component({
    selector: 'app-alliance-admin-list',
    template: `
        <div class="admin-container">
            <h1>🛡️ Alliance Administration</h1>
            @if (userData.isGlobalAdmin()) {
                <div class="global-actions">
                    <a routerLink="/admin/characters" class="manage-btn global-btn">Manage Characters</a>
                </div>
            }
            <p>Manage your alliances.</p>

            <div class="alliance-list">
                @for (alliance of adminAlliances(); track alliance.uuid) {
                <div class="alliance-card">
                    <h2>[{{ alliance.tag }}] {{ alliance.name }} <span class="server-badge">#{{ alliance.server }}</span></h2>
                    <a [routerLink]="['/admin/alliances', alliance.uuid]" class="manage-btn">Manage</a>
                </div>
                } @empty {
                    <div class="empty-state">
                        You are not an admin of any alliance.
                    </div>
                }
            </div>
        </div>
    `,
    styles: [`
        .admin-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #eee;
        }
        h1 { color: #ffca28; margin-bottom: 0.5rem; }
        p { color: #aaa; margin-bottom: 2rem; }
        
        .alliance-list { display: flex; flex-direction: column; gap: 1rem; }
        
        .alliance-card {
            background: #2a2a2a;
            border: 1px solid #444;
            padding: 1.5rem;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .alliance-card h2 { margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem; }
        
        .server-badge {
            background: #444;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            color: #ccc;
        }

        .manage-btn {
            background: #2196f3;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            transition: background 0.2s;
        }
        .manage-btn:hover { background: #1976d2; }

        .empty-state {
            padding: 2rem;
            text-align: center;
            background: #222;
            border-radius: 8px;
            color: #888;
        }
    `],
    imports: [CommonModule, RouterLink]
})
export class AllianceAdminListComponent {
    private alliancesService = inject(AlliancesService);
    private authService = inject(AuthService);
    public userData = inject(UserDataService);

    public user = toSignal(this.authService.user$);

    public adminAlliances = toSignal(
        this.authService.user$.pipe(
            switchMap(user => {
                if (!user) return of([]);
                return this.alliancesService.getUserAdminAlliances(user.uid);
            })
        ),
        { initialValue: [] }
    );
}
