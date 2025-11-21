

import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Space, Enemy, Rally, BuildingType, Building } from '../castle-event/castle-event.models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CastleEventService } from '../castle-event/castle-event.service';
import { Auth } from '@angular/fire/auth';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { interval, map, switchMap } from 'rxjs';

@Component({
  selector: 'app-space-detail',
  templateUrl: './space-detail.html',
  styleUrls: ['./space-detail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule]
})
export class SpaceDetailComponent {
  private service = inject(CastleEventService);
  private auth = inject(Auth);

  public id = input.required<string>();

  // Reactive Data Sources
  private space$ = toObservable(this.id).pipe(switchMap(id => this.service.getSpace(id)));
  public space = toSignal(this.space$);

  private rallies$ = toObservable(this.id).pipe(switchMap(id => this.service.getRallies(id)));
  public rallies = toSignal(this.rallies$, { initialValue: [] as Rally[] });

  private enemies$ = toObservable(this.id).pipe(switchMap(id => this.service.getEnemies(id)));
  public enemies = toSignal(this.enemies$, { initialValue: [] as Enemy[] });

  // Timer
  public currentTime = toSignal(interval(1000).pipe(map(() => Date.now())), { initialValue: Date.now() });

  // User Settings (Persisted in LocalStorage)
  public userTravelTimes = signal<Record<string, string>>({}); // buildingId -> "MM:SS" string for input

  constructor() {
    // Load travel times
    const saved = localStorage.getItem('kingshot_travel_times');
    if (saved) {
      this.userTravelTimes.set(JSON.parse(saved));
    }

    // Save effect
    effect(() => {
      localStorage.setItem('kingshot_travel_times', JSON.stringify(this.userTravelTimes()));
    });
  }

  // Computed View Model
  public buildings = computed(() => {
    const allRallies = this.rallies();
    const now = this.currentTime();
    const enemies = this.enemies();
    const travelTimes = this.userTravelTimes();

    const buildingTypes: BuildingType[] = ['castle', 'turret_1', 'turret_2', 'turret_3', 'turret_4'];

    return buildingTypes.map(type => {
      const buildingRallies = allRallies
        .filter(r => r.buildingId === type)
        .map(r => {
          const enemy = enemies.find(e => e.id === r.enemyId);
          const impactTime = r.startTime + 300000 + r.travelTime; // 5m wait + travel
          const timeToImpact = impactTime - now;

          // Reinforcement Calc
          const myTravelStr = travelTimes[type] || "00:00";
          const myTravelMs = this.parseTime(myTravelStr);
          const departureTime = impactTime - myTravelMs;
          const timeToDeparture = departureTime - now;

          return {
            ...r,
            enemyName: enemy?.name || 'Unknown',
            impactTime,
            timeToImpact,
            timeToDeparture,
            departureTime
          };
        })
        .sort((a, b) => a.impactTime - b.impactTime);

      return {
        id: type,
        name: this.formatBuildingName(type),
        rallies: buildingRallies
      };
    });
  });

  public isAdmin = computed(() => {
    const s = this.space();
    const user = this.auth.currentUser;
    return s && user && s.admins.includes(user.uid);
  });

  // Actions
  public newRallyData = signal<{ buildingId: BuildingType, enemyId: string, travelTimeStr: string } | null>(null);

  public initiateAddRally(buildingId: BuildingType) {
    this.newRallyData.set({ buildingId, enemyId: '', travelTimeStr: '' });
  }

  public cancelAddRally() {
    this.newRallyData.set(null);
  }

  public async submitRally() {
    const data = this.newRallyData();
    if (data && data.enemyId && data.travelTimeStr) {
      const ms = this.parseTime(data.travelTimeStr);
      await this.service.addRally(this.id(), {
        buildingId: data.buildingId,
        enemyId: data.enemyId,
        startTime: Date.now(),
        travelTime: ms
      });
      this.newRallyData.set(null);
    }
  }

  public async deleteRally(rallyId: string) {
    if (confirm('Are you sure you want to delete this rally?')) {
      await this.service.deleteRally(this.id(), rallyId);
    }
  }

  public updateUserTravelTime(buildingId: string, timeStr: string) {
    this.userTravelTimes.update(times => ({ ...times, [buildingId]: timeStr }));
  }

  // Helpers
  private formatBuildingName(type: string): string {
    switch (type) {
      case 'castle': return 'Castle';
      case 'turret_1': return 'Turret I';
      case 'turret_2': return 'Turret II';
      case 'turret_3': return 'Turret III';
      case 'turret_4': return 'Turret IV';
      default: return type;
    }
  }

  private parseTime(timeStr: string): number {
    // Formats: "MM:SS" or "SS"
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return (parseInt(parts[0]) * 60 + parseInt(parts[1])) * 1000;
    } else if (parts.length === 1) {
      return parseInt(parts[0]) * 1000;
    }
    return 0;
  }

  public formatMs(ms: number): string {
    if (ms < 0) return "ARRIVED";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
