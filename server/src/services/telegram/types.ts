export interface MediaResource {
  id: string;
  quality: '1080p' | '720p' | '480p' | '4K';
  streamUrl: string;
  downloadUrl: string;
  fileSize: string;
  duration: number;
  mimeType: string;
}

export interface ContentMediaDescriptor {
  contentId: string;
  title: string;
  type: 'movie' | 'series';
  mediaList: MediaResource[];
}

export interface MediaProvider {
  getContent(): Promise<ContentMediaDescriptor[]>;
  getMedia(mediaId: string): Promise<MediaResource | null>;
  getStreamUrl(mediaId: string): Promise<string>;
  getDownloadUrl(mediaId: string): Promise<string>;
}

export interface ParsedTelegramMetadata {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  quality: string;
  resolution: string;
  language: string;
  fileSize?: string;
}
