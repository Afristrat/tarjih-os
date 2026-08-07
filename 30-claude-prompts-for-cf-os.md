**30 Claude Prompts for CFOs**

*A practical playbook across the full CFO scope of work*

Financial Planning · Treasury · Reporting · Tax · Risk · M&A · Investor Relations · ESG · Strategy

# Introduction

This document contains 30 ready-to-use prompts for CFOs working with Claude. The prompts are grouped by the core areas of a CFO's responsibilities — from FP&A and treasury, through reporting, tax and compliance, risk and controls, M&A and capital allocation, investor relations, ESG, and strategic transformation.

Each prompt is designed to be copy-paste ready. Replace the bracketed placeholders (e.g., [PERIOD], [SECTOR]) with your specifics, and attach the source data referenced in the "Context needed" line below each prompt for best results.

## How to Use These Prompts

-   Always anchor with data. Claude performs dramatically better when you upload the actual files (P&L exports, agings, contracts, board decks) rather than describing them.
-   Set the role. Starting with "You are my senior FP&A analyst / Treasury Director / M&A advisor" calibrates tone and depth.
-   Iterate. The first pass gives you structure; the second and third refine based on your business specifics.
-   Mind confidentiality. For sensitive financial data, use Claude through Claude for Enterprise or the API with appropriate data controls.
-   Always validate. AI outputs in finance must be reviewed by a qualified human before they hit board reports, statutory filings, or external communications.

# 1. Financial Planning & Analysis (FP&A)

### Prompt 1 — Annual Budget Review & Variance Analysis

| You are my senior FP&A analyst. Review the attached actuals vs. budget for [PERIOD] and produce a variance analysis. For each variance \>5% or \>\$[THRESHOLD], identify: (1) the root cause (volume, price, mix, FX, one-offs), (2) whether it's structural or temporary, (3) implications for full-year forecast, and (4) recommended corrective actions. Prioritize the top 5 variances by P&L impact and present findings in a board-ready summary (max 1 page) followed by a detailed appendix. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Budget vs. actuals export (Excel/CSV), prior-year comparatives, business segment definitions, materiality thresholds.*

### Prompt 2 — Driver-Based Forecast Model Design

| Help me design a driver-based forecast model for [BUSINESS LINE]. Walk me through: (1) the key revenue drivers and how they should be modeled (e.g., volume × price, funnel conversion, cohort retention), (2) the cost drivers split into variable, semi-variable, and fixed, (3) the assumptions that need explicit sensitivity analysis, and (4) the structure of the model (sheets, inputs, outputs). Then generate a starter Excel file with formulas and clear input cells. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Business model description, current revenue/cost structure, historical 12–36 months of P&L data, key operational KPIs.*

### Prompt 3 — Scenario & Sensitivity Planning

| Build a 3-scenario plan (base, upside, downside) for FY[YEAR]. For each scenario, define: macro assumptions, customer/volume assumptions, pricing, margin, and working capital. Calculate the resulting revenue, EBITDA, FCF, and net debt position. Identify the "trigger metrics" we should monitor monthly to detect which scenario is materializing, and the management actions tied to each. |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Current operating plan, key macro exposures (FX, commodities, rates), historical performance ranges, debt covenants.*

### Prompt 4 — Monthly Management Reporting Pack

| Convert this raw financial data into a monthly CFO report pack with: (1) Executive summary (5 bullet points, plain English), (2) P&L with YoY and vs. budget, (3) Cash flow bridge from EBITDA to FCF, (4) KPI dashboard (commercial + operational), (5) Top 3 risks and top 3 opportunities, (6) Suggested CEO/board talking points. Tone: confident, concise, no jargon padding. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Trial balance or P&L export, KPI definitions, prior period reports for consistency, board reporting template if available.*

# 2. Treasury & Cash Management

### Prompt 5 — 13-Week Rolling Cash Flow Forecast

| Build a 13-week direct cash flow forecast based on the attached AR aging, AP aging, payroll schedule, debt service calendar, and tax payment schedule. Identify the weeks with lowest projected liquidity, the minimum cash buffer required, and 3 actionable levers to improve cash position by [DATE]. Flag any covenant breach risk if minimum liquidity is hit. |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *AR/AP agings, payroll calendar, debt amortization schedule, tax calendar, current cash balances by entity/bank, credit facility availability.*

### Prompt 6 — Working Capital Optimization Diagnostic

