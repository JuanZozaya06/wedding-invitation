export type PhotoItem = {
  id: string;
  file: File;
  url: string;
  name: string;
  message: string;
  progress: number;
  state: 'ready' | 'saving' | 'done' | 'error';
  preview: boolean;
  createdAt?: string;
};
export type PhotoStep = 'select' | 'details' | 'review' | 'done';
