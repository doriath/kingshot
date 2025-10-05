
import { ChangeDetectionStrategy, Component, OnDestroy, signal, inject } from '@angular/core';
import { OcrService } from '../ocr.service';

interface Troop {
  name: string;
  tier: string;
  quantity: string;
}

@Component({
  selector: 'app-bear',
  templateUrl: './bear.html',
  styleUrls: ['./bear.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BearComponent implements OnDestroy {
  private ocrService = inject(OcrService);

  selectedFile = signal<File | null>(null);
  isLoading = signal(false);
  analysisResult = signal<{ troops: Troop[] } | null>(null);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile.set(input.files[0]);
      this.analysisResult.set(null); // Reset previous results
    }
  }

  async analyzeImage(): Promise<void> {
    const file = this.selectedFile();
    if (!file) {
      return;
    }

    this.isLoading.set(true);
    this.analysisResult.set(null);

    try {
      const rawText = await this.ocrService.recognize(file);
      console.log(rawText);
      const parsedResult = this.parseOcrResult(rawText);
      this.analysisResult.set(parsedResult);
    } catch (error) {
      console.error('Error during OCR analysis:', error);
      // Optionally, display an error message to the user
    } finally {
      this.isLoading.set(false);
    }
  }

  private parseOcrResult(text: string): { troops: Troop[] } {
    const troops: Troop[] = [];
    const lines = text.split('\n');

    // Regex to identify troop names and tiers
    const troopNameRegex = /^(Apex|Supreme|Elite|Heroic|Hardy|Veteran|Senior|Trained|Rookie) (Infantry|Cavalry|Archer)/;
    // Roman numeral regex for tiers, although they are part of the name regex
    const tierRegex = /\b(I|V|X|L|C|D|M)+\b/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(troopNameRegex);

        if (match) {
            const name = match[0];
            let tier = 'Unknown';

            // Attempt to find tier from the name or nearby lines if not in name directly
            const tierMatch = line.match(tierRegex);
            if (tierMatch) {
                tier = tierMatch[0];
            }

            // The quantity is expected on the next line
            if (i + 1 < lines.length) {
                const quantity = lines[i + 1].trim().replace(/,/g, '');
                if (/^\d+$/.test(quantity)) {
                    troops.push({ name, tier, quantity });
                    i++; // Skip the next line since it's the quantity
                }
            }
        }
    }

    return { troops };
  }

  ngOnDestroy(): void {
    this.ocrService.terminate();
  }
}