| Analyze our working capital position vs. industry benchmarks. Calculate DSO, DPO, DIO, and CCC for the last 8 quarters. Identify the trend, the biggest deviation from peers in [SECTOR], and quantify the cash unlock potential if we move each metric to top quartile. Recommend 5 concrete initiatives ranked by cash impact and implementation difficulty. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Quarterly balance sheet data (AR, AP, inventory, revenue, COGS), peer benchmark data or industry, current credit terms and policies.*

### Prompt 7 — Banking & Credit Facility Review

| Review our current credit facilities (term loan, RCF, factoring) and produce a summary table covering: lender, facility size, drawn vs. undrawn, pricing (margin + reference rate), covenants, maturity, security. Identify: (1) facilities maturing in \<18 months, (2) covenant headroom risks, (3) refinancing options to explore. Draft a one-pager I can share with our relationship banks. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Credit agreements (or extracts), current covenant calculations, latest forecast for covenant projection, banking relationship map.*

### Prompt 8 — FX Hedging Strategy Brief

| We have [EXPOSURE DESCRIPTION] in foreign currencies. Draft a hedging policy proposal covering: (1) which exposures to hedge (transaction, translation, economic) and why, (2) recommended hedge ratios and tenors, (3) instruments (forwards, options, swaps) with pros/cons, (4) hedge accounting implications under IFRS 9 / ASC 815, (5) governance and approval limits. Format as a treasury committee memo. |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *FX exposure schedule by currency, revenue/cost split by currency, current hedging position, applicable accounting framework, risk appetite statement.*

# 3. Financial Reporting & Close

### Prompt 9 — Month-End Close Acceleration Plan

| Our current close takes [X] business days. Map the close process step by step, identify bottlenecks, dependencies, and manual workarounds. Propose a target operating model to reduce close to [Y] days, including: which tasks to automate, which to push earlier in the month (continuous close), which controls to redesign, and what ERP/EPM capabilities we'd need. Build a 90-day implementation roadmap. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Current close calendar with task owners and durations, ERP/consolidation tool in use, list of manual journals, audit findings on close.*

### Prompt 10 — Technical Accounting Memo Drafting

| Draft a technical accounting memo on [TRANSACTION/ISSUE] under [IFRS/US GAAP]. Structure: (1) Background and facts, (2) Issue, (3) Relevant standards and guidance, (4) Analysis, (5) Conclusion and journal entries, (6) Disclosure implications. Cite the specific paragraphs and include any judgment areas where auditor alignment is required. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Transaction details (contracts, term sheets), applicable framework, materiality, similar prior precedents within the company.*

### Prompt 11 — Annual Report Narrative & MD&A

| Using the attached financial results and business updates, draft the Management Discussion & Analysis section of the annual report. Cover: business highlights, revenue drivers by segment, margin evolution, cash flow story, capital allocation, risks and outlook. Tone: confident but not promotional, balanced, investor-grade. Length: [X] words. Flag any statements that may need legal/IR review. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Audited financials, segment data, prior year MD&A, strategy document, key risk register, regulatory disclosure requirements.*

### Prompt 12 — Audit Preparation & PBC Tracker

| Build a "Prepared By Client" (PBC) request list and tracker for our [YEAR-END / INTERIM] audit. Categorize requests by area (revenue, inventory, fixed assets, provisions, taxes, etc.), assign owners, set internal deadlines (1 week ahead of auditor deadline), and flag the high-risk areas where additional documentation is needed. Include a status dashboard view. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Auditor's PBC list, organizational structure of finance team, prior year audit findings, scope changes.*

# 4. Tax & Compliance

### Prompt 13 — Effective Tax Rate Reconciliation & Planning

| Reconcile our effective tax rate from statutory rate to ETR for the last 3 years. Explain each reconciling item (permanent differences, tax credits, foreign rate differential, uncertain tax positions, valuation allowance changes). Identify 3 legitimate optimization opportunities to reduce ETR sustainably and quantify expected savings. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Tax provision workings, jurisdictional P&L splits, tax attribute schedule (NOLs, credits), transfer pricing documentation summary.*

### Prompt 14 — Transfer Pricing Documentation Review

| Review our current transfer pricing policy summary against OECD BEPS guidelines and Pillar Two implications. Identify: (1) gaps in our master file / local file documentation, (2) risk areas where current intercompany pricing may not be defensible, (3) jurisdictions with high audit risk given recent enforcement trends, (4) recommended actions for the next 12 months. |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Current TP policy and master file extracts, intercompany transaction matrix, jurisdictions of operation, recent tax audit history.*

