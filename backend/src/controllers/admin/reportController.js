const { HttpError } = require('../../middleware/error');
const reports = require('../../services/reportService');

const PREVIEW_ROWS = 100;

function list(req, res) {
  res.json({ reports: reports.listReports() });
}

/**
 * GET /api/admin/reports/:type?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|xlsx|pdf
 * json  → summary + the first rows, for the on-screen preview
 * xlsx  → Excel workbook download
 * pdf   → PDF download
 */
async function show(req, res) {
  const report = await reports.buildReport(req.params.type, req.query.from, req.query.to);
  if (!report) throw new HttpError(404, 'Unknown report');

  const format = req.query.format || 'json';
  const stamp = report.period ? `${report.period.from}_to_${report.period.to}` : new Date().toISOString().slice(0, 10);
  const filename = `ooty-originals-${report.type}-report-${stamp}`;

  if (format === 'xlsx') {
    const buffer = await reports.toExcel(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(Buffer.from(buffer));
  }
  if (format === 'pdf') {
    const buffer = await reports.toPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    return res.send(buffer);
  }
  res.json({ ...report, total: report.rows.length, rows: report.rows.slice(0, PREVIEW_ROWS) });
}

module.exports = { list, show };
