import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-vikings-guide',
    templateUrl: './vikings-guide.html',
    styleUrl: './vikings-guide.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, RouterLink]
})
export class VikingsGuideComponent {
    public activeTab = signal<'casual' | 'advanced'>('casual');

    public setTab(tab: 'casual' | 'advanced') {
        this.activeTab.set(tab);
    }
}
