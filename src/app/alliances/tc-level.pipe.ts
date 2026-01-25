import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'tcLevel',
    standalone: true
})
export class TcLevelPipe implements PipeTransform {

    transform(value: number | undefined | null): string {
        if (value === undefined || value === null) {
            return '-';
        }

        if (value <= 30) {
            return `TC${value}`;
        } else {
            return `TG${value - 30}`;
        }
    }

}
