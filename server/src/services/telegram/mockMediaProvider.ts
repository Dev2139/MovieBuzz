import { MediaProvider, ContentMediaDescriptor, MediaResource } from './types';
import { Media } from '../../models/Media';

export class MockMediaProvider implements MediaProvider {
  // Reliable sample open-source video streams for local fallback testing
  private sampleStreams = [
    {
      quality: '1080p' as const,
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      downloadUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      fileSize: '1.4 GB',
      duration: 596,
      mimeType: 'video/mp4',
    },
    {
      quality: '720p' as const,
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      downloadUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      fileSize: '850 MB',
      duration: 653,
      mimeType: 'video/mp4',
    },
    {
      quality: '480p' as const,
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      downloadUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      fileSize: '450 MB',
      duration: 734,
      mimeType: 'video/mp4',
    },
  ];

  async getContent(): Promise<ContentMediaDescriptor[]> {
    try {
      const mediaItems = await Media.find({ provider: 'mock' }).populate('contentId');
      const descriptors: ContentMediaDescriptor[] = [];

      for (const item of mediaItems) {
        if (item.contentId) {
          descriptors.push({
            contentId: (item.contentId as any)._id.toString(),
            title: (item.contentId as any).title,
            type: (item.contentId as any).type,
            mediaList: [
              {
                id: item._id.toString(),
                quality: item.quality as any,
                streamUrl: item.streamUrl,
                downloadUrl: item.downloadUrl,
                fileSize: item.fileSize,
                duration: item.duration,
                mimeType: item.mimeType,
              },
            ],
          });
        }
      }
      return descriptors;
    } catch {
      return [];
    }
  }

  async getMedia(mediaId: string): Promise<MediaResource | null> {
    try {
      const media = await Media.findById(mediaId);
      if (media) {
        return {
          id: media._id.toString(),
          quality: media.quality as any,
          streamUrl: media.streamUrl,
          downloadUrl: media.downloadUrl,
          fileSize: media.fileSize,
          duration: media.duration,
          mimeType: media.mimeType,
        };
      }
    } catch (e) {
      // ignore
    }

    // Fallback to sample stream if not found by ID
    return {
      id: mediaId || 'mock-sample-1',
      quality: '1080p',
      streamUrl: this.sampleStreams[0].streamUrl,
      downloadUrl: this.sampleStreams[0].downloadUrl,
      fileSize: '1.2 GB',
      duration: 600,
      mimeType: 'video/mp4',
    };
  }

  async getStreamUrl(mediaId: string): Promise<string> {
    const media = await this.getMedia(mediaId);
    return media ? media.streamUrl : this.sampleStreams[0].streamUrl;
  }

  async getDownloadUrl(mediaId: string): Promise<string> {
    const media = await this.getMedia(mediaId);
    return media ? media.downloadUrl : this.sampleStreams[0].downloadUrl;
  }
}
