import type { Scheme, Rule } from '@/types';

const rule = (
  field: Rule['field'],
  operator: Rule['operator'],
  value: Rule['value'],
  label: string,
  required = true,
  weight = 15,
): Rule => ({ id: field, field, operator, value, label, required, weight });

const industries = [
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
const objective = (values: string[]) =>
  rule(
    'objectives',
    'any',
    values,
    'Business objective aligns with scheme support',
    false,
    100,
  );
const source = (page: number) =>
  'Copy of Govt Schemes Updated.pdf, page ' + page + ' (MCCIA source document)';

function scheme(input: {
  id: string;
  name: string;
  description: string;
  detail: string;
  page: number;
  department: string;
  benefit: string;
  maximumBenefit: number;
  fundingType: string;
  loanSupport?: boolean;
  grantSupport?: boolean;
  reimbursement?: boolean;
  subsidyPercentage?: number | null;
  categories: string[];
  rules: Rule[];
  tags?: string[];
}): Scheme {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    detail: input.detail,
    level: 'Central',
    ministry: 'Ministry of Micro, Small and Medium Enterprises',
    department: input.department,
    state: 'All',
    industries,
    categories: input.categories,
    fundingType: input.fundingType,
    benefit: input.benefit,
    maximumBenefit: input.maximumBenefit,
    subsidyPercentage: input.subsidyPercentage ?? null,
    loanSupport: !!input.loanSupport,
    grantSupport: !!input.grantSupport,
    reimbursement: !!input.reimbursement,
    rules: [...input.rules, objective(input.categories)],
    documents: [
      'Business and applicant identity documents',
      'Udyam or other registration documents where applicable',
      'Project, financial, and bank documents required by the administering authority',
    ],
    process: [
      'Confirm current guidelines and application availability with the administering authority or participating lender.',
      'Prepare the documents required for your applicant type and project.',
      'Apply through the official channel named by the authority or lender.',
      'This record summarizes the MCCIA source PDF and has not been independently verified against current government guidelines.',
    ],
    deadline: null,
    officialUrl: null,
    source: source(input.page),
    verifiedAt: null,
    status: 'Needs Review',
    demo: false,
    tags: [...input.categories, ...(input.tags ?? [])],
    createdAt: '2026-09-27T00:00:00.000Z',
  };
}

const ageAtLeastTwo = () =>
  rule(
    'yearsOperating',
    'range',
    [2, Number.MAX_SAFE_INTEGER],
    'Business has operated for at least 2 years',
  );
const microOrSmall = () =>
  rule('msmeClassification', 'in', ['Micro', 'Small'], 'Micro or Small enterprise');
const udyam = () =>
  rule('registrations', 'all', ['Udyam Registration'], 'Udyam registration');

