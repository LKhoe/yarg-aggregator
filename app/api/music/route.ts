import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Music from '@/models/Music';
import type { SearchParams, PaginatedResponse, IMusic } from '@/types';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { musicIds } = body;

    if (!musicIds || !Array.isArray(musicIds)) {
      return NextResponse.json(
        { error: 'musicIds must be an array' },
        { status: 400 }
      );
    }

    if (musicIds.length === 0) {
      return NextResponse.json([]);
    }

    // Limit the number of IDs to prevent excessive database queries
    const limitedIds = musicIds.slice(0, 100);
    if (musicIds.length > 100) {
      console.warn(`Batch request limited to 100 items (requested ${musicIds.length})`);
    }

    // Find all music documents by their IDs
    const musicData = await Music.find({ _id: { $in: limitedIds } }).lean();

    return NextResponse.json(musicData);
  } catch (error) {
    console.error('Error fetching batch music:', error);
    return NextResponse.json(
      { error: 'Failed to fetch music data' },
      { status: 500 }
    );
  }
}

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
      savedIds: searchParams.get('savedIds')?.split(',').filter(Boolean) || undefined,
    };

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {};

    if (params.query) {
      // Split query by spaces to allow "fuzzy" matching (matching all terms)
      const terms = params.query.trim().split(/\s+/).filter(Boolean);
      
      if (terms.length > 0) {
        // Create an AND condition for all terms
        const termConditions = terms.map(term => ({
          $or: [
            { name: { $regex: term, $options: 'i' } },
            { artist: { $regex: term, $options: 'i' } },
            { album: { $regex: term, $options: 'i' } },
          ]
        }));
        
        query.$and = termConditions;
      }
    }

    if (params.genre) {
      query.genre = { $regex: params.genre, $options: 'i' };
    }

    if (params.source) {
      query.source = params.source;
    }

    // Filter by saved song IDs
    if (params.savedIds && params.savedIds.length > 0) {
      query._id = { $in: params.savedIds };
    }

    // Filter by multiple instruments (existence)
    const instrumentsParam = searchParams.get('instruments');
    if (instrumentsParam) {
      const selectedInstruments = instrumentsParam.split(',');
      const instrumentConditions = selectedInstruments.map(inst => ({
        [`instruments.${inst}`]: { $exists: true }
      }));

      if (instrumentConditions.length > 0) {
        if (query.$or) {
          // If search query exists, we need to combine with $and
          query.$and = [
            { $or: query.$or },
            { $and: instrumentConditions }
          ];
          delete query.$or;
        } else {
          query.$and = instrumentConditions;
        }
      }
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
