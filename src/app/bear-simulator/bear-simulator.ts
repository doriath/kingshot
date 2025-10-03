
import { ChangeDetectionStrategy, Component, signal, computed, effect, viewChild, ElementRef, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Define the Player and Rally interfaces
export interface Player {
  id: number;
  name: string;
  rst: number; // Rally Start Time
  mt: number;  // March Time
  rallies: Rally[];
  color: string; // Color for the player's rallies
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

  // Canvas element reference
  canvas = viewChild<ElementRef<HTMLCanvasElement>>('timelineCanvas');
  private readonly playerColors = ['#FF6347', '#4682B4', '#32CD32', '#FFD700', '#6A5ACD', '#40E0D0', '#FF69B4', '#DAA520', '#8A2BE2', '#7FFF00'];


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
      if (currentPlayers.length == num) {
        return;
      }
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

    effect(() => {
        this.drawTimeline();
    });

    // Initialize with one player
    this.players.set([this.createNewPlayer(1)]);
  }

  private createNewPlayer(id: number): Player {
    return {
      id,
      name: `Player ${id}`,
      rst: 0,
      mt: 15,
      rallies: [],
      color: this.playerColors[id - 1]
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

  onRstChange(playerId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
        this.players.update(players => 
            players.map(p => p.id === playerId ? { ...p, rst: value } : p)
        );
    }
  }

    onMtChange(playerId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
        this.players.update(players => 
            players.map(p => p.id === playerId ? { ...p, mt: value } : p)
        );
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

    private drawTimeline(): void {
      const canvasEl = this.canvas()?.nativeElement;
      if (!canvasEl) return;

      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;
  
      const dpr = window.devicePixelRatio || 1;
      const rect = canvasEl.getBoundingClientRect();
      canvasEl.width = rect.width * dpr;
      canvasEl.height = (this.players().length * 40 + 40) * dpr; // 40px per player + 40px for timeline
      ctx.scale(dpr, dpr);
  
      const width = canvasEl.width / dpr;
      const height = canvasEl.height / dpr;
  
      ctx.clearRect(0, 0, width, height);
  
      // Draw timeline axis
      ctx.fillStyle = '#ccc';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i <= this.EVENT_DURATION; i += 300) {
          const x = (i / this.EVENT_DURATION) * width;
          ctx.fillText(`${i / 60}min`, x, 15);
          ctx.fillRect(x, 20, 1, 5);
      }
  
      // Draw player timelines
      this.timeline().forEach((player, index) => {
          const y = 40 + index * 40;
          
          // Draw player name
          ctx.fillStyle = player.color;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(player.name, 5, y + 15);

          // Draw rallies
          player.rallies.forEach(rally => {
              const startX = (rally.start / this.EVENT_DURATION) * width;
              const rallyWidth = ((rally.end - rally.start) / this.EVENT_DURATION) * width;
              ctx.fillStyle = player.color;
              ctx.fillRect(startX, y, rallyWidth, 20);
          });
      });
  }
}
