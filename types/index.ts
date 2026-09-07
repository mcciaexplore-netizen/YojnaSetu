export type RuleField =
  | 'industry'
  | 'state'
  | 'businessType'
  | 'stage'
  | 'turnover'
  | 'investment'
  | 'employees'
  | 'registrations'
  | 'exporting'
  | 'planningExport'
  | 'objectives'
  | 'womenOwned';
export type Rule = {
  id: string;
  field: RuleField;
  operator: 'in' | 'range' | 'all' | 'any' | 'equals';
  value: string[] | number[] | boolean;
  label: string;
  required: boolean;
  weight: number;
};
export type Profile = {
  businessName: string;
  businessType: string;
  industry: string;
  subIndustry: string;
  activity: string;
  state: string;
  district: string;
  city: string;
  stage: string;
  turnover: number;
  investment: number;
  revenue: number;
  employees: number;
  registrations: string[];
  objectives: string[];
  exporting: boolean;
  exportMarkets: string;
  planningExport: boolean;
  planningExpansion: boolean;
  expansionLocation: string;
  womenOwned?: boolean;
  step: number;
  confirmed: boolean;
};
export type Scheme = {
  id: string;
  name: string;
  description: string;
  detail: string;
  level: 'Central' | 'State';
  ministry: string;
  department: string;
  state: string;
  industries: string[];
  categories: string[];
  fundingType: string;
  benefit: string;
  maximumBenefit: number;
  subsidyPercentage: number | null;
  loanSupport: boolean;
  grantSupport: boolean;
  reimbursement: boolean;
  rules: Rule[];
  documents: string[];
  process: string[];
  deadline: string | null;
  officialUrl: string | null;
  source: string;
  verifiedAt: string | null;
  status:
    | 'Draft'
    | 'Pending Verification'
    | 'Verified'
    | 'Needs Review'
    | 'Expired'
    | 'Archived';
  demo: boolean;
  tags: string[];
  createdAt: string;
};
export type Match = {
  scheme: Scheme;
  score: number;
  classification: string;
  conditions: {
    label: string;
    status: 'pass' | 'fail' | 'unknown';
    required: boolean;
  }[];
  eligible: boolean;
  needsVerification: boolean;
};
export type ApplicationStatus =
  | 'Interested'
  | 'Documents Pending'
  | 'Ready to Apply'
  | 'Application Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Closed';
export type Application = {
  id: string;
  schemeId: string;
  status: ApplicationStatus;
  checklistStatus: 'Not Started' | 'In Progress' | 'Ready' | 'Submitted';
  notes: string;
  reference: string;
  applicationDate: string;
  documents: {
    name: string;
    complete: boolean;
    fileId?: string;
    fileName?: string;
  }[];
  history: { status: string; at: string }[];
  updatedAt: string;
};
export type Saved = { schemeId: string; notes: string };
export type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  schemeId?: string;
  kind: string;
};
export type Enquiry = {
  id: string;
  business: string;
  schemeId: string;
  userId: string;
  question: string;
  contact: string;
  createdAt: string;
};
export type User = { id: string; email: string; role: 'user' | 'admin' };
export type UserData = {
  profile: Partial<Profile>;
  saved: Saved[];
  applications: Application[];
  notifications: Notification[];
  preferences: { email: boolean; inApp: boolean };
  events: { type: string; schemeId?: string; query?: string; at: string }[];
};
export type AppData = UserData & {
  user: User | null;
  schemes: Scheme[];
  mode: 'demo' | 'supabase' | 'neon';
  enquiries: Enquiry[];
  analytics?: {
    users: number;
    searches: number;
    matches: number;
    started: number;
    submitted: number;
    industries: Record<string, number>;
    objectives: Record<string, number>;
    popular: Record<string, number>;
    saved: Record<string, number>;
  };
  users?: User[];
  taxonomy: Record<string, string[]>;
};
