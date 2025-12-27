import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SvSPrepService, SvSPrepEvent, SvSPrepRegistration } from '../svs-prep.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-admin-svs-prep-management',
  templateUrl: './admin-svs-prep-management.html',
  styleUrl: './admin-svs-prep-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink]
})
export class AdminSvsPrepManagementComponent {
  private route = inject(ActivatedRoute);
  private svsService = inject(SvSPrepService);

  // Get ID from route
  private params = toSignal(this.route.params);
  public eventId = computed(() => this.params()?.['id']);

  // Load Event
  public event$ = this.route.paramMap.pipe(
    switchMap(params => {
        const id = params.get('id');
        return id ? this.svsService.getEventById(id) : of(undefined);
    })
  );
  public event = toSignal(this.event$);

  // Load Registrations
  public registrations$ = this.route.paramMap.pipe(
    switchMap(params => {
        const id = params.get('id');
        return id ? this.svsService.getEventRegistrations(id) : of([]);
    })
  );
  public registrations = toSignal(this.registrations$, { initialValue: [] });
  
  // Computed stats could be added here (e.g. slots taken per hour)
}
