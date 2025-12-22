import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../admin.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Character } from '../user-data.service';

@Component({
  selector: 'app-admin-characters',
  imports: [CommonModule],
  templateUrl: './admin-characters.html',
  styleUrl: './admin-characters.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCharactersComponent {
  private adminService = inject(AdminService);

  pendingRegistrations = toSignal(this.adminService.getPendingRegistrations(), { initialValue: [] });
  isProcessing = signal(false);

  async approve(reg: Character) {
    if (!confirm(`Approve character ${reg.id}?`)) return;
    this.isProcessing.set(true);
    try {
      await this.adminService.approveCharacter(reg);
    } catch (e) {
      console.error(e);
      alert('Failed to approve');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async reject(reg: Character) {
    if (!confirm(`Reject character ${reg.id}?`)) return;
    this.isProcessing.set(true);
    try {
      await this.adminService.rejectCharacter(reg);
    } catch (e) {
      console.error(e);
      alert('Failed to reject');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
