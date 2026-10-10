import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPublicReportHtml} from '../scripts/render_public_report_html.mjs';

test('published report HTML renders cited HTTPS links and escapes untrusted report text',()=>{
  const markdown='# Event <script>alert(1)</script>\n\n- **Source:** [NWS alert](https://api.weather.gov/alerts/123)\n- Publisher says <img src=x onerror=alert(1)>\n';
  const html=renderPublicReportHtml(markdown,{title:'Event report',generatedAt:'2026-10-10T00:00:00Z',markdownPath:'nfl-123.md'});
  assert.ok(html.includes('<a href="https://api.weather.gov/alerts/123"'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('name="author" content="Angelis Pseftis"'));
  assert.throws(()=>renderPublicReportHtml(markdown,{title:'x',generatedAt:'x',markdownPath:'../other.md'}),/Invalid/);
});
