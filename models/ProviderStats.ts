import mongoose, { Schema, Document, Model } from 'mongoose';
import type { IProviderStats, IFailedJob } from '@/types';

export interface IProviderStatsDocument extends Omit<IProviderStats, '_id'>, Document { }


const FiledJobsSchema = new Schema<IFailedJob>(
    {
        initIndex: { type: Number, required: true },
        endIndex: { type: Number, required: true },
    },
    { _id: true }
);

const ProviderStatsSchema = new Schema<IProviderStatsDocument>(
    {
        source: {
            type: String,
            enum: ['enchor', 'rhythmverse'],
            required: true,
            unique: true,
            index: true,
        },
        totalFetched: { type: Number, default: 0 },
        totalAvailable: { type: Number, default: 0 },
        failedJobs: [FiledJobsSchema],
    },
    {
        timestamps: true
    }
);

const ProviderStats: Model<IProviderStatsDocument> =
    mongoose.models.ProviderStats || mongoose.model<IProviderStatsDocument>('ProviderStats', ProviderStatsSchema);

export default ProviderStats;
