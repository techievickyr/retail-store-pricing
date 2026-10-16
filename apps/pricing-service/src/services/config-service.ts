import { config } from '../config';

export function getPublicConfig(): { maxUploadBytes: number } {
  return { maxUploadBytes: config.maxUploadBytes };
}
