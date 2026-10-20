import { Injectable, Scope, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { ReportsService } from './reports.service';

// pdfmake has no bundled types in this version; use require and narrow below
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require('pdfmake');

const FONTS_DIR = path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto');
pdfmake.fonts = {
  Roboto: {
    normal:      path.join(FONTS_DIR, 'Roboto-Regular.ttf'),
    bold:        path.join(FONTS_DIR, 'Roboto-Medium.ttf'),
    italics:     path.join(FONTS_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(FONTS_DIR, 'Roboto-MediumItalic.ttf'),
  },
};
pdfmake.setLocalAccessPolicy(() => true);
pdfmake.setUrlAccessPolicy(() => false);

// ── Formatting helpers ────────────────────────────────────────────────────────

const TZS_FMT = new Intl.NumberFormat('en-TZ');

function tzs(n: number): string {
  return `TZS ${TZS_FMT.format(Math.round(n))}`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Design tokens ────────────────────────────────────────────────────────────

const NAVY   = '#1E3A5F';
const BLUE   = '#2563EB';
const MUTED  = '#64748B';
const LIGHT  = '#F8FAFC';
const BORDER = '#E2E8F0';
const WHITE  = '#FFFFFF';
const RED    = '#DC2626';
const ORANGE = '#EA580C';
const YELLOW = '#D97706';
const GREEN  = '#16A34A';

// ── pdfmake document builder helpers ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cell  = string | number | Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = Record<string, any>;

function hRule(): Block {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: BORDER }], margin: [0, 8, 0, 8] };
}

function section(title: string): Block {
  return {
    stack: [
      { text: title.toUpperCase(), fontSize: 7, bold: true, color: MUTED, letterSpacing: 0.5, margin: [0, 16, 0, 6] },
    ],
  };
}

function kpiGrid(items: { label: string; value: string; sub?: string }[]): Block {
  const cols = items.map(item => ({
    stack: [
      { text: item.label.toUpperCase(), fontSize: 7, color: MUTED, bold: true },
      { text: item.value, fontSize: 12, bold: true, color: NAVY, margin: [0, 3, 0, 2] },
      ...(item.sub ? [{ text: item.sub, fontSize: 8, color: MUTED }] : []),
    ],
    border: [true, true, true, true],
    borderColor: [BORDER, BORDER, BORDER, BORDER],
    fillColor: LIGHT,
    margin: [10, 8, 10, 8],
  }));

  return {
    table: {
      widths: Array(items.length).fill('*'),
      body: [cols],
    },
    layout: {
      defaultBorder: true,
      hLineColor: () => BORDER,
      vLineColor: () => BORDER,
    },
    margin: [0, 0, 0, 16],
  };
}

function dataTable(
  headers: string[],
  rows: Cell[][],
  widths?: (string | number)[],
): Block {
  const colWidths = widths ?? ['*', ...Array(headers.length - 1).fill('auto')];

  const headerRow = headers.map(h => ({
    text: h,
    style: 'th',
    border: [false, false, false, true],
    borderColor: [BORDER, BORDER, BORDER, NAVY],
    fillColor: LIGHT,
  }));

  const bodyRows = rows.map((row, ri) =>
    row.map(cell => ({
      text: typeof cell === 'object' && cell !== null ? cell.text : String(cell ?? '—'),
      color: (typeof cell === 'object' && cell !== null && cell.color) ? cell.color : undefined,
      alignment: (typeof cell === 'object' && cell !== null && cell.alignment) ? cell.alignment : undefined,
      border: [false, false, false, true],
      borderColor: [BORDER, BORDER, BORDER, BORDER],
      fillColor: ri % 2 === 1 ? LIGHT : WHITE,
      style: 'td',
    })),
  );

  return {
    table: {
      headerRows: 1,
      widths: colWidths,
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineColor: () => BORDER,
      vLineColor: () => 'transparent',
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 0, 0, 16],
  };
}

function twoColTables(left: Block, right: Block): Block {
  return {
    columns: [
      { stack: [left], width: '50%' },
      { width: 12, text: '' },
      { stack: [right], width: '*' },
    ],
    margin: [0, 0, 0, 0],
  };
}

