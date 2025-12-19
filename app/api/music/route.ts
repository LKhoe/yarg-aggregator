import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Music from '@/models/Music';
import type { SearchParams, PaginatedResponse, IMusic } from '@/types';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    
    const params: SearchParams = {
      query: searchParams.get('query') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: Math.min(parseInt(searchParams.get('limit') || '20', 10), 100),
      sortBy: (searchParams.get('sortBy') as SearchParams['sortBy']) || 'name',
      sortOrder: (searchParams.get('sortOrder') as SearchParams['sortOrder']) || 'asc',
      genre: searchParams.get('genre') || undefined,
      instrument: searchParams.get('instrument') || undefined,
      minDifficulty: searchParams.get('minDifficulty') 
        ? parseInt(searchParams.get('minDifficulty')!, 10) 
        : undefined,
      maxDifficulty: searchParams.get('maxDifficulty') 
        ? parseInt(searchParams.get('maxDifficulty')!, 10) 
        : undefined,
      source: (searchParams.get('source') as SearchParams['source']) || undefined,
    };

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (params.query) {
      query.$or = [
        { name: { $regex: params.query, $options: 'i' } },
        { artist: { $regex: params.query, $options: 'i' } },
        { album: { $regex: params.query, $options: 'i' } },
      ];
    }

    if (params.genre) {
      query.genre = { $regex: params.genre, $options: 'i' };
    }

    if (params.source) {
      query.source = params.source;
    }

    // Filter by instrument difficulty
    if (params.instrument && (params.minDifficulty !== undefined || params.maxDifficulty !== undefined)) {
      const diffQuery: Record<string, number> = {};
      if (params.minDifficulty !== undefined) {
        diffQuery.$gte = params.minDifficulty;
      }
      if (params.maxDifficulty !== undefined) {
        diffQuery.$lte = params.maxDifficulty;
      }
      query[`instruments.${params.instrument}`] = diffQuery;
    }

    // Build sort
    const sortField = params.sortBy || 'name';
    const sortDir = params.sortOrder === 'desc' ? -1 : 1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDir as 1 | -1 };

    // Execute query with pagination
    const skip = ((params.page || 1) - 1) * (params.limit || 20);
    const limit = params.limit || 20;

    const [data, total] = await Promise.all([
      Music.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Music.countDocuments(query),
    ]);

    const response: PaginatedResponse<IMusic> = {
      data: data as unknown as IMusic[],
      total,
      page: params.page || 1,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching music:', error);
    return NextResponse.json(
      { error: 'Failed to fetch music' },
      { status: 500 }
    );
  }
}
