export type MediaFormat = {
  id: string;
  label: string;
  ext: string;
  width?: number;
  height?: number;
  hasAudio: boolean;
  audioOnly?: boolean;
  size?: number;
  note?: string;
};

export type MediaMetadata = {
  id: string;
  sourceUrl: string;
  title: string;
  author?: string;
  duration?: number;
  thumbnail?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  formats: MediaFormat[];
};
