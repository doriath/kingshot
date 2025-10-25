import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'toUrl',
  standalone: true,
})
export class ToUrlPipe implements PipeTransform {
  transform(value: File): string {
    return URL.createObjectURL(value);
  }
}
