import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../app';
import { Order, Batch, Agent, IOrder, IBatch, IAgent } from '../models';

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

describe('Order API Test', () => {
  it('should create a new order via API', async () => {
    const orderData: Partial<IOrder> = {
      intentId: 123456,
      srcToken: 'SOL',
      srcAddress: '3y3d5QzGr5oUjBrkXQ8A2P2uBBsTzQzFq57hHbJfbGbJ',
      srcAmount: 10000000000,
      dstToken: 'USDC',
      dstAddress: '8FgRq4Ck7R8XB5j6GZGvGLzziU7tH2dTdeUmNMQd9FQa',
      minReceived: 950,
      expiration: 1714000000,
    };

    const response = await request(app)
      .post('/api/orders')
      .send(orderData)
      .expect(201);

    expect(response.body.intentId).toBe(orderData.intentId);
    expect(response.body.srcToken).toBe(orderData.srcToken);
    expect(response.body.srcAddress).toBe(orderData.srcAddress);
    expect(response.body.srcAmount).toBe(orderData.srcAmount);
    expect(response.body.dstToken).toBe(orderData.dstToken);
    expect(response.body.dstAddress).toBe(orderData.dstAddress);
    expect(response.body.minReceived).toBe(orderData.minReceived);
    expect(response.body.expiration).toBe(orderData.expiration);
    expect(response.body.status).toBe("open");
    expect(response.body.batchId).toBeUndefined();
  });
});
