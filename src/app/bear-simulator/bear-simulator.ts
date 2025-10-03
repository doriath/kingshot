
import { ChangeDetectionStrategy, Component, signal, computed, effect, viewChild, ElementRef, afterNextRender } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Define the Player and Rally interfaces
export interface Player {
  id: number;
  name: string;
  rst: number;
  mt: number;  // March Time
  rallies: Rally[];
  color: string; // Color for the player's rallies
  error?: string;
}

export interface Rally {
  start: number;
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
  numberOfPlayers = signal(9);
  players = signal<Player[]>([]);

  // Canvas element reference
  canvas = viewChild<ElementRef<HTMLCanvasElement>>('timelineCanvas');
  private readonly playerColors = ['#FF6347', '#4682B4', '#32CD32', '#FFD700', '#6A5ACD', '#40E0D0', '#FF69B4', '#DAA520', '#8A2BE2', '#7FFF00'];

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

    // Initialize with few players
    this.players.set([
      this.createNewPlayer(1, 0, 15),
      this.createNewPlayer(2, 0, 15),
      this.createNewPlayer(3, 0, 15),
      this.createNewPlayer(4, 73, 15),
      this.createNewPlayer(5, 73, 15),
      this.createNewPlayer(6, 73, 15),
      this.createNewPlayer(7, 146, 15),
      this.createNewPlayer(8, 146, 15),
      this.createNewPlayer(9, 146, 15),
    ]);
  }

  private createNewPlayer(id: number, start: number = 0, mt: number = 15): Player {
    let t = start;
    let rallies = [];
    for (let i = 0; i < 5; i++) {
      if (t + 300 + mt < this.EVENT_DURATION) {
        rallies.push({ start: t });
        // adding 5 as delay to actually start the rally
        t += 300 + 2 * mt + 5;
      } else {
        break;
      }
    }
    return {
      id,
      name: `P${id}`,
      rst: start,
      mt: mt,
      rallies: rallies,
      color: this.playerColors[id - 1]
    };
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
    canvasEl.height = (this.players().length * 40 + 60) * dpr; // Increased height for padding
    ctx.scale(dpr, dpr);

    const width = canvasEl.width / dpr;
    const height = canvasEl.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 30, right: 20, bottom: 20, left: 20 };
    const labelWidth = 60; // Space for player labels
    const timelineWidth = width - labelWidth - padding.left - padding.right;
    const timelineStartX = labelWidth + padding.left;

    // Draw timeline axis
    ctx.fillStyle = '#ccc';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= this.EVENT_DURATION; i += 300) {
      const x = timelineStartX + (i / this.EVENT_DURATION) * timelineWidth;
      ctx.fillText(`${i / 60}min`, x, padding.top - 15); // Adjust y position
      ctx.fillRect(x, padding.top - 10, 1, 5);
    }
    // Draw a line for the timeline axis
    ctx.beginPath();
    ctx.moveTo(timelineStartX, padding.top);
    ctx.lineTo(timelineStartX + timelineWidth, padding.top);
    ctx.strokeStyle = '#ccc';
    ctx.stroke();


    // Draw player timelines
    this.players().forEach((player, index) => {
      const y = padding.top + 20 + index * 40;

      // Draw player name
      ctx.fillStyle = player.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right'; // Align to the right of the label area
      ctx.fillText(player.name, labelWidth, y + 15);

      // Draw rallies
      player.rallies.forEach(rally => {
        const startX = timelineStartX + (rally.start / this.EVENT_DURATION) * timelineWidth;
        const rallyWidth = ((300 + 2 * player.mt) / this.EVENT_DURATION) * timelineWidth;

        // Ensure rallyWidth is at least 1 pixel to be visible
        const effectiveRallyWidth = Math.max(1, rallyWidth);

        ctx.fillStyle = player.color;
        ctx.fillRect(startX, y, effectiveRallyWidth, 20);
      });
    });
  }
}
