import { NextRequest, NextResponse } from 'next/server';
import { fetchEnchor, fetchRhythmverse } from '@/services/providers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, page = 1 } = body;

    if (!['enchor', 'rhythmverse'].includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be enchor or rhythmverse' },
        { status: 400 }
      );
    }

    const providerMap = {
      enchor: fetchEnchor,
      rhythmverse: fetchRhythmverse,
    };

    const fetcher = providerMap[source as keyof typeof providerMap];

    console.log(`Testing ${source} provider, page ${page}`);
    const data = await fetcher(page);

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Error testing provider:', error);
    return NextResponse.json(
      { error: 'Failed to test provider', details: String(error) },
      { status: 500 }
    );
  }
}
