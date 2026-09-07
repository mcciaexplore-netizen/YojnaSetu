'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ArrowLeft, Check, Save, Building2 } from 'lucide-react';
import {
  profileSchema,
  businessTypes,
  stages,
  registrations,
} from '@/lib/validation';
import { ProfileSummary } from '@/components/profile-summary';
import { Workflow } from '@/components/workflow';
import type { Profile } from '@/types';
import { useApp } from '@/hooks/use-app';
import { Heading } from '@/components/scheme-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
const steps = [
  'Business basics',
  'Business details',
  'Financial information',
  'Registrations',
  'Your objectives',
  'Export & expansion',
];
const stepFields: (keyof Profile)[][] = [
  ['businessName', 'businessType'],
  ['industry', 'activity', 'state', 'district', 'city', 'stage'],
  ['turnover', 'investment', 'revenue', 'employees'],
  ['registrations'],
  ['objectives'],
  ['exportMarkets', 'expansionLocation'],
];
export function ProfileWizard() {
  const { data, act, busy, notice } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(data.profile.step ?? 0);
  const [matching, setMatching] = useState(false);
  const form = useForm<Profile>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      businessName: '',
      businessType: '',
      industry: '',
      subIndustry: '',
      activity: '',
      state: '',
      district: '',
      city: '',
      stage: '',
      registrations: [],
      objectives: [],
      exporting: false,
      exportMarkets: '',
      planningExport: false,
      planningExpansion: false,
      expansionLocation: '',
      step: 0,
      confirmed: false,
      ...data.profile,
    },
  });
  const {
    register,
    watch,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = form;
  async function save(next = step) {
    const values = getValues();
    for (const key of [
      'turnover',
      'investment',
      'revenue',
      'employees',
    ] as const) {
      if (!Number.isFinite(values[key]))
        delete (values as Partial<Profile>)[key];
    }
    await act('profile', {
      profile: { ...values, step: next, confirmed: false },
    });
    notice('Your progress is saved.');
  }
  function field(
    name: keyof Profile,
    label: string,
    options?: string[],
    numeric = false,
  ) {
    return (
      <label className="field" key={name}>
        {label}
        {options ? (
          <select {...register(name)}>
            <option value="">Select {label.toLowerCase()}</option>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : (
          <Input
            {...register(name, { valueAsNumber: numeric })}
            type={numeric ? 'number' : 'text'}
            min={numeric ? 0 : undefined}
            step={numeric ? (name === 'employees' ? 1 : '0.01') : undefined}
            aria-invalid={!!errors[name]}
          />
        )}
        {errors[name] && (
          <span className="field-error" role="alert">
            {String(errors[name]?.message)}
          </span>
        )}
      </label>
    );
  }
  if (matching)
    return (
      <div className="empty-state">
        <Workflow matching />
        <h2>Finding schemes relevant to your business…</h2>
        <p>Comparing your profile with the recorded eligibility rules.</p>
      </div>
    );
  return (
    <>
      <Heading
        eyebrow="YOUR BUSINESS, AT THE CENTRE"
        title={
          step === 6
            ? 'Review your business profile'
            : 'Tell us about your business'
        }
        description="A few details help us find the opportunities that make sense for you."
      />
      <div className="wizard-layout">
        <aside className="wizard-steps">
          {steps.map((name, i) => (
            <button
              key={name}
              onClick={() => {
                if (i <= step) setStep(i);
              }}
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
              className={i === step ? 'current' : i < step ? 'completed' : ''}
            >
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              <div>
                <small>STEP {i + 1}</small>
                <strong>{name}</strong>
              </div>
            </button>
          ))}
          <p>
            <Save size={16} />
            Save your progress and return whenever you’re ready.
          </p>
        </aside>
        <section className="panel wizard-panel">
          {step < 6 ? (
            <>
              <div className="wizard-title">
                <span className="icon-box">
                  <Building2 />
                </span>
                <div>
                  <small>Step {step + 1} of 6</small>
                  <h2>{steps[step]}</h2>
                </div>
              </div>
              <div className="progress-track">
                <i style={{ width: ((step + 1) / 6) * 100 + '%' }} />
              </div>
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="form-grid">
                  {step === 0 && (
                    <>
                      {field('businessName', 'Business name')}
                      {field('businessType', 'Business type', businessTypes)}
                    </>
                  )}
                  {step === 1 && (
                    <>
                      {field('industry', 'Industry', data.taxonomy.industries)}
                      {field('subIndustry', 'Sub-industry (optional)')}
                      {field('activity', 'Business activity')}
                      {field(
                        'state',
                        'State / union territory',
                        data.taxonomy.states,
                      )}
                      {field('district', 'District')}
                      {field('city', 'City')}
                      {field('stage', 'Business stage', stages)}
                    </>
                  )}
                  {step === 2 && (
                    <>
                      {field(
                        'turnover',
                        'Annual turnover (INR)',
                        undefined,
                        true,
                      )}
                      {field(
                        'investment',
                        'Investment in equipment (INR)',
                        undefined,
                        true,
                      )}
                      {field(
                        'revenue',
                        'Annual revenue (INR)',
                        undefined,
                        true,
                      )}
                      {field('employees', 'Employee count', undefined, true)}
                      <p className="form-hint">
                        Enter full rupee amounts, for example 2500000 for INR 25
                        lakh. Use figures from the same financial year.
                      </p>
                    </>
                  )}
                  {step === 3 && (
                    <div className="selection-grid">
                      {registrations.map((r) => (
                        <label key={r} className="check-tile">
                          <input
                            type="checkbox"
                            value={r}
                            {...register('registrations')}
                          />
                          {r}
                        </label>
                      ))}
                    </div>
                  )}
                  {step === 4 && (
                    <>
                      <p className="form-hint">
                        What would you like support with? Select one or more
                        business objectives below.
                      </p>
                      <div className="selection-grid">
                        {data.taxonomy.categories.map((o) => (
                          <label key={o} className="check-tile">
                            <input
                              type="checkbox"
                              value={o}
                              {...register('objectives')}
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                      {errors.objectives && (
                        <p className="field-error">
                          {errors.objectives.message}
                        </p>
                      )}
                      <label className="field">
                        Is the business women-owned?
                        <select
                          value={
                            watch('womenOwned') === undefined
                              ? 'unknown'
                              : String(watch('womenOwned'))
                          }
                          onChange={(e) =>
                            setValue(
                              'womenOwned',
                              e.target.value === 'unknown'
                                ? undefined
                                : e.target.value === 'true',
                            )
                          }
                        >
                          <option value="unknown">
                            Not specified / needs verification
                          </option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </label>
                    </>
                  )}
                  {step === 5 && (
                    <>
                      {[
                        ['exporting', 'Currently exporting?'],
                        ['planningExport', 'Planning to export?'],
                        ['planningExpansion', 'Planning expansion?'],
                      ].map(([n, label]) => (
                        <label className="check-tile" key={n}>
                          <input
                            type="checkbox"
                            {...register(n as keyof Profile)}
                          />
                          {label}
                        </label>
                      ))}
                      {watch('exporting') &&
                        field('exportMarkets', 'Current export markets')}
                      {watch('planningExpansion') &&
                        field(
                          'expansionLocation',
                          'Planned expansion location',
                        )}
                    </>
                  )}
                </div>
                <div className="wizard-actions">
                  <Button
                    variant="outline"
                    className="app-button"
                    disabled={!step || busy}
                    onClick={() => setStep(step - 1)}
                  >
                    <ArrowLeft size={16} />
                    Back
                  </Button>
                  <div className="actions">
                    <Button
                      variant="outline"
                      className="app-button"
                      disabled={busy}
                      onClick={() => save().catch(() => {})}
                    >
                      <Save size={16} />
                      Save progress
                    </Button>
                    <Button
                      className="app-button"
                      disabled={busy}
                      onClick={async () => {
                        if (await trigger(stepFields[step])) {
                          try {
                            await save(step + 1);
                            setStep(step + 1);
                          } catch {}
                        }
                      }}
                    >
                      Continue <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2>Looking good. Check your details.</h2>
              <p>Accurate information makes recommendations more useful.</p>
              <ProfileSummary profile={getValues()} />
              <div className="notice">
                A match is an indication of relevance. Only the administering
                authority can confirm final eligibility.
              </div>
              <div className="wizard-actions">
                <Button
                  variant="outline"
                  className="app-button"
                  onClick={() => setStep(0)}
                >
                  Edit Profile
                </Button>
                <Button
                  disabled={busy}
                  className="app-button"
                  onClick={form.handleSubmit(
                    async (values) => {
                      try {
                        await act('profile', {
                          profile: { ...values, confirmed: true, step: 6 },
                        });
                        setMatching(true);
                        router.push('/schemes?matched=true');
                      } catch {}
                    },
                    () => {
                      notice('Please check the highlighted profile fields.');
                      setStep(0);
                    },
                  )}
                >
                  Find Relevant Schemes <ArrowRight size={16} />
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
