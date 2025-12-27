import { ChangeDetectionStrategy, Component, input, output, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BoostType } from '../svs-prep.service';

@Component({
    selector: 'app-svs-boost-grid',
    templateUrl: './svs-boost-grid.html',
    styleUrl: './svs-boost-grid.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule]
})
export class SvsBoostGridComponent {
    public boostType = input.required<BoostType>();
    public slots = input.required<string[]>();
    public selectedMs = input.required<Set<string>>(); // "Ms" for manual/model sync, wait. Input is readonly.
    // We need to know which are selected.
    // And emit changes.

    public selectionChange = output<Set<string>>();

    private cdr = inject(ChangeDetectorRef);

    // Drag State
    private isDragging = false;
    private dragMode = true; // true = select, false = deselect

    isSelected(time: string): boolean {
        return this.selectedMs().has(time);
    }

    // Drag Listeners
    startDrag(event: Event, time: string) {
        if (event instanceof MouseEvent) {
            event.preventDefault();
        }

        const currentSelected = this.isSelected(time);
        this.dragMode = !currentSelected;
        this.isDragging = true;

        this.updateSlot(time, this.dragMode);
    }

    onMouseEnter(time: string) {
        if (this.isDragging) {
            this.updateSlot(time, this.dragMode);
        }
    }

    stopDrag() {
        this.isDragging = false;
    }

    handleTouchMove(event: TouchEvent) {
        if (!this.isDragging) return;
        event.preventDefault();

        const touch = event.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);

        if (element && element.hasAttribute('data-time')) {
            const time = element.getAttribute('data-time');
            if (time) {
                this.updateSlot(time, this.dragMode);
            }
        }
    }

    private updateSlot(time: string, select: boolean) {
        const currentSet = new Set(this.selectedMs());
        if (select) {
            currentSet.add(time);
        } else {
            currentSet.delete(time);
        }
        // Emit NEW set. Parent handles state update.
        // But parent is "User" or "Admin".
        // If parent updates input, we re-render.
        // Optimistic update? No, parent should handle simple state update fast.
        this.selectionChange.emit(currentSet);
    }
}
