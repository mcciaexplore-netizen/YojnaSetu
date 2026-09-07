import { SchemeDetail } from '@/components/features/scheme-detail';
import { catalogue } from '@/services/repository';
import { NextRequest, NextResponse } from 'next/server';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const s = (
      await catalogue(
        new NextRequest(
          process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        ),
        NextResponse.json({}),
      )
    ).find((s) => s.id === id);
    return {
      title: (s?.name ?? 'Scheme not found') + ' | YojanaSetu',
      description: s?.description ?? 'This record is not available.',
      openGraph: {
        title: s?.name ?? 'Scheme not found',
        description: s?.description ?? '',
        images: [],
      },
      twitter: {
        title: s?.name ?? 'Scheme not found',
        description: s?.description ?? '',
        images: [],
      },
    };
  } catch {
    return {
      title: 'Scheme | YojanaSetu',
      openGraph: { images: [] },
      twitter: { images: [] },
    };
  }
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SchemeDetail id={(await params).id} />;
}
