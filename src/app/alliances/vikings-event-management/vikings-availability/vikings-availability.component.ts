import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { VikingsService } from '../../../vikings-event/vikings.service';
import { VikingsEventView, CharacterAssignmentView, VikingsStatus } from '../../../vikings-event/vikings.types';

@Component({
    selector: 'app-vikings-availability',
    template: `
        <div class="availability-container">
            @if (event(); as evt) {
                <header>
                    <h1>⚔️ Availability: {{ evt.date.toDate() | date:'mediumDate' }}</h1>
                    <a [routerLink]="['/admin', 'vikingsEvents', evt.id, 'manage']" class="back-btn">
                        ⬅ Back to Manage
                    </a>
                </header>

                <div class="controls">
                    <div class="mode-group">
                        <span class="mode-label">Interaction Mode:</span>
                        <button class="mode-btn default" 
                                [class.active]="selectedMode() === null"
                                (click)="setMode(null)">
                            🖱️ Popup (Default)
                        </button>
                    </div>
                    
                    <div class="mode-group">
                        <span class="mode-label">Quick Set (Paint):</span>
                        <button class="mode-btn online" 
                                [class.active]="selectedMode() === 'online'"
                                (click)="setMode('online')">
                            Online
                        </button>
                        <button class="mode-btn offline_empty" 
                                [class.active]="selectedMode() === 'offline_empty'"
                                (click)="setMode('offline_empty')">
                            Offline (Empty)
                        </button>
                        <button class="mode-btn offline_not_empty" 
                                [class.active]="selectedMode() === 'offline_not_empty'"
                                (click)="setMode('offline_not_empty')">
                            Offline (Not Empty)
                        </button>
                         <button class="mode-btn unknown" 
                                [class.active]="selectedMode() === 'unknown'"
                                (click)="setMode('unknown')">
                            Unknown
                        </button>
                    </div>
                </div>

                <div class="grid-container">
                    @for (char of characters(); track char.characterId) {
                        <div class="char-card" (click)="handleCharClick(char)">
                            <div class="char-name">{{ char.characterName }}</div>
                            <div class="status-indicator" [class]="char.actualStatus || char.status">
                                {{ (char.actualStatus || char.status) || 'UNKNOWN' }}
                            </div>
                        </div>
                    }
                </div>

                @if (selectedChar(); as selected) {
                    <div class="popup-overlay" (click)="closePopup()">
                        <div class="popup" (click)="$event.stopPropagation()">
                            <h2>{{ selected.characterName }}</h2>
                            <div class="options-list">
                                <button class="option-btn online" (click)="updateStatus(selected, 'online')">ONLINE</button>
                                <button class="option-btn offline_empty" (click)="updateStatus(selected, 'offline_empty')">OFFLINE (Empty)</button>
                                <button class="option-btn offline_not_empty" (click)="updateStatus(selected, 'offline_not_empty')">OFFLINE (Not Empty)</button>
                                <button class="option-btn cancel" (click)="closePopup()">Cancel</button>
                            </div>
                        </div>
                    </div>
                }
            } @else {
                <div class="loading">Loading Event...</div>
            }
        </div>
    `,
    styleUrl: 'vikings-availability.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink]
})
export class VikingsAvailabilityComponent {
    private route = inject(ActivatedRoute);
    private vikingsService = inject(VikingsService);

    // Fetch Event ID
    private eventId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));

    // Fetch Event Data
    public event = toSignal(
        this.route.paramMap.pipe(
            map(p => p.get('id')),
            switchMap(id => {
                if (!id) return of(null);
                return this.vikingsService.getVikingsEventById(id);
            })
        )
    );

    public characters = computed(() => {
        const e = this.event();
        return e ? e.characters : [];
    });

    public selectedChar = signal<CharacterAssignmentView | null>(null);
    public selectedMode = signal<VikingsStatus | 'unknown' | null>(null);

    setMode(mode: VikingsStatus | 'unknown' | null) {
        this.selectedMode.set(mode);
        this.selectedChar.set(null); // Close popup if open
    }

    handleCharClick(char: CharacterAssignmentView) {
        const mode = this.selectedMode();
        if (mode) {
            // Paint mode
            this.updateStatus(char, mode);
        } else {
            // Popup mode
            this.selectedChar.set(char);
        }
    }

    closePopup() {
        this.selectedChar.set(null);
    }

    async updateStatus(char: CharacterAssignmentView, status: VikingsStatus | 'unknown') {
        const evt = this.event();
        if (!char || !evt || !evt.id) return;

        // Skip if status is already the same (optimization)
        const currentStatus = char.actualStatus || char.status;
        if (currentStatus === status) {
            if (this.selectedChar()) this.closePopup();
            return;
        }

        const updatedCharacters = evt.characters.map(c => {
            if (c.characterId === char.characterId) {
                return {
                    ...c,
                    actualStatus: status,
                    status: c.status
                };
            }
            return c;
        }).map(c => this.mapViewToModel(c));

        await this.vikingsService.updateEventCharacters(evt.id, updatedCharacters);

        if (this.selectedChar()) {
            this.closePopup();
        }
    }

    private mapViewToModel(view: CharacterAssignmentView): any {
        // Map back reinforce array to simpler structure
        const reinforce = view.reinforce.map(r => ({
            characterId: r.characterId,
            marchType: r.marchType
        }));

        return {
            ...view,
            reinforce
        };
    }
}
