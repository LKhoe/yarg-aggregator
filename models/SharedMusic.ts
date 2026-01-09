import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISharedMusic {
  fromDeviceId: string;
  toDeviceId: string;
  songs: {
    musicId: string;
    name: string;
    artist: string;
  }[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  viewedAt?: Date;
}

export interface ISharedMusicDocument extends ISharedMusic, Document { }

const SharedMusicSchema = new Schema<ISharedMusicDocument>(
  {
    fromDeviceId: { type: String, required: true, index: true },
    toDeviceId: { type: String, required: true, index: true },
    songs: [
      {
        musicId: { type: String, required: true },
        name: { type: String, required: true },
        artist: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true,
    },
    viewedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
SharedMusicSchema.index({ toDeviceId: 1, status: 1, createdAt: -1 });

const SharedMusic: Model<ISharedMusicDocument> =
  mongoose.models.SharedMusic || mongoose.model<ISharedMusicDocument>('SharedMusic', SharedMusicSchema);

export default SharedMusic;
