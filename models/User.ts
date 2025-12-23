import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import type { IUser, ISavedSong } from '@/types';

export interface IUserDocument extends Omit<IUser, '_id' | 'savedSongs'>, Document {
  savedSongs: (ISavedSong & { _id: Types.ObjectId })[];
}

const SavedSongSchema = new Schema<ISavedSong>(
  {
    musicId: { 
      type: Schema.Types.Mixed, 
      required: true, 
      ref: 'Music' 
    },
    name: { type: String, required: true },
    artist: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const UserSchema = new Schema<IUserDocument>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    deviceName: { type: String, required: true },
    savedSongs: [SavedSongSchema],
  },
  {
    timestamps: true,
  }
);

const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

export default User;
