export type CompanyInput = {
  companyName: string;
  industry: string;
  companyUrl: string;
  news: string;
  ir: string;
  recruiting: string;
  csr: string;
  painPoints: string;
  memo: string;
};

export type MunicipalityCandidate = {
  name: string;
  prefecture: string;
  themes: string[];
  reason: string;
  prHook: string;
  educationAsset: string;
  populationIssue: string;
};

export type KpiItem = {
  label: string;
  target: string;
  note: string;
};

export type ChannelPlan = {
  channel: string;
  idea: string;
  execution: string;
  kpi: string;
};

export type SalesEmail = {
  subject: string;
  body: string;
};

export type ProposalOutput = {
  proposalTitles: string[];
  executiveSummary: string;
  companyAnalysis: string;
  assumedIssues: string[];
  csrEsgPerspective: string[];
  recruitmentIssues: string[];
  municipalityThemes: string[];
  municipalityCandidates: MunicipalityCandidate[];
  donationStory: string;
  prStrategy: string;
  newsIdeas: string[];
  ceremonyPlan: string;
  tvPlan: string;
  tverPlan: string;
  snsVideoIdeas: string[];
  youtubePlan: string;
  localGovernmentPr: string;
  employeeAppearancePlan: string;
  recruitmentBranding: string;
  salesProposalOutline: string[];
  kpis: KpiItem[];
  firstSalesEmail: SalesEmail;
  nextActions: string[];
  riskNotes: string[];
  channelPlans: ChannelPlan[];
};

export type StrategicAnalysis = {
  companyAnalysis: string;
  competitiveAdvantage: string;
  industryIssues: string;
  regionalFit: string;
  donationThemeHypothesis: string;
};

export type AnalysisResponse = {
  analysis: StrategicAnalysis;
  analysisText: string;
  demo: boolean;
  model: string;
  notice?: string;
};

export type DetailResponse = {
  detail: string;
  demo: boolean;
  model: string;
  notice?: string;
};

export type GenerateResponse = {
  proposal: ProposalOutput;
  demo: boolean;
  model: string;
  notice?: string;
};
