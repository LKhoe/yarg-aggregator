import mongoose, { Schema, Document, Model } from 'mongoose';
import type { IMusic } from '@/types';

export interface IMusicDocument extends Omit<IMusic, '_id'>, Document { }

const MusicSchema = new Schema<IMusicDocument>(
  {
    name: { type: String, required: true, index: true },
    artist: { type: String, required: true, index: true },
    album: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    downloadUrl: { type: String, required: true },
    source: {
      type: String,
      enum: ['enchor', 'rhythmverse'],
      required: true,
      index: true
    },
    sourceUpdatedAt: { type: Date, index: true },
    instruments: {
      drums: { type: Number, min: 0, max: 7 },
      bass: { type: Number, min: 0, max: 7 },
      guitar: { type: Number, min: 0, max: 7 },
      prokeys: { type: Number, min: 0, max: 7 },
      vocals: { type: Number, min: 0, max: 7 },
    },
    genre: { type: String, index: true },
    year: { type: Number },
    charter: { type: String },
    rawData: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient searching
MusicSchema.index({ name: 'text', artist: 'text', album: 'text' });

// Index on instruments for filtering
MusicSchema.index({ instruments: 1 });

// Unique constraint to avoid duplicates - includes instruments to allow same song with different configs
MusicSchema.index({ name: 1, artist: 1, source: 1, instruments: 1 }, { unique: true });

const Music: Model<IMusicDocument> =
  mongoose.models.Music || mongoose.model<IMusicDocument>('Music', MusicSchema);

export default Music;
