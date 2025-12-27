import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common'; // Still useful for some pipes, though we avoid *ngIf
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SvSPrepService, DayOfWeek, BoostType } from '../svs-prep.service';
import { Timestamp } from '@angular/fire/firestore';

@Component({
    selector: 'app-admin-svs-prep',
    templateUrl: './admin-svs-prep.html',
    styleUrl: './admin-svs-prep.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, ReactiveFormsModule]
})
export class AdminSvsPrepComponent {
    private fb = inject(FormBuilder);
    private svsService = inject(SvSPrepService);

    public events = this.svsService.getEvents(); // Observable of all events

    public form = this.fb.group({
        server: [150, [Validators.required]],
        date: ['', [Validators.required]], // Saturday Date
        constructionDay: ['monday', [Validators.required]],
        researchDay: ['tuesday', [Validators.required]],
        troopsDay: ['thursday', [Validators.required]]
    });

    public submitting = signal(false);

    async createEvent() {
        if (this.form.invalid) return;

        this.submitting.set(true);
        try {
            const val = this.form.value;
            const dateStr = val.date as string;
            const dateObj = new Date(dateStr);

            // Basic validation that it is a Saturday? 
            // User requested "the date will always refer to Saturday"
            // We can enforce or just trust. Let's just trust for now but maybe show a warning if not Saturday?

            await this.svsService.createEvent({
                server: Number(val.server),
                date: dateObj, // Firestore will convert or we might need Timestamp.fromDate(dateObj)
                constructionDay: val.constructionDay as DayOfWeek,
                researchDay: val.researchDay as DayOfWeek,
                troopsDay: val.troopsDay as DayOfWeek
            });

            this.form.reset({
                server: 150,
                constructionDay: 'monday',
                researchDay: 'tuesday',
                troopsDay: 'thursday'
            });
        } catch (err) {
            console.error('Error creating event', err);
            alert('Failed to create event');
        } finally {
            this.submitting.set(false);
        }
    }

    // Helper to format timestamp
    formatDate(ts: any): string {
        if (!ts) return '';
        const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
        return d.toDateString();
    }
}