// ── PDF content builders per report type ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPortfolioPdf(data: any, dateLabel: string): Block[] {
  const totalOutstanding = (data.byStatus as { totalOutstanding: number }[]).reduce((s, r) => s + r.totalOutstanding, 0);
  const active = data.byStatus.find((r: { status: string }) => r.status === 'ACTIVE');
  const par30 = (data.parBands as { band: string; balance: number }[])
    .filter(b => b.band !== 'current').reduce((s, b) => s + b.balance, 0);
  const par30pct = active && active.totalOutstanding > 0
    ? ((par30 / active.totalOutstanding) * 100).toFixed(1) + '%' : '0.0%';

  const bandColor = (band: string) => {
    if (band === '90+') return RED;
    if (band === '30-90') return ORANGE;
    if (band === '1-30') return YELLOW;
    return GREEN;
  };
  const bandLabel: Record<string, string> = {
    'current': 'Current (0 days)', '1-30': '1–30 days', '30-90': '31–90 days', '90+': '90+ days',
  };

  return [
    section('Executive Summary'),
    kpiGrid([
      { label: 'Total Outstanding', value: tzs(totalOutstanding) },
      { label: 'Active Loans', value: String(active?.count ?? 0) },
      { label: 'PAR 30+', value: tzs(par30), sub: `${par30pct} of active portfolio` },
      { label: 'Products', value: String(data.byProduct.length) },
    ]),
    section('Breakdown'),
    twoColTables(
      dataTable(
        ['Product', 'Loans', 'Outstanding'],
        data.byProduct.map((r: { productName: string; count: number; totalOutstanding: number }) => [
          r.productName,
          { text: String(r.count), alignment: 'right' },
          { text: tzs(r.totalOutstanding), alignment: 'right' },
        ]),
        ['*', 50, 100],
      ),
      dataTable(
        ['Status', 'Loans', 'Outstanding'],
        data.byStatus.map((r: { status: string; count: number; totalOutstanding: number }) => [
          r.status,
          { text: String(r.count), alignment: 'right' },
          { text: tzs(r.totalOutstanding), alignment: 'right' },
        ]),
        ['*', 50, 100],
      ),
    ),
    section('PAR Ageing Bands'),
    dataTable(
      ['Days Overdue', 'Loans', 'Balance at Risk'],
      ['current', '1-30', '30-90', '90+'].map(band => {
        const row = data.parBands.find((b: { band: string }) => b.band === band);
        return [
          { text: bandLabel[band], color: bandColor(band) },
          { text: String(row?.count ?? 0), alignment: 'right' },
          { text: tzs(row?.balance ?? 0), alignment: 'right', color: bandColor(band) },
        ];
      }),
      ['*', 60, 120],
    ),
    { text: dateLabel, style: 'caption' },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDisbursementsPdf(data: any, dateLabel: string): Block[] {
  return [
    section('Executive Summary'),
    kpiGrid([
      { label: 'Total Disbursed', value: tzs(data.totalAmount) },
      { label: 'Loans Disbursed', value: String(data.totalCount) },
      { label: 'Avg per Loan', value: data.totalCount > 0 ? tzs(data.totalAmount / data.totalCount) : '—' },
    ]),
    section('By Product'),
    dataTable(
      ['Product', 'Loans', 'Amount'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.byProduct.map((r: any) => [r.productName, { text: String(r.count), alignment: 'right' }, { text: tzs(r.amount), alignment: 'right' }]),
      ['*', 60, 120],
    ),
    section('By Channel'),
    dataTable(
      ['Channel', 'Count', 'Amount'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.byChannel.map((r: any) => [r.channel, { text: String(r.count), alignment: 'right' }, { text: tzs(r.amount), alignment: 'right' }]),
      ['*', 60, 120],
    ),
    section('Daily Trend'),
    dataTable(
      ['Date', 'Loans', 'Amount'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.daily.map((r: any) => [fmtDate(r.day), { text: String(r.count), alignment: 'right' }, { text: tzs(r.amount), alignment: 'right' }]),
      ['*', 60, 120],
    ),
    { text: dateLabel, style: 'caption' },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCollectionsPdf(data: any, dateLabel: string): Block[] {
  return [
    section('Executive Summary'),
    kpiGrid([
      { label: 'Total Collected', value: tzs(data.totalAmount) },
      { label: 'Repayments', value: String(data.totalCount) },
      { label: 'Avg per Repayment', value: data.totalCount > 0 ? tzs(data.totalAmount / data.totalCount) : '—' },
    ]),
    section('By Channel'),
    dataTable(
      ['Channel', 'Count', 'Amount'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.byChannel.map((r: any) => [r.channel, { text: String(r.count), alignment: 'right' }, { text: tzs(r.amount), alignment: 'right' }]),
      ['*', 60, 120],
    ),
    section('By Product'),
    dataTable(
      ['Product', 'Count', 'Amount'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.byProduct.map((r: any) => [r.productName, { text: String(r.count), alignment: 'right' }, { text: tzs(r.amount), alignment: 'right' }]),
      ['*', 60, 120],
    ),
    section('Daily Trend'),
    dataTable(
      ['Date', 'Repayments', 'Amount'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.daily.map((r: any) => [fmtDate(r.day), { text: String(r.count), alignment: 'right' }, { text: tzs(r.amount), alignment: 'right' }]),
      ['*', 60, 120],
    ),
    { text: dateLabel, style: 'caption' },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSavingsPdf(data: any, dateLabel: string): Block[] {
  const deposits     = data.depositVsWithdrawal.find((r: { type: string }) => r.type === 'DEPOSIT');
  const withdrawals  = data.depositVsWithdrawal.find((r: { type: string }) => r.type === 'WITHDRAWAL');
  return [
    section('Executive Summary'),
    kpiGrid([
      { label: 'Total Accounts',  value: String(data.totalAccounts) },
      { label: 'Total Balance',   value: tzs(data.totalBalance) },
      { label: 'Deposits',        value: tzs(deposits?.amount ?? 0), sub: `${deposits?.count ?? 0} transactions` },
      { label: 'Withdrawals',     value: tzs(withdrawals?.amount ?? 0), sub: `${withdrawals?.count ?? 0} transactions` },
    ]),
    section('By Status'),
    dataTable(
      ['Status', 'Accounts', 'Balance'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.byStatus.map((r: any) => [r.status, { text: String(r.count), alignment: 'right' }, { text: tzs(r.balance), alignment: 'right' }]),
      ['*', 80, 120],
    ),
    section('By Product'),
    dataTable(
      ['Product', 'Accounts', 'Balance'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.byProduct.map((r: any) => [r.productName, { text: String(r.count), alignment: 'right' }, { text: tzs(r.balance), alignment: 'right' }]),
      ['*', 80, 120],
    ),
    { text: dateLabel, style: 'caption' },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildClientsPdf(data: any): Block[] {
  const totalClients = (data.byGender as { count: number }[]).reduce((s, r) => s + r.count, 0);
  const kycPct = data.kycStatus.total > 0
    ? Math.round((data.kycStatus.verified / data.kycStatus.total) * 100) + '%' : '0%';

  return [
    section('Executive Summary'),
    kpiGrid([
      { label: 'Total Clients',  value: String(totalClients) },
      { label: 'KYC Verified',   value: String(data.kycStatus.verified), sub: `${kycPct} of clients` },
      { label: 'KYC Pending',    value: String(data.kycStatus.unverified) },
      { label: 'Regions',        value: String(data.byRegion.length) },
    ]),
    section('By Gender'),
    dataTable(
      ['Gender', 'Clients', 'Share'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.byGender.map((r: any) => [
        r.gender.charAt(0) + r.gender.slice(1).toLowerCase(),
        { text: String(r.count), alignment: 'right' },
        { text: totalClients > 0 ? Math.round((r.count / totalClients) * 100) + '%' : '—', alignment: 'right' },
      ]),
      ['*', 80, 80],
    ),
    section('Top Regions'),
    dataTable(
      ['Region', 'Clients'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.byRegion.map((r: any) => [r.region, { text: String(r.count), alignment: 'right' }]),
      ['*', 80],
    ),
    section('Registration Trend (last 12 months)'),
    dataTable(
      ['Month', 'New Clients'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.registrationTrend.map((r: any) => [fmtDate(r.month), { text: String(r.count), alignment: 'right' }]),
      ['*', 100],
    ),
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildBotPdf(data: any): Block[] {
  const nplRatioPct = data.nonPerformingLoans.nplRatio.toFixed(1) + '%';
  return [
    section('Report Period'),
    { text: `${fmtDate(data.reportPeriod.from)}  to  ${fmtDate(data.reportPeriod.to)}`, style: 'caption', margin: [0, 0, 0, 12] },
    section('Active Portfolio'),
    kpiGrid([
      { label: 'Active Loans',           value: String(data.activePortfolio.loanCount) },
      { label: 'Gross Loan Portfolio',   value: tzs(data.activePortfolio.grossLoanPortfolio) },
      { label: 'Outstanding Balance',    value: tzs(data.activePortfolio.outstandingBalance) },
    ]),
    section('Period Activity'),
    kpiGrid([
      { label: 'Loans Disbursed',        value: String(data.newLoans.count), sub: tzs(data.newLoans.amount) },
      { label: 'Loans Closed',           value: String(data.closedLoans.count) },
      { label: 'Repayments Received',    value: tzs(data.repayments.amount), sub: `${data.repayments.count} transactions` },
    ]),
    section('Non-Performing Loans (> 90 days overdue)'),
    kpiGrid([
      { label: 'NPL Count',   value: String(data.nonPerformingLoans.count) },
      { label: 'NPL Balance', value: tzs(data.nonPerformingLoans.balance) },
      { label: 'NPL Ratio',   value: nplRatioPct },
    ]),
    hRule(),
    { text: 'This report is generated for submission to the Bank of Tanzania (BoT) in compliance with MFI reporting requirements.', style: 'caption', margin: [0, 4, 0, 0] },
  ];
}

// ── Main service ──────────────────────────────────────────────────────────────

@Injectable({ scope: Scope.REQUEST })
export class ReportPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    private readonly reportsService: ReportsService,
  ) {}

  async generatePdf(
    type: string,
    from?: string,
    to?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const tenantId = this.tenantCtx.tenantId;
    const tenantRow = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, brandPrimary: true },
    });
    const tenantName = tenantRow?.name ?? 'MFI Platform';
    const brandColor = tenantRow?.brandPrimary ?? NAVY;

    const dateLabel = from && to
      ? `Period: ${fmtDate(from)} – ${fmtDate(to)}`
      : from ? `From: ${fmtDate(from)}` : to ? `To: ${fmtDate(to)}` : 'All time';

    const TITLES: Record<string, string> = {
      portfolio:     'Loan Portfolio Report',
      disbursements: 'Disbursements Report',
      collections:   'Collections Report',
      savings:       'Savings Report',
      clients:       'Client Demographics Report',
      bot:           'Bank of Tanzania (BoT) MFI Report',
    };

    const title = TITLES[type];
    if (!title) throw new BadRequestException(`Unknown report type: ${type}`);

    let content: Block[];
    switch (type) {
      case 'portfolio':
        content = buildPortfolioPdf(await this.reportsService.portfolioReport(from, to), dateLabel);
        break;
      case 'disbursements':
        content = buildDisbursementsPdf(await this.reportsService.disbursementsReport(from, to), dateLabel);
        break;
      case 'collections':
        content = buildCollectionsPdf(await this.reportsService.collectionsReport(from, to), dateLabel);
        break;
      case 'savings':
        content = buildSavingsPdf(await this.reportsService.savingsReport(from, to), dateLabel);
        break;
      case 'clients':
        content = buildClientsPdf(await this.reportsService.clientsReport());
        break;
      case 'bot':
        content = buildBotPdf(await this.reportsService.botReport(from ?? '', to ?? ''));
        break;
      default:
        throw new BadRequestException(`Unknown report type: ${type}`);
    }

    const generatedAt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 72, 40, 52],

      // ── Running header ───────────────────────────────────────────────────────
      header: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            stack: [
              { canvas: [{ type: 'rect', x: 0, y: 0, w: 595, h: 4, color: brandColor }] },
              {
                columns: [
                  { text: tenantName, bold: true, fontSize: 9, color: brandColor, margin: [40, 8, 0, 0] },
                  { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8, color: MUTED, alignment: 'right', margin: [0, 8, 40, 0] },
                ],
              },
            ],
          },
        ],
      }),

      // ── Running footer ───────────────────────────────────────────────────────
      footer: () => ({
        text: `Generated by MFI Platform  ·  ${generatedAt}  ·  Confidential`,
        fontSize: 7,
        color: MUTED,
        alignment: 'center',
        margin: [40, 8, 40, 0],
      }),

      // ── Document body ────────────────────────────────────────────────────────
      content: [
        // Title block
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 3, color: brandColor }] },
        { text: title, style: 'h1', margin: [0, 12, 0, 2] },
        { text: dateLabel, style: 'subtitle', margin: [0, 0, 0, 4] },
        { text: tenantName, style: 'org', margin: [0, 0, 0, 20] },
        hRule(),
        ...content,
      ],

      styles: {
        h1:       { fontSize: 20, bold: true, color: NAVY },
        subtitle: { fontSize: 10, color: MUTED },
        org:      { fontSize: 10, color: BLUE, bold: true },
        th:       { fontSize: 8,  bold: true, color: MUTED, fillColor: LIGHT },
        td:       { fontSize: 9,  color: '#1E293B' },
        caption:  { fontSize: 8,  color: MUTED, italics: true },
      },

      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
        lineHeight: 1.3,
      },
    };

    const buffer: Buffer = await pdfmake.createPdf(docDefinition).getBuffer();

    const slug = type.replace(/_/g, '-');
    const dateSlug = (from ?? to) ? `-${(from ?? to)!.slice(0, 7)}` : '';
    const filename = `${tenantName.replace(/[^a-zA-Z0-9]/g, '-')}-${slug}${dateSlug}.pdf`.toLowerCase();

    return { buffer, filename };
  }
}
