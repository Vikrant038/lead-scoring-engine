import { buildHtmlReport } from '../../src/demo/demo-html-report';
import type { RunBatchResult } from '../../src/batch/run-batch';

describe('demo-html-report', () => {
  const mockResult: RunBatchResult = {
    summary: {
      total: 4,
      processed: 4,
      rejected: 0,
      errors: 0,
      bucketDistribution: {
        HIGH: 1,
        MEDIUM: 1,
        LOW: 1,
        'NOT FIT': 1,
      },
      averageScore: 50,
      generatedAt: new Date().toISOString(),
      results: [],
    },
    results: [
      {
        record_id: 'rec_001',
        profile_name: 'Lead High',
        icp_score: 85,
        bucket: 'HIGH',
        persona_fit: {
          fit_score: 90,
          matched_skills: [],
          missing_skills: [],
          matched_roles: [],
          matched_company_tiers: [],
          matched_education_tiers: [],
        },
        outreach_email: { subject: 'Hey High', body: 'This is high email body' },
      },
      {
        record_id: 'rec_002',
        profile_name: 'Lead Med',
        icp_score: 60,
        bucket: 'MEDIUM',
        persona_fit: {
          fit_score: 65,
          matched_skills: [],
          missing_skills: [],
          matched_roles: [],
          matched_company_tiers: [],
          matched_education_tiers: [],
        },
      },
      {
        record_id: 'rec_003',
        profile_name: 'Lead Low',
        icp_score: 35,
        bucket: 'LOW',
      },
      {
        record_id: 'rec_004',
        profile_name: 'Lead Not Fit',
        icp_score: 10,
        bucket: 'NOT FIT',
      },
    ] as any[],
    summaryPath: 'summary.json',
    csvPath: 'leads.csv',
  };

  it('generates a report with summary statistics and top leads table', () => {
    const html = buildHtmlReport(mockResult, 'e2e-persona');
    expect(html).toContain('Lead High');
    expect(html).toContain('Lead Med');
    expect(html).toContain('Lead Low');
    expect(html).toContain('Lead Not Fit');
    expect(html).toContain('85');
    expect(html).toContain('60');
    expect(html).toContain('35');
    expect(html).toContain('10');
    expect(html).toContain('e2e-persona');
    expect(html).toContain('Sample Outreach Email');
    expect(html).toContain('Hey High');
    expect(html).toContain('This is high email body');
  });

  it('handles result without outreach email or persona', () => {
    const resultNoEmail: RunBatchResult = {
      ...mockResult,
      results: mockResult.results.map((r) => ({ ...r, outreach_email: undefined })),
    };
    const html = buildHtmlReport(resultNoEmail);
    expect(html).toContain('Lead High');
    expect(html).not.toContain('Sample Outreach Email');
    expect(html).toContain('—'); // For no persona fit score
  });

  it('handles fallback styles for unknown buckets', () => {
    const resultUnknownBucket: RunBatchResult = {
      ...mockResult,
      results: [
        {
          record_id: 'rec_005',
          profile_name: 'Lead Unknown',
          icp_score: 50,
          bucket: 'UNKNOWN',
        } as any,
      ],
    };
    const html = buildHtmlReport(resultUnknownBucket);
    expect(html).toContain('Lead Unknown');
    expect(html).toContain('UNKNOWN');
  });

  it('handles empty results and zero total', () => {
    const emptyResult: RunBatchResult = {
      summary: {
        total: 0,
        processed: 0,
        rejected: 0,
        errors: 0,
        bucketDistribution: {} as any,
        averageScore: 0,
        generatedAt: new Date().toISOString(),
        results: [],
      },
      results: [],
      summaryPath: 'summary.json',
      csvPath: 'leads.csv',
    };
    const html = buildHtmlReport(emptyResult);
    expect(html).toContain('No leads scored.');
    expect(html).toContain('0% of total');
  });
});
