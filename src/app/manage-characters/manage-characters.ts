import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserDataService, CharacterUI } from '../user-data.service';

@Component({
  selector: 'app-manage-characters',
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-characters.html',
  styleUrl: './manage-characters.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManageCharactersComponent {
  private userDataService = inject(UserDataService);

  characters = this.userDataService.characters;
  newCharacterId = signal('');
  isLoading = signal(false);
  error = signal<string | null>(null);

  async addCharacter() {
    if (!this.newCharacterId()) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.userDataService.addCharacter(this.newCharacterId());
      this.newCharacterId.set('');
    } catch (e: any) {
      console.error(e);
      this.error.set(e.message || 'Failed to register character');
    } finally {
      this.isLoading.set(false);
    }
  }

  async removeCharacter(char: CharacterUI) {
    if (!confirm(`Are you sure you want to remove character ${char.id}?`)) return;

    try {
      await this.userDataService.removeCharacter(char);
    } catch (e: any) {
      console.error(e);
      alert('Failed to remove character: ' + e.message);
    }
  }
}
