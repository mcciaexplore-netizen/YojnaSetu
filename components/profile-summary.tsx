import {
  Building2,
  MapPin,
  IndianRupee,
  ShieldCheck,
  Target,
  Globe2,
} from 'lucide-react';
import type { Profile } from '@/types';
const groups = [
  [
    'Business',
    Building2,
    [
      ['businessName', 'Business name'],
      ['businessType', 'Business type'],
      ['industry', 'Industry'],
      ['subIndustry', 'Sub-industry'],
      ['activity', 'Business activity'],
      ['stage', 'Business stage'],
    ],
  ],
  [
    'Location',
    MapPin,
    [
      ['state', 'State'],
      ['district', 'District'],
      ['city', 'City'],
    ],
  ],
  [
    'Business size',
    IndianRupee,
    [
      ['turnover', 'Annual turnover'],
      ['investment', 'Investment'],
      ['revenue', 'Annual revenue'],
      ['employees', 'Employees'],
    ],
  ],
  ['Registrations', ShieldCheck, [['registrations', 'Your registrations']]],
  [
    'Objectives',
    Target,
    [
      ['objectives', 'Support you need'],
      ['womenOwned', 'Women-owned business'],
    ],
  ],
  [
    'Export & expansion',
    Globe2,
    [
      ['exporting', 'Currently exporting'],
      ['exportMarkets', 'Export markets'],
      ['planningExport', 'Planning to export'],
      ['planningExpansion', 'Planning expansion'],
      ['expansionLocation', 'Expansion location'],
    ],
  ],
] as const;
export function ProfileSummary({ profile }: { profile: Partial<Profile> }) {
  return (
    <div className="profile-summary-grid">
      {groups.map(([title, Icon, fields]) => (
        <section key={title}>
          <h3>
            <Icon size={18} />
            {title}
          </h3>
          <dl>
            {fields.map(([key, label]) => {
              const value = profile[key];
              const display = Array.isArray(value)
                ? value.join(', ') || 'None selected'
                : typeof value === 'boolean'
                  ? value
                    ? 'Yes'
                    : 'No'
                  : value === undefined || value === ''
                    ? 'Not specified'
                    : ['turnover', 'investment', 'revenue'].includes(key)
                      ? '₹' + Number(value).toLocaleString('en-IN')
                      : String(value);
              return (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{display}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
