import { z } from 'zod';
export const industries = [
  'Manufacturing',
  'Engineering',
  'Trading',
  'Retail',
  'IT/software',
  'Startups',
  'Services',
  'Food processing',
  'Agriculture-related',
];
export const states = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];
export const businessTypes = [
  'Proprietorship',
  'Partnership',
  'LLP',
  'Private Limited',
  'Public Limited',
  'One Person Company',
  'Startup',
  'Other',
];
export const stages = [
  'Idea',
  'Startup',
  'Early stage',
  'Growth',
  'Established',
  'Expansion',
];
export const registrations = [
  'Udyam Registration',
  'GST Registration',
  'PAN',
  'TAN',
  'Startup recognition',
  'IEC',
  'FSSAI',
  'Factory licence',
  'Other relevant registrations',
];
export const objectives = [
  'Working capital',
  'Machinery purchase',
  'Technology upgrade',
  'Digitalisation',
  'Export',
  'Market expansion',
  'Employment generation',
  'Skill development',
  'Green energy',
  'Renewable energy',
  'Women entrepreneurship',
  'Startup funding',
  'Research & development',
  'Infrastructure',
  'Quality certification',
];
const text = z.string().trim().min(1, 'This field is required.').max(200);
const money = z
  .number()
  .finite()
  .min(0, 'Enter a positive amount or zero.')
  .max(1e13, 'Amount is too large.');
export const profileBaseSchema = z.object({
  businessName: text,
  businessType: text,
  industry: text,
  subIndustry: z.string().max(200),
  activity: text,
  state: text,
  district: text,
  city: text,
  stage: text,
  turnover: money,
  investment: money,
  revenue: money,
  employees: z.number().int().min(0).max(1e7),
  registrations: z.array(z.string().max(100)).max(30),
  objectives: z
    .array(z.string().max(100))
    .min(1, 'Choose at least one objective.')
    .max(30),
  exporting: z.boolean(),
  exportMarkets: z.string().max(1000),
  planningExport: z.boolean(),
  planningExpansion: z.boolean(),
  expansionLocation: z.string().max(200),
  womenOwned: z.boolean().optional(),
  step: z.number().int().min(0).max(6),
  confirmed: z.boolean(),
});
export const draftProfileSchema = profileBaseSchema
  .partial()
  .extend({
    // Earlier steps send the wizard's default empty selection. Require an
    // objective only when validating Step 5 or confirming the full profile.
    objectives: z.array(z.string().max(100)).max(30).optional(),
  })
  .extend(
    Object.fromEntries(
      [
        'businessName',
        'businessType',
        'industry',
        'subIndustry',
        'activity',
        'state',
        'district',
        'city',
        'stage',
      ].map((k) => [k, z.string().max(200).optional()]),
    ),
  );
export const profileSchema = profileBaseSchema.superRefine((p, c) => {
  if (p.exporting && !p.exportMarkets.trim())
    c.addIssue({
      code: 'custom',
      path: ['exportMarkets'],
      message: 'Add at least one export market.',
    });
  if (p.planningExpansion && !p.expansionLocation.trim())
    c.addIssue({
      code: 'custom',
      path: ['expansionLocation'],
      message: 'Add your planned expansion location.',
    });
});
export const ruleSchema = z
  .object({
    id: text,
    field: z.enum([
      'industry',
      'state',
      'businessType',
      'stage',
      'turnover',
      'investment',
      'employees',
      'registrations',
      'exporting',
      'planningExport',
      'objectives',
      'womenOwned',
    ]),
    operator: z.enum(['in', 'range', 'all', 'any', 'equals']),
    value: z.union([z.array(z.string()), z.array(z.number()), z.boolean()]),
    label: text,
    required: z.boolean(),
    weight: z.number().min(1).max(100),
  })
  .superRefine((r, c) => {
    let valid: boolean;
    if (r.operator === 'range')
      valid =
        Array.isArray(r.value) &&
        r.value.length === 2 &&
        r.value.every((v) => typeof v === 'number') &&
        Number(r.value[0]) <= Number(r.value[1]);
    else if (r.operator === 'equals') valid = typeof r.value === 'boolean';
    else
      valid =
        Array.isArray(r.value) &&
        r.value.length > 0 &&
        r.value.every((v) => typeof v === 'string');
    if (!valid)
      c.addIssue({
        code: 'custom',
        message: 'Rule operator and value must agree.',
      });
  });
export const schemeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,100}$/),
    name: text,
    description: z.string().min(10).max(2000),
    detail: z.string().min(10).max(10000),
    level: z.enum(['Central', 'State']),
    ministry: text,
    department: text,
    state: text,
    industries: z.array(text).min(1),
    categories: z.array(text).min(1),
    fundingType: text,
    benefit: text,
    maximumBenefit: money,
    subsidyPercentage: z.number().min(0).max(100).nullable(),
    loanSupport: z.boolean(),
    grantSupport: z.boolean(),
    reimbursement: z.boolean(),
    rules: z.array(ruleSchema),
    documents: z.array(text),
    process: z.array(text),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    officialUrl: z.string().url().startsWith('https://').nullable(),
    source: text,
    verifiedAt: z.string().nullable(),
    status: z.enum([
      'Draft',
      'Pending Verification',
      'Verified',
      'Needs Review',
      'Expired',
      'Archived',
    ]),
    demo: z.boolean(),
    tags: z.array(text),
    createdAt: z.string(),
  })
  .superRefine((s, c) => {
    if (
      s.status === 'Verified' &&
      (s.demo || !s.officialUrl || !s.verifiedAt || !s.rules.length)
    )
      c.addIssue({
        code: 'custom',
        message:
          'Verified records require non-demo data, official source URL, verification date, and rules.',
      });
    if (
      s.verifiedAt &&
      (!Number.isFinite(Date.parse(s.verifiedAt)) ||
        Date.parse(s.verifiedAt) > Date.now())
    )
      c.addIssue({
        code: 'custom',
        message: 'Verification date must be valid and not in the future.',
      });
  });
export const applicationStatuses = [
  'Interested',
  'Documents Pending',
  'Ready to Apply',
  'Application Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Closed',
] as const;
export function completeness(p: Partial<z.infer<typeof profileSchema>>) {
  const keys = [
    'businessName',
    'businessType',
    'industry',
    'activity',
    'state',
    'district',
    'city',
    'stage',
    'turnover',
    'investment',
    'revenue',
    'employees',
    'registrations',
    'objectives',
    'exporting',
    'planningExport',
    'planningExpansion',
  ] as const;
  return Math.round(
    (keys.filter((k) => {
      const v = p[k];
      return v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0);
    }).length /
      keys.length) *
      100,
  );
}
