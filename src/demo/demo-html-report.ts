/**
 * Demo HTML report generator (Phase 0 — FR-15-010 --html flag).
 * Produces a self-contained, beautiful HTML report with inline Tailwind CDN.
 * No build step required — this is a standalone artifact for Loom demos.
 */
import type { RunBatchResult } from '../batch/run-batch';

function scoreBar(score: number): string {
  const color =
    score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : score >= 25 ? '#f97316' : '#ef4444';
  return `<div style="background:#e5e7eb;border-radius:9999px;height:6px;overflow:hidden;width:100%">
    <div style="background:${color};height:6px;border-radius:9999px;width:${score}%;transition:width 1s"></div>
  </div>`;
}

function bucketBadge(bucket: string): string {
  const map: Record<string, string> = {
    HIGH: 'background:#dcfce7;color:#15803d;border:1px solid #bbf7d0',
    MEDIUM: 'background:#fef9c3;color:#854d0e;border:1px solid #fef08a',
    LOW: 'background:#ffedd5;color:#c2410c;border:1px solid #fed7aa',
    'NOT FIT': 'background:#fee2e2;color:#b91c1c;border:1px solid #fecaca',
  };
  const style = map[bucket] ?? 'background:#f1f5f9;color:#475569';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:700;${style}">${bucket}</span>`;
}

export function buildHtmlReport(result: RunBatchResult, persona?: string): string {
  const { summary, results } = result;
  const now = new Date().toLocaleString();

  const topLeads = results
    .filter((r) => typeof r.icp_score === 'number')
    .sort((a, b) => (b.icp_score as number) - (a.icp_score as number))
    .slice(0, 10);

  const sampleEmail = results.find((r) => r.outreach_email);

  const rows = topLeads
    .map(
      (r, i) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:12px 16px;color:#6b7280;font-size:13px">${i + 1}</td>
      <td style="padding:12px 16px;font-weight:600;font-size:13px;color:#111827">${r.profile_name}</td>
      <td style="padding:12px 16px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px;font-weight:800;color:#0029ff;min-width:36px">${r.icp_score}</span>
          <div style="flex:1;max-width:140px">${scoreBar(r.icp_score ?? 0)}</div>
        </div>
      </td>
      <td style="padding:12px 16px">${bucketBadge(r.bucket ?? 'UNKNOWN')}</td>
      <td style="padding:12px 16px;font-size:13px;color:#6b7280">${r.persona_fit ? r.persona_fit.fit_score + '/100' : '—'}</td>
    </tr>`,
    )
    .join('');

  const emailSection = sampleEmail?.outreach_email
    ? `
  <div style="margin-top:32px;background:white;border-radius:16px;padding:24px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <div style="width:32px;height:32px;border-radius:8px;background:#eff6ff;display:flex;align-items:center;justify-content:center">
        <span style="font-size:16px">✉️</span>
      </div>
      <h2 style="margin:0;font-size:16px;font-weight:700;color:#111827">Sample Outreach Email — ${sampleEmail.profile_name}</h2>
    </div>
    <div style="background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151">Subject: <span style="font-weight:400;color:#6b7280">${sampleEmail.outreach_email.subject}</span></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0" />
      <pre style="margin:0;font-family:inherit;font-size:13px;color:#4b5563;white-space:pre-wrap;line-height:1.6">${sampleEmail.outreach_email.body}</pre>
    </div>
  </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ICP Profiler — Demo Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Inter', system-ui, sans-serif;
      background: #f8fafc;
      color: #111827;
    }
    @keyframes fadeUp {
      from { opacity:0; transform:translateY(16px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .card { animation: fadeUp 0.4s ease both; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; }
  </style>
</head>
<body>
  <div style="max-width:900px;margin:0 auto;padding:40px 24px">

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:32px" class="card">
      <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#0029ff,#0018c0);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,41,255,0.3)">
        <span style="font-size:24px">🚀</span>
      </div>
      <div>
        <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;background:linear-gradient(135deg,#0029ff,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent">ICP Profiler</h1>
        <p style="margin:0;font-size:13px;color:#6b7280">Demo Report · Generated ${now}${persona ? ` · Persona: ${persona}` : ''}</p>
      </div>
    </div>

    <!-- Summary Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px" class="card">
      ${[
        { label: 'Total Leads', value: summary.total, icon: '📋', color: '#6366f1' },
        { label: 'Processed', value: summary.processed, icon: '✅', color: '#22c55e' },
        { label: 'Rejected', value: summary.rejected, icon: '⚠️', color: '#f97316' },
        {
          label: 'Avg ICP Score',
          value: summary.averageScore + '/100',
          icon: '📊',
          color: '#0029ff',
        },
      ]
        .map(
          (s) => `
      <div style="background:white;border-radius:16px;padding:20px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
        <div style="font-size:24px;margin-bottom:8px">${s.icon}</div>
        <div style="font-size:28px;font-weight:800;color:${s.color}">${s.value}</div>
        <div style="font-size:12px;color:#6b7280;font-weight:500;margin-top:2px">${s.label}</div>
      </div>`,
        )
        .join('')}
    </div>

    <!-- Bucket Distribution -->
    <div style="background:white;border-radius:16px;padding:24px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin-bottom:24px" class="card">
      <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827">Bucket Distribution</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px">
        ${(['HIGH', 'MEDIUM', 'LOW', 'NOT FIT'] as const)
          .map((b) => {
            const count = summary.bucketDistribution[b] ?? 0;
            const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
            return `<div style="text-align:center;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb">
              ${bucketBadge(b)}
              <div style="font-size:28px;font-weight:800;margin-top:10px;color:#111827">${count}</div>
              <div style="font-size:11px;color:#6b7280;margin-top:2px">${pct}% of total</div>
            </div>`;
          })
          .join('')}
      </div>
    </div>

    <!-- Top 10 Leads Table -->
    <div style="background:white;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06);overflow:hidden;margin-bottom:24px" class="card">
      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0;font-size:16px;font-weight:700;color:#111827">Top 10 Leads by ICP Score</h2>
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">#</th>
              <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Name</th>
              <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">ICP Score</th>
              <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Bucket</th>
              <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Persona Fit</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:24px;color:#6b7280">No leads scored.</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    ${emailSection}

    <!-- Footer -->
    <div style="margin-top:40px;text-align:center;font-size:12px;color:#9ca3af" class="card">
      Built with ❤️ · <a href="https://github.com" style="color:#0029ff;text-decoration:none">ICP Profiler on GitHub</a> · ${now}
    </div>

  </div>
</body>
</html>`;
}
