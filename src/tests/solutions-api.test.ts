import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../app';
import { Order, Batch, Agent, IOrder, IBatch, IAgent, ISolution, IRouteStep } from '../models';
import { ObjectId } from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Solution API Test', () => {
  let agent: IAgent;
  let batch: IBatch;

  beforeEach(async () => {
    // Prepopulate agents
    agent = new Agent({ name: 'Agent Smith', image: 'https://example.com/agent-smith.jpg' });
    await agent.save();

    // Create a batch
    const order = new Order({
      intentId: 123456,
      srcToken: 'SOL',
      srcAddress: '3y3d5QzGr5oUjBrkXQ8A2P2uBBsTzQzFq57hHbJfbGbJ',
      srcAmount: 10000000000,
      dstToken: 'USDC',
      dstAddress: '8FgRq4Ck7R8XB5j6GZGvGLzziU7tH2dTdeUmNMQd9FQa',
      minReceived: 950,
      expiration: 1714000000,
      status: 'open',
      batch: null,
    });

    await order.save();

    batch = new Batch({
        batchId: 1,
        orders: [order._id],
        status: 'open',
        fillData: null,
    });
    await batch.save();

    // Update order to reference the new batch
    order.batch = batch._id as any;
    await order.save();
  });

  it('should create a new solution via API', async () => {
    const solutionData: Partial<ISolution> = {
      agentName: agent.name,
      route: [
        {
          srcName: 'Source Venue',
          srcAddress: 'srcAddress1',
          srcImage: 'https://example.com/srcImage1.jpg',
          sentToken: 'SOL',
          sentAmount: 10000000000,
          dstName: 'Destination Venue',
          dstAddress: 'dstAddress1',
          dstImage: 'https://example.com/dstImage1.jpg',
        } as IRouteStep
      ],
      score: 95,
      batchId: batch.batchId,
    };

    const response = await request(app)
      .post('/api/solutions')
      .send(solutionData)
      .expect(201);

    expect(response.body.route.length).toBe(1);
    expect(response.body.score).toBe(solutionData.score);
    expect(response.body.batchId).toBe(batch.batchId);
  });

  it('should not create a solution for a filled batch', async () => {
    // Fill the batch
    batch.status = 'filled';
    await batch.save();

    const solutionData: Partial<ISolution> = {
      agentName: agent.name,
      route: [
        {
          srcName: 'Source Venue',
          srcAddress: 'srcAddress1',
          srcImage: 'https://example.com/srcImage1.jpg',
          sentToken: 'SOL',
          sentAmount: 10000000000,
          dstName: 'Destination Venue',
          dstAddress: 'dstAddress1',
          dstImage: 'https://example.com/dstImage1.jpg',
        } as IRouteStep
      ],
      score: 95,
      batchId: batch.batchId,
    };

    const response = await request(app)
      .post('/api/solutions')
      .send(solutionData)
      .expect(400);

    expect(response.body.error).toBe('Cannot add solution to a filled batch');
  });

  it('should not create a solution with an invalid agent', async () => {
    const solutionData: Partial<ISolution> = {
      agentName: 'Nonexistent Agent',
      route: [
        {
          srcName: 'Source Venue',
          srcAddress: 'srcAddress1',
          srcImage: 'https://example.com/srcImage1.jpg',
          sentToken: 'SOL',
          sentAmount: 10000000000,
          dstName: 'Destination Venue',
          dstAddress: 'dstAddress1',
          dstImage: 'https://example.com/dstImage1.jpg',
        } as IRouteStep
      ],
      score: 95,
      batchId: batch.batchId,
    };

    const response = await request(app)
      .post('/api/solutions')
      .send(solutionData)
      .expect(404);

    expect(response.body.error).toBe('Agent not found');
  });
});
