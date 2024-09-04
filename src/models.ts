import mongoose, { Schema, Document, Model } from 'mongoose';
const AutoIncrement = require('mongoose-sequence')(mongoose);

// Define interfaces
export interface IRouteStep extends Document {
  srcName: string;
  srcAddress: string;
  srcImage: string;
  sentToken: string;
  sentAmount: number;
  dstName: string;
  dstAddress: string;
  dstImage: string;
}

export interface IFillData extends Document {
  tx: string;
  agentName: string;
  route: IRouteStep[];
}

export interface IOrder extends Document {
  intentId: number;
  srcToken: string;
  srcAddress: string;
  srcAmount: number;
  dstToken: string;
  dstAddress: string;
  minReceived: number;
  expiration: number;
  status: string;
  batch: mongoose.Types.ObjectId | null;
}

export interface ISolution extends Document {
  agent: mongoose.Types.ObjectId;
  route: IRouteStep[];
  surplus: number;
  score: number;
  batchId: number;
  agentName?: string; // Virtual
}

export interface IBatch extends Document {
  batchId: number;
  orders: IOrder[];
  status: string;
  fillData: IFillData | null;
}

export interface IAgent extends Document {
  name: string;
  image: string;
}

// Define schemas
const RouteStepSchema: Schema = new Schema({
  srcName: { type: String, required: true },
  srcAddress: { type: String, required: true },
  srcImage: { type: String, required: true },
  sentToken: { type: String, required: true },
  sentAmount: { type: Number, required: true },
  dstName: { type: String, required: true },
  dstAddress: { type: String, required: true },
  dstImage: { type: String, required: true }
}, {
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.id;
    }
  }
});

const FillDataSchema: Schema = new Schema({
  tx: { type: String, required: true },
  agentName: { type: String, required: true },
  route: { type: [RouteStepSchema], required: true }
}, {
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.id;
    }
  }
});

const OrderSchema: Schema = new Schema({
  intentId: { type: Number, required: true },
  srcToken: { type: String, required: true },
  srcAddress: { type: String, required: true },
  srcAmount: { type: Number, required: true },
  dstToken: { type: String, required: true },
  dstAddress: { type: String, required: true },
  minReceived: { type: Number, required: true },
  expiration: { type: Number, required: true },
  status: { type: String, required: true },
  batch: { type: Schema.Types.ObjectId, ref: 'Batch', default: null }
}, {
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.id;
      delete ret.batch;
    }
  }
});

const SolutionSchema: Schema<ISolution> = new Schema({
  agent: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  route: { type: [RouteStepSchema], required: true },
  score: { type: Number, required: true },
  batchId: { type: Number, required: true }
}, {
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.id;
    }
  }
});

const BatchSchema: Schema = new Schema({
  orders: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
  status: { type: String, required: true },
  fillData: { type: FillDataSchema, default: null }
}, {
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.id;
    }
  }
});
BatchSchema.plugin(AutoIncrement, { inc_field: 'batchId' });

const AgentSchema: Schema = new Schema({
  name: { type: String, required: true },
  image: { type: String, required: true }
}, {
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.id;
    }
  }
});

// Define models
export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
export const Batch: Model<IBatch> = mongoose.models.Batch || mongoose.model<IBatch>('Batch', BatchSchema);
export const Agent: Model<IAgent> = mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);
export const Solution: Model<ISolution> = mongoose.models.Solution || mongoose.model<ISolution>('Solution', SolutionSchema);
export const FillData: Model<IFillData> = mongoose.models.FillData || mongoose.model<IFillData>('FillData', FillDataSchema);