### Prompt 15 — Regulatory Change Impact Assessment

| Summarize the impact of [NEW REGULATION e.g., Pillar Two, CSRD, SEC climate rules] on our company. Cover: (1) what's required, (2) effective dates and transition provisions, (3) data and process implications for finance, (4) estimated cost of compliance, (5) penalties for non-compliance, (6) a 90/180/365-day action plan. Output as a board-ready briefing. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Company footprint (jurisdictions, revenue thresholds), current compliance maturity, applicable regulation text or summary.*

# 5. Risk Management & Internal Controls

### Prompt 16 — Enterprise Risk Register Refresh

| Help me refresh our enterprise risk register. From the attached business strategy and recent board minutes, identify the top 15 risks across financial, operational, strategic, regulatory, cyber, and ESG categories. For each risk: describe it, assign inherent likelihood and impact (1–5 scale), list current mitigations, assess residual risk, and identify the risk owner. Present as a heat map plus detail table. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Strategic plan, prior risk register, recent incidents/near-misses, board minutes, internal audit reports.*

### Prompt 17 — SOX / ICFR Control Gap Analysis

| Review the attached process narrative for [PROCESS e.g., revenue recognition] and identify: (1) the key risks, (2) where controls exist vs. where there are gaps, (3) whether existing controls are preventive or detective and their frequency, (4) segregation of duties issues, (5) recommended new or enhanced controls. Format the output as a risk-control matrix (RCM). |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Process narrative or flowchart, current control catalog, recent deficiencies, system access matrix.*

### Prompt 18 — Fraud Risk & Anomaly Review Brief

| Given our business profile [DESCRIPTION], outline the top fraud schemes we should be testing for (e.g., ghost vendors, duplicate payments, expense manipulation, revenue cutoff abuse, payroll fraud). For each scheme: describe the mechanics, red flags in data, suggested analytical tests, and the data we'd need to run them. Prioritize by likelihood and impact for our industry. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Industry, company size, current fraud monitoring tools, prior fraud incidents, sensitive process areas.*

# 6. M&A and Capital Allocation

### Prompt 19 — Target Screening Memo

| Based on our strategy of [STRATEGIC RATIONALE], help me build a target screening memo for potential acquisitions in [SECTOR/GEOGRAPHY]. Define: (1) strategic filter criteria, (2) financial filter criteria (size, growth, margin, leverage), (3) cultural/operational filters, (4) deal-breaker criteria. Then propose a scoring framework and a longlist-to-shortlist process. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Corporate strategy document, M&A criteria, target universe data (or list), available deal capacity, integration capability.*

### Prompt 20 — Due Diligence Quality of Earnings Review

| Analyze the target's financial data and produce a Quality of Earnings (QoE) analysis. Identify: (1) reported EBITDA, (2) normalization adjustments (one-offs, owner expenses, accounting policy differences), (3) run-rate adjustments, (4) revenue quality (recurring vs. one-time, customer concentration, churn), (5) working capital normalization, (6) red flags requiring follow-up in management Q&A. Output as a QoE report. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Target's monthly P&L (24–36 months), trial balance, customer revenue detail, accounting policies, related-party transactions.*

### Prompt 21 — Capital Allocation Framework

| Help me build a capital allocation framework to present to the board. Cover: (1) sources of capital and cost of each, (2) hurdle rates by investment type (maintenance capex, growth capex, M&A, R&D), (3) decision criteria and approval thresholds, (4) prioritization methodology when capital is constrained, (5) capital return policy (dividend, buyback). Include a one-page summary slide. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *WACC calculation inputs, current capital structure, pipeline of investment opportunities, dividend/buyback history, peer practices.*

### Prompt 22 — Post-Merger Integration Financial Plan

| Draft the finance workstream plan for integrating [ACQUIRED COMPANY]. Cover: Day-1 readiness (banking, payroll, AR/AP cutover), 100-day priorities (chart of accounts harmonization, consolidation, controls), synergy tracking methodology, reporting integration, and finance team org design. Include milestones, owners, and risks. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Deal thesis and synergy targets, target's finance org and systems, our finance org and systems, deal timeline, integration governance structure.*

# 7. Investor Relations & Board Communication

### Prompt 23 — Earnings Call Script & Q&A Prep

