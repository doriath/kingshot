import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AdminBreadcrumbService {
    private labelsMap = signal<Map<string, string>>(new Map());

    public getLabel(segment: string): string | undefined {
        return this.labelsMap().get(segment);
    }

    public setLabel(segment: string, label: string): void {
        // Create new map instance to trigger signal update
        const newMap = new Map(this.labelsMap());
        newMap.set(segment, label);
        this.labelsMap.set(newMap);
    }

    public getLabelsMapSignal() {
        return this.labelsMap.asReadonly();
    }
}
