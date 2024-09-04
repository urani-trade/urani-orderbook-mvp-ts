import mongoose from 'mongoose';
import { Order, Batch, Agent, IOrder, IBatch, IAgent } from '../models'
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  } as mongoose.ConnectOptions);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Order Model Test', () => {
  it('should create & save an order successfully', async () => {
    const validOrder: IOrder = new Order({
      intentId: 123456,
      srcToken: 'SOL',
      srcAddress: '3y3d5QzGr5oUjBrkXQ8A2P2uBBsTzQzFq57hHbJfbGbJ',
      srcAmount: 10000000000,
      dstToken: 'USDC',
      dstAddress: '8FgRq4Ck7R8XB5j6GZGvGLzziU7tH2dTdeUmNMQd9FQa',
      minReceived: 950,
      expiration: 1714000000,
      status: 'open',
      batchId: null,
    });

    const savedOrder = await validOrder.save();

    expect(savedOrder._id).toBeDefined();
    expect(savedOrder.intentId).toBe(validOrder.intentId);
    expect(savedOrder.srcToken).toBe(validOrder.srcToken);
    expect(savedOrder.srcAddress).toBe(validOrder.srcAddress);
    expect(savedOrder.srcAmount).toBe(validOrder.srcAmount);
    expect(savedOrder.dstToken).toBe(validOrder.dstToken);
    expect(savedOrder.dstAddress).toBe(validOrder.dstAddress);
    expect(savedOrder.minReceived).toBe(validOrder.minReceived);
    expect(savedOrder.expiration).toBe(validOrder.expiration);
    expect(savedOrder.status).toBe(validOrder.status);
    expect(savedOrder.batch).toBeNull();
  });
});

describe('Batch Model Test', () => {
  it('should create & save a batch successfully', async () => {
    const validAgent: IAgent = new Agent({
      name: 'Agent Smith',
      image: 'https://example.com/agent-smith.jpg',
    });
    await validAgent.save();

    const validOrder: IOrder = new Order({
      intentId: 123456,
      srcToken: 'SOL',
      srcAddress: '3y3d5QzGr5oUjBrkXQ8A2P2uBBsTzQzFq57hHbJfbGbJ',
      srcAmount: 10000000000,
      dstToken: 'USDC',
      dstAddress: '8FgRq4Ck7R8XB5j6GZGvGLzziU7tH2dTdeUmNMQd9FQa',
      minReceived: 950,
      expiration: 1714000000,
      status: 'open',
      batchId: null,
    });
    await validOrder.save();

    const validBatch: IBatch = new Batch({
      batchId: 1,
      orders: [validOrder._id],
      status: 'open',
      fillData: null,
    });

    const savedBatch = await validBatch.save();

    expect(savedBatch._id).toBeDefined();
    expect(savedBatch.batchId).toBe(validBatch.batchId);
    expect(savedBatch.orders).toContain(validOrder._id);
    expect(savedBatch.status).toBe(validBatch.status);
    expect(savedBatch.fillData).toBeNull();
  });
});
