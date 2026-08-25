import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

type FeatureExtractionOutput = { data: Float32Array | number[] };
type FeatureExtractionPipeline = (
  text: string,
  options?: { pooling?: 'mean'; normalize?: boolean }
) => Promise<FeatureExtractionOutput>;

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractor: FeatureExtractionPipeline | null = null;

  async onModuleInit(): Promise<void> {
    const { pipeline } = await import('@xenova/transformers');
    this.extractor = (await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    )) as unknown as FeatureExtractionPipeline;
    this.logger.log('Embedding model loaded (Xenova/all-MiniLM-L6-v2)');
  }

  async embed(text: string): Promise<number[]> {
    if (!this.extractor) {
      throw new Error('EmbeddingService not initialized yet — model still loading');
    }
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }
}
