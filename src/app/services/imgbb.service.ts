
import { Injectable } from '@angular/core';
import { IMGBB_API_KEY } from '../secrets';

@Injectable({
    providedIn: 'root'
})
export class ImgbbService {
    private readonly apiUrl = 'https://api.imgbb.com/1/upload';

    async uploadImage(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('key', IMGBB_API_KEY);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                return data.data.url;
            } else {
                throw new Error(data.error?.message || 'ImgBB upload failed');
            }
        } catch (error) {
            console.error('ImgBB Upload Error:', error);
            throw error;
        }
    }
}
