import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export type PublicReviewVm = {
  authorName: string;
  rating: number;
  comment: string;
  created_at?: string;
};

export type CreatePublicReviewBody = Pick<PublicReviewVm, 'authorName' | 'rating' | 'comment'>;

@Injectable({ providedIn: 'root' })
export class PublicReviewsApiService {
  private readonly http = inject(HttpClient);

  list$(limit = 12): Observable<PublicReviewVm[]> {
    return this.http.get<PublicReviewVm[]>(`${API_BASE_URL}/public/reviews`, {
      params: { limit: String(limit) },
    });
  }

  create$(body: CreatePublicReviewBody): Observable<{ ok: boolean; message?: string }> {
    return this.http.post<{ ok: boolean; message?: string }>(`${API_BASE_URL}/public/reviews`, body);
  }
}
