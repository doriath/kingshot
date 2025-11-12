import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-bear-event',
  templateUrl: './bear-event.html',
  styleUrls: ['./bear-event.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BearEventComponent {}