| Draft the CFO portion of our earnings call script for [QUARTER]. Cover: financial highlights, segment performance, margin commentary, cash flow and balance sheet, capital allocation, and updated guidance. Then anticipate the top 15 analyst questions (covering soft spots, guidance, competitive dynamics, capital deployment) and draft strong, concise answers. Tone: confident, balanced, no over-promising. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Latest financials, prior earnings call transcripts, analyst notes/consensus, guidance metrics, recent press releases, peer earnings.*

### Prompt 24 — Board Pre-Read for Finance Review

| Convert this material into a board pre-read for the finance section of the next board meeting. Structure: (1) Performance vs. plan summary, (2) Forecast trajectory and outlook, (3) Balance sheet and liquidity, (4) Key risks and mitigations, (5) Strategic finance topics requiring board input, (6) Discussion questions for directors. Length: 8–10 pages, dense but readable. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Latest financial pack, current forecast, prior board materials, agenda items, strategic initiatives status.*

### Prompt 25 — Investor Update / Shareholder Letter

| Draft a shareholder letter / investor update for [PERIOD]. Cover business performance, strategic progress, capital allocation, outlook, and a candid assessment of challenges. Tone: Buffett-style — direct, transparent, long-term oriented, free of corporate jargon. Length: 1,500–2,000 words. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Annual/quarterly results, strategic milestones, key challenges, prior letters for tone consistency, CEO/Chair input themes.*

# 8. ESG & Sustainability Reporting

### Prompt 26 — CSRD / ISSB Disclosure Readiness

| Assess our readiness for [CSRD / ISSB S1 & S2 / SEC climate] disclosures. For each required disclosure category, rate our current state (Not Started / In Progress / Ready), identify data and process gaps, estimate effort to close, and flag the disclosures most likely to require external assurance. Output a readiness scorecard plus a remediation roadmap. |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Applicable framework requirements, current ESG data inventory, materiality assessment, organizational data sources, reporting timeline.*

### Prompt 27 — Carbon Accounting & Scope 3 Methodology

| Help me design a Scope 1, 2, and 3 GHG inventory methodology aligned with the GHG Protocol. For each scope and category: define data sources, calculation method, emission factors to use, level of accuracy (activity-based vs. spend- based), data owner, and audit trail requirements. Identify the Scope 3 categories that are likely material for our business and prioritize them. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Business activities by site, energy consumption data, supplier spend data, fleet info, product use phase data (if applicable), industry.*

# 9. Strategic Leadership & Transformation

### Prompt 28 — Finance Transformation Roadmap

| Build a 3-year finance transformation roadmap. Diagnose the current state across: people, process, technology, and data. Define the target operating model. Then sequence initiatives across the 3 years with: business case, owner, dependencies, KPIs, and investment required. Output: executive narrative + Gantt-style roadmap + one-page summary for the CEO. |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Current finance org chart and headcount, current systems landscape (ERP, EPM, RPA, etc.), pain points survey, peer benchmarks, available budget.*

### Prompt 29 — Pricing Strategy & Margin Defense Analysis

| Our gross margin has [INCREASED/DECLINED] by [X bps] over [PERIOD]. Decompose the change into: price, volume, mix, input cost, FX, and other. For each driver, recommend management actions. Then build a pricing review proposal: which products/customers are under-priced, where elasticity allows price increases, and the expected EBITDA impact of a [X]% targeted price action. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *SKU/customer-level revenue and cost data, price history, competitor pricing intel, customer contracts and renewal calendar.*

### Prompt 30 — AI & Data Strategy for the Finance Function

| As CFO, I need to define our finance AI strategy. Help me build it covering: (1) Vision for AI-enabled finance in 3 years, (2) Top 10 use cases prioritized on a 2x2 (impact vs. ease), (3) Data foundation requirements, (4) Governance framework (data policy, output validation, accountability), (5) Talent and upskilling plan, (6) Investment and ROI model, (7) 12-month execution roadmap. Output as a strategy document I can present to the audit committee. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**Context needed:** *Current finance tech stack, current AI experiments or pilots, finance team skill inventory, data architecture overview, applicable regulatory constraints.*

# Closing Notes

These 30 prompts are a starting kit, not a fixed menu. The best results come from adapting each prompt to your business — adding company-specific context (industry, size, stage, geography), tightening the output format you want, and feeding Claude the actual underlying data.

A practical workflow: pick one prompt, run it on real data, review the output critically, iterate on the prompt to refine what works. Within a few cycles you will have a personalized version of each prompt that your finance team can reuse with confidence.

*Always validate AI outputs before they reach board reports, statutory filings, or external communications.*
