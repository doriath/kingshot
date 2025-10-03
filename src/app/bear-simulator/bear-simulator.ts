
import { ChangeDetectionStrategy, Component, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Define the Player and Rally interfaces
export interface Player {
  id: number;
  name: string;
  rst: number; // Rally Start Time
  mt: number;  // March Time
  rallies: Rally[];
  error?: string;
}

export interface Rally {
  start: number; // Rally Hit Time at the Bear
  end: number;   // Rally End Time (10 seconds after hit)
}

@Component({
  selector: 'app-bear-simulator',
  templateUrl: './bear-simulator.html',
  styleUrls: ['./bear-simulator.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule]
})
export class BearSimulatorComponent {
  // Fixed parameters from the specification
  readonly EVENT_DURATION = 1800; // 30 minutes in seconds
  readonly WAIT_TIME = 300;       // 5 minutes in seconds
  readonly ATTACK_TIME = 10;      // 10 seconds

  // Signals for managing component state
  numberOfPlayers = signal(1);
  players = signal<Player[]>([]);

  // Computed signal to derive the visualization data
  timeline = computed(() => {
    return this.players().map(player => {
      const rallies = this.calculatePlayerRallies(player.rst, player.mt);
      return { ...player, rallies };
    });
  });

  constructor() {
    // Effect to automatically update players when the number of players changes
    effect(() => {
      const num = this.numberOfPlayers();
      const currentPlayers = this.players();
      const newPlayers: Player[] = [];

      for (let i = 0; i < num; i++) {
        if (i < currentPlayers.length) {
          newPlayers.push(currentPlayers[i]);
        } else {
          newPlayers.push(this.createNewPlayer(i + 1));
        }
      }
      this.players.set(newPlayers);
    });

    // Initialize with one player
    this.players.set([this.createNewPlayer(1)]);
  }

  private createNewPlayer(id: number): Player {
    return {
      id,
      name: `Player ${id}`,
      rst: 0,
      mt: 60,
      rallies: [],
    };
  }

  // --- Rally Calculation Logic ---
  private calculatePlayerRallies(rst: number, mt: number): Rally[] {
    const rallies: Rally[] = [];
    if (this.validatePlayerData(rst, mt)) {
      let currentRallyStartTime = rst;

      while (true) {
        const rallyHitTime = currentRallyStartTime + this.WAIT_TIME + mt;
        const rallyEndTime = rallyHitTime + this.ATTACK_TIME;

        if (rallyHitTime > this.EVENT_DURATION) {
            break; // Stop if the rally hits after the event ends
        }

        rallies.push({ start: rallyHitTime, end: rallyEndTime });

        // Calculate the start time for the next rally
        const rallyDuration = this.WAIT_TIME + (2 * mt);
        currentRallyStartTime += rallyDuration;
      }
    }
    return rallies;
  }

  // --- Input Validation ---
  private validatePlayerData(rst: number, mt: number): boolean {
    if (mt < 1 || mt > 300) return false;
    if (rst < 0) return false;
    if (this.isInitialRallyTooLate(rst, mt)) return false;
    return true;
  }

  private isInitialRallyTooLate(rst: number, mt: number): boolean {
    return rst + this.WAIT_TIME + mt > this.EVENT_DURATION;
  }

  // --- Event Handlers ---
  onPlayerCountChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = parseInt(input.value, 10);
    if (isNaN(value) || value < 1) value = 1;
    if (value > 10) value = 10;
    this.numberOfPlayers.set(value);
  }

  onRstChange(player: Player, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
        player.rst = value;
        this.players.set([...this.players()]); // Trigger re-computation
    }
  }

    onMtChange(player: Player, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
        player.mt = value;
        this.players.set([...this.players()]); // Trigger re-computation
    }
  }

    // --- Template Helper Methods ---
    getValidationMessage(player: Player): string | null {
        if (player.mt < 1 || player.mt > 300) {
            return "March Time must be between 1 and 300 seconds.";
        }
        if (player.rst < 0) {
            return "Rally Start Time cannot be negative.";
        }
        if (this.isInitialRallyTooLate(player.rst, player.mt)) {
            return "Rally 1 arrives after event end.";
        }
        return null;
    }

    getTimelineScale(): number {
        return 100 / this.EVENT_DURATION;
    }
}
