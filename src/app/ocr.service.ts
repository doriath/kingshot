import { Injectable } from '@angular/core';
import { createWorker, Worker } from 'tesseract.js';

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  private worker: Worker | null = null;

  async recognize(image: File): Promise<string> {
    if (!this.worker) {
      this.worker = await createWorker('eng');
    }
    const ret = await this.worker.recognize(image);
    return ret.data.text;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
