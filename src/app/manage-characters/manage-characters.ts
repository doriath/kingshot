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
  activeCharacterId = this.userDataService.activeCharacterId;
  newCharacterId = signal('');
  isLoading = signal(false);
  error = signal<string | null>(null);

  async addCharacter() {
    const id = this.newCharacterId();
    if (!id) return;

    // Validate that ID is a number
    if (!/^\d+$/.test(id)) {
      this.error.set('Character ID must be a number.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.userDataService.addCharacter(Number(id));
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

  setActive(char: CharacterUI) {
    this.userDataService.setActiveCharacter(char.id);
  }

  async saveDetails(char: CharacterUI, name: string, server: string, alliance: string, marchesStr: string) {
    try {
      const marches = marchesStr === '' ? null : Number(marchesStr);
      if (marches !== null && (isNaN(marches) || marches < 1 || marches > 6)) {
        alert('Marches must be between 1 and 6, or empty.');
        return;
      }

      // Validate Server
      if (!server || !/^\d+$/.test(server)) {
        alert('Server must be a number.');
        return;
      }

      // Validate Alliance
      if (!alliance || alliance.length !== 3) {
        alert('Alliance tag must be exactly 3 characters.');
        return;
      }

      await this.userDataService.updateCharacterDetails(char.id, {
        name,
        server: Number(server),
        alliance,
        marches
      });
      alert('Saved!');
    } catch (e: any) {
      console.error(e);
      alert('Failed to save details: ' + e.message);
    }
  }
}
