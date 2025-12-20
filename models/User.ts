import mongoose, { Schema, Document, Model } from 'mongoose';
import type { IUser, ICollection } from '@/types';

export interface IUserDocument extends Omit<IUser, '_id'>, Document { }

const CollectionSchema = new Schema<ICollection>(
  {
    name: { type: String, required: true },
    musicIds: [{ type: Schema.Types.ObjectId, ref: 'Music' }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const UserSchema = new Schema<IUserDocument>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    deviceName: { type: String, required: true },
    collections: [CollectionSchema],
  },
  {
    timestamps: true,
  }
);

const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

export default User;