export const seedSchemes: Scheme[] = [
  scheme({
    id: 'cgtmse',
    name: 'Credit Guarantee Scheme (CGTMSE)',
    description: 'Credit guarantee support for eligible Micro and Small Enterprises.',
    detail: 'The MCCIA PDF describes support for new and existing firms operating for at least 2 years, with credit facilities up to ₹10 crore and guarantee coverage of 75% to 90%. The lending institution sets the interest rate.',
    page: 4,
    department: 'Credit Guarantee Fund Trust for Micro and Small Enterprises',
    benefit: 'Credit facilities up to ₹10 crore; guarantee coverage of 75%–90%. The lender sets the interest rate.',
    maximumBenefit: 100000000,
    fundingType: 'Credit guarantee-backed loan',
    loanSupport: true,
    categories: ['Working capital', 'Machinery purchase', 'Business expansion'],
    rules: [microOrSmall(), ageAtLeastTwo()],
  }),
  scheme({
    id: 'interest-subvention-msme',
    name: 'Interest Subvention for MSMEs',
    description: 'Interest support on eligible MSME loans through scheduled commercial banks.',
    detail: 'The MCCIA PDF specifies new or existing Micro and Small businesses operating for at least 2 years, with GST registration. The stated loan limit is ₹100 crore and the interest subvention is 2% per year through eligible scheduled commercial banks.',
    page: 5,
    department: 'MSME interest support programme',
    benefit: '2% per year interest subvention on loans up to ₹100 crore through eligible scheduled commercial banks.',
    maximumBenefit: 1000000000,
    fundingType: 'Interest subvention',
    loanSupport: true,
    subsidyPercentage: 2,
    categories: ['Working capital', 'Machinery purchase', 'Business expansion'],
    rules: [
      microOrSmall(),
      ageAtLeastTwo(),
      rule('registrations', 'all', ['GST Registration'], 'GST registration'),
    ],
  }),
  scheme({
    id: 'mudra',
    name: 'Pradhan Mantri MUDRA Yojana (PMMY)',
    description: 'Loan support for eligible micro business activities.',
    detail: 'The MCCIA PDF describes support for new or existing firms operating for at least 2 years and loans up to ₹20 lakh. The lending institution sets the rate under applicable RBI and lender terms.',
    page: 6,
    department: 'Micro Units Development and Refinance Agency',
    benefit: 'Loans up to ₹20 lakh; rate set by the lending institution under applicable RBI terms.',
    maximumBenefit: 2000000,
    fundingType: 'Loan',
    loanSupport: true,
    categories: ['Working capital', 'Machinery purchase', 'Business expansion'],
    rules: [ageAtLeastTwo()],
  }),
  scheme({
    id: 'pmegp',
    name: 'Prime Minister’s Employment Generation Programme (PMEGP)',
    description: 'Credit-linked support for new eligible enterprises and applicants.',
    detail: 'The MCCIA PDF lists new firms operating for no more than 2 years and permits individuals, SHGs, institutions, cooperative societies, and charitable trusts. It states loans up to ₹50 lakh and a 25% subsidy for rural or urban projects.',
    page: 7,
    department: 'Khadi and Village Industries Commission',
    benefit: 'Loans up to ₹50 lakh with a 25% subsidy, as stated in the MCCIA PDF.',
    maximumBenefit: 5000000,
    fundingType: 'Credit-linked subsidy',
    loanSupport: true,
    subsidyPercentage: 25,
    categories: ['Startup funding', 'Employment generation', 'Machinery purchase'],
    rules: [
      rule('yearsOperating', 'range', [0, 2], 'New business operating for no more than 2 years'),
      rule(
        'businessType',
        'in',
        ['Individual', 'Proprietorship', 'SHG', 'Institution', 'Cooperative Society', 'Charitable Trust'],
        'Applicant is an individual, SHG, institution, cooperative society, or charitable trust',
      ),
      rule('projectType', 'in', ['Greenfield'], 'New greenfield project'),
    ],
  }),
  scheme({
    id: 'sfurti',
    name: 'Scheme of Fund for Regeneration of Traditional Industries (SFURTI)',
    description: 'Grant support to organize traditional industries into clusters.',
    detail: 'The MCCIA PDF specifies existing businesses operating for at least 2 years in traditional-industry clusters. It states grants up to ₹5 crore and says proposals are submitted through implementing agencies.',
    page: 8,
    department: 'Ministry of Micro, Small and Medium Enterprises',
    benefit: 'Cluster grant support up to ₹5 crore; proposals are routed through implementing agencies.',
    maximumBenefit: 50000000,
    fundingType: 'Cluster grant',
    grantSupport: true,
    categories: ['Skill development', 'Market expansion', 'Technology upgrade'],
    rules: [
      ageAtLeastTwo(),
      rule('traditionalClusterParticipation', 'in', ['Yes'], 'Participates in a traditional-industry cluster'),
    ],
  }),
  scheme({
    id: 'stand-up-india',
    name: 'Stand-Up India',
    description: 'Bank loan support for women and SC/ST entrepreneurs starting a greenfield venture.',
    detail: 'The MCCIA PDF specifies a greenfield project owned by a woman or SC/ST entrepreneur, with a loan from ₹10 lakh to ₹1 crore and 75% coverage.',
    page: 9,
    department: 'Stand-Up India programme',
    benefit: 'Loan from ₹10 lakh to ₹1 crore; the PDF states 75% coverage.',
    maximumBenefit: 10000000,
    fundingType: 'Bank loan',
    loanSupport: true,
    categories: ['Startup funding', 'Women entrepreneurship', 'Business expansion'],
    rules: [
      rule('beneficiaryCategory', 'in', ['Women', 'SC', 'ST', 'Women + SC', 'Women + ST', 'SC + ST', 'Women + SC + ST'], 'Woman or SC/ST entrepreneur'),
      rule('projectType', 'in', ['Greenfield'], 'Greenfield project'),
    ],
  }),
  scheme({
    id: 'startup-india',
    name: 'Startup India',
    description: 'Seed, tax, and patent-fee benefits for qualifying new firms.',
    detail: 'The MCCIA PDF specifies new firms operating for no more than 2 years with Startup recognition. It describes seed support up to ₹20 lakh, an 80% patent-fee rebate, and a tax exemption for up to 3 years.',
    page: 10,
    department: 'Startup India',
    benefit: 'Seed support up to ₹20 lakh, 80% patent-fee rebate, and tax exemption for up to 3 years, as stated in the MCCIA PDF.',
    maximumBenefit: 2000000,
    fundingType: 'Seed support and tax/patent benefits',
    grantSupport: true,
    reimbursement: true,
    categories: ['Startup funding', 'Research & development', 'Technology upgrade'],
    rules: [
      rule('yearsOperating', 'range', [0, 2], 'New business operating for no more than 2 years'),
      rule('registrations', 'all', ['Startup recognition'], 'Startup recognition'),
    ],
  }),
  scheme({
    id: 'procurement-marketing-support',
    name: 'Procurement and Marketing Support Scheme',
    description: 'Market-access and capacity-building support for established MSMEs.',
    detail: 'The MCCIA PDF specifies existing MSMEs operating for at least 2 years. It lists subsidy rates of 80% for General applicants and 100% for SC/ST/Women applicants, with support for market access and capacity building through MSME-DFOs.',
    page: 11,
    department: 'Ministry of Micro, Small and Medium Enterprises',
    benefit: 'Market access and capacity-building support; subsidy stated as 80% General or 100% SC/ST/Women.',
    maximumBenefit: 0,
    fundingType: 'Subsidy and market access',
    reimbursement: true,
    categories: ['Market expansion', 'Skill development', 'Export'],
    rules: [
      rule('msmeClassification', 'in', ['Micro', 'Small', 'Medium'], 'Micro, Small, or Medium enterprise'),
      ageAtLeastTwo(),
    ],
  }),
  scheme({
    id: 'mse-gift',
    name: 'MSE Green Investment and Financing for Transformation (MSE-GIFT)',
    description: 'Green-technology financing for Udyam-registered Micro and Small Enterprises.',
    detail: 'The MCCIA PDF specifies Udyam-registered Micro and Small businesses adopting green technology. It states loans up to ₹2 crore and 2% per year interest support through SIDBI.',
    page: 12,
    department: 'Small Industries Development Bank of India',
    benefit: 'Loan up to ₹2 crore with 2% per year interest support, as stated in the MCCIA PDF.',
    maximumBenefit: 20000000,
    fundingType: 'Green-technology loan with interest support',
    loanSupport: true,
    subsidyPercentage: 2,
    categories: ['Green energy', 'Renewable energy', 'Technology upgrade'],
    rules: [
      microOrSmall(),
      udyam(),
      rule('greenTechProject', 'in', ['Yes'], 'Project adopts green technology'),
    ],
  }),
  scheme({
    id: 'mse-spice',
    name: 'MSE Scheme for Promotion and Investment in Circular Economy (MSE-SPICE)',
    description: 'Capital subsidy for eligible brownfield circular-economy projects.',
    detail: 'The MCCIA PDF specifies Udyam-registered Micro and Small businesses undertaking brownfield projects that upgrade or expand circular-economy projects. It states 25% of project cost up to ₹50 lakh, capped at ₹12.5 lakh. The PDF does not define “CE.”',
    page: 13,
    department: 'Small Industries Development Bank of India',
    benefit: '25% of project cost, up to ₹50 lakh, with assistance capped at ₹12.5 lakh.',
    maximumBenefit: 1250000,
    fundingType: 'Capital subsidy',
    grantSupport: true,
    subsidyPercentage: 25,
    categories: ['Technology upgrade', 'Machinery purchase', 'Green energy'],
    rules: [
      microOrSmall(),
      udyam(),
      rule('projectType', 'in', ['Brownfield'], 'Brownfield upgrade or expansion project'),
      rule('ceProject', 'in', ['Yes'], 'Project upgrades or expands a circular-economy (CE) project'),
    ],
  }),
];
