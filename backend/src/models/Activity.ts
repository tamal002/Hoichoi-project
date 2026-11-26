import { Schema, model, type InferSchemaType } from 'mongoose'

const activitySchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    text: { type: String, required: true },
    time: { type: String, required: true, index: true },
    user: { type: String, required: true, default: 'Surajit' },
  },
  {
    versionKey: false,
  }
)

export type ActivityDocument = InferSchemaType<typeof activitySchema>
export const ActivityModel = model('Activity', activitySchema)
