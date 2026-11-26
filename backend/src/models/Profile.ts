import { Schema, model, type InferSchemaType } from 'mongoose'

const profileSchema = new Schema(
  {
    user: { type: String, required: true, unique: true, index: true },
    image: { type: String, required: true },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

export type ProfileDocument = InferSchemaType<typeof profileSchema>
export const ProfileModel = model('Profile', profileSchema)
