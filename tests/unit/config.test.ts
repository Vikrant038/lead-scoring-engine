import { defaultConfig } from '../../src/config/config';
import { appConfigSchema } from '../../src/config/config.schema';
import { ConfigService } from '../../src/config/config.service';
import { InvalidConfigError } from '../../src/lib/errors/domain-errors';

describe('defaultConfig', () => {
  it('should satisfy its own schema', () => {
    expect(appConfigSchema.safeParse(defaultConfig).success).toBe(true);
  });

  it('should have scoring weights summing to 0.95, leaving 5pts for the recency bonus (FR-06-001/002)', () => {
    // The weighted component max is 95; the +5 recency bonus (FR-06-002) tops the score out at 100.
    const { education, experience, thinking } = defaultConfig.scoring.weights;
    expect(education + experience + thinking).toBeCloseTo(0.95, 5);
    expect(defaultConfig.recency.bonus).toBe(5);
  });

  it('should define contiguous buckets covering 0..100 in descending order (FR-06-004)', () => {
    const buckets = defaultConfig.buckets;
    expect(buckets[0].max).toBe(100);
    expect(buckets[buckets.length - 1].min).toBe(0);
    for (let i = 1; i < buckets.length; i += 1) {
      // each next range sits directly below the previous one
      expect(buckets[i].max).toBe(buckets[i - 1].min - 1);
    }
  });
});

describe('ConfigService', () => {
  it('should return the default config on construction', () => {
    const service = new ConfigService();
    expect(service.get().llm.provider).toBe('none');
  });

  it('should isolate internal state from the default object (deep clone)', () => {
    // Arrange
    const service = new ConfigService();
    // Act — mutate the returned config
    service.get().scoring.weights.education = 0.99;
    // Assert — the shared default is untouched
    expect(defaultConfig.scoring.weights.education).toBe(0.2);
  });

  it('should apply a valid update immediately (FR-11-004)', () => {
    // Arrange
    const service = new ConfigService();
    const next = structuredClone(defaultConfig);
    next.processing.batchDelayMs = 500;
    // Act
    const applied = service.update(next);
    // Assert
    expect(applied.processing.batchDelayMs).toBe(500);
    expect(service.get().processing.batchDelayMs).toBe(500);
  });

  it('should throw InvalidConfigError with a field-pointed message on invalid update (FR-11-003)', () => {
    // Arrange
    const service = new ConfigService();
    const bad = structuredClone(defaultConfig) as Record<string, unknown>;
    delete bad.buckets;
    // Act / Assert
    expect(() => service.update(bad)).toThrow(InvalidConfigError);
    expect(() => service.update(bad)).toThrow(/buckets/);
  });

  it('should restore defaults via reset (FR-11-005)', () => {
    // Arrange
    const service = new ConfigService();
    const next = structuredClone(defaultConfig);
    next.llm.provider = 'gemini';
    service.update(next);
    // Act
    service.reset();
    // Assert
    expect(service.get().llm.provider).toBe('none');
  });
});
