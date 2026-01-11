import mongoose, { Schema, Document, Model } from 'mongoose';
import type { IProvider } from '@/types';

export interface IProviderDocument extends Omit<IProvider, '_id'>, Document { }

const ProviderSchema = new Schema<IProviderDocument>(
  {
    name: {
      type: String,
      enum: ['enchor', 'rhythmverse'],
      required: true,
      unique: true,
      index: true,
    },
    lastSuccessfulFetch: { type: Date },
  },
  {
    timestamps: true
  }
);

const Provider: Model<IProviderDocument> =
  mongoose.models.Provider || mongoose.model<IProviderDocument>('Provider', ProviderSchema);

export default Provider;
