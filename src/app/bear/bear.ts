
import { ChangeDetectionStrategy, Component, OnDestroy, signal, inject } from '@angular/core';
import { OcrService } from '../ocr.service';
import { RecognizeResult } from 'tesseract.js';
import { ToUrlPipe } from '../to-url.pipe';
import { CommonModule } from '@angular/common';

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
  imports: [ToUrlPipe, CommonModule]
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
      const ocrData = await this.ocrService.recognize(file);
      console.log(ocrData);
      const parsedResult = this.parseOcrResult(ocrData);
      this.analysisResult.set(parsedResult);
    } catch (error) {
      console.error('Error during OCR analysis:', error);
      // Optionally, display an error message to the user
    } finally {
      this.isLoading.set(false);
    }
  }

  private parseOcrResult(data: RecognizeResult['data']): { troops: Troop[] } {
    const troops: Troop[] = [];
    const troopKeywords = ['Infantry', 'Cavalry', 'Archer'];

    for (const line of data.text.split('\n')) {
        const lineText = line.trim();
        
        if (troopKeywords.some(keyword => lineText.includes(keyword))) {
            let troopNameParts: string[] = [];
            let quantity = '';

            for (const word of line.split(' ')) {
                const cleanWord = word.replace(/,/g, '');
                if (/^\d+$/.test(cleanWord)) {
                    quantity = cleanWord;
                } else {
                    troopNameParts.push(word);
                }
            }
            
            const troopName = troopNameParts.join(' ').trim();

            if (troopName && quantity) {
                 const tier = this.extractTierFromName(troopName);
                 troops.push({ name: troopName, tier, quantity });
            }
        }
    }

    return { troops };
  }

  private extractTierFromName(name: string): string {
    const tiers = ['Apex', 'Supreme', 'Elite', 'Heroic', 'Hardy', 'Veteran', 'Senior', 'Trained', 'Rookie'];
    for(const tier of tiers) {
        if (name.includes(tier)) {
            return tier;
        }
    }
    
    const tierRegex = /\b(I|V|X|L|C|D|M)+\b/;
    const tierMatch = name.match(tierRegex);
    if(tierMatch) return tierMatch[0];

    return 'Unknown';
  }

  ngOnDestroy(): void {
    this.ocrService.terminate();
  }
}
