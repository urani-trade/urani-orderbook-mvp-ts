import express from 'express';
import cors from 'cors';
import mongoose, { Document } from 'mongoose';
import routes from './routes';
import config from './config';
import { Order, Batch, Solution, FillData, IRouteStep, IOrder, Agent } from './models';
import crypto from 'crypto';
import {AGENTS, VENUES, USER_VENUE_IMAGE, TOKENS} from './constants'

const app = express();
const port = config.port;
const batchInterval = config.batchInterval;

app.use(express.json());
app.use(cors()); // CORS from any origin
app.use('/api', routes);

async function prepopulateAgents() {
  try {
    for (const agentData of AGENTS) {
      const existingAgent = await Agent.findOne({ name: agentData.name });
      if (!existingAgent) {
        const agent = new Agent(agentData);
        await agent.save();
        console.log(`Added agent: ${agent.name}`);
      }
    }
  } catch (error) {
    console.error('Error prepopulating agents:', error);
  }
}

(async function connectToDatabase() {
  if (['production', 'development'].includes(process.env.NODE_ENV || '')) {
    try {
      await mongoose.connect(config.mongodbUri);
      console.log('Connected to MongoDB');

      if (process.env.NODE_ENV === 'development') {
        await mongoose.connection.dropDatabase();
        console.log('Database dropped and reset in development mode');
      }

      await prepopulateAgents(); // Prepopulate agents after connection and potential reset
    } catch (err) {
      console.error('Failed to connect to MongoDB', err);
    }
  } else {
    // Must be unit test env, which sets up its own db
    console.log('Unit test environment detected, skipping MongoDB connection');
  }
})();


// Function to create a new batch from open orders
async function createNewBatch() {
  try {
    const openOrders = await Order.find({ status: 'open' });

    if (openOrders.length > 0) {
      const newBatch = new Batch({
        orders: openOrders.map(order => order._id),
        status: 'open',
        fillData: null
      });

      await newBatch.save();

      // Update the orders to reference the new batch
      await Order.updateMany(
        { _id: { $in: openOrders.map(order => order._id) } },
        { $set: { batch: newBatch._id } }
      );

      console.log(`Created new batch with ID: ${newBatch.batchId}`);
    }
  } catch (error) {
    console.error('Error creating new batch:', error);
  }
}

// Function to add mock orders
async function addMockOrders() {
  const orderCount = Math.floor(Math.random() * 4) + 1; // Between 1 and 4 orders
  const orders = [];

  if (orderCount >= 2) {
    // Create the first order
    const srcToken1 = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    let dstToken1;
    do {
      dstToken1 = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    } while (dstToken1 === srcToken1); // Ensure srcToken and dstToken are different

    const srcAmount1 = Math.floor(Math.random() * 1000000000) + 1;
    const minReceived1 = Math.floor(Math.random() * srcAmount1);
    const expiration1 = Math.floor(Date.now() / 1000) + 1800;
    const address1 = crypto.randomBytes(20).toString('hex');

    const order1 = new Order({
      intentId: Math.floor(Math.random() * 1000000),
      srcToken: srcToken1,
      srcAddress: address1,
      srcAmount: srcAmount1,
      dstToken: dstToken1,
      dstAddress: address1,
      minReceived: minReceived1,
      expiration: expiration1,
      status: 'open',
      batch: null,
    });

    // Create the second order in the opposite direction with the same tokens
    const srcAmount2 = Math.floor(Math.random() * 1000000000) + 1;
    const minReceived2 = Math.floor(Math.random() * srcAmount2);
    const expiration2 = Math.floor(Date.now() / 1000) + 1800;
    const address2 = crypto.randomBytes(20).toString('hex');

    const order2 = new Order({
      intentId: Math.floor(Math.random() * 1000000),
      srcToken: dstToken1,
      srcAddress: address2,
      srcAmount: srcAmount2,
      dstToken: srcToken1,
      dstAddress: address2,
      minReceived: minReceived2,
      expiration: expiration2,
      status: 'open',
      batch: null,
    });

    orders.push(order1, order2);
  }

  // Create the remaining random orders
  for (let i = orders.length; i < orderCount; i++) {
    const srcToken = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    let dstToken;
    do {
      dstToken = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    } while (dstToken === srcToken); // Ensure srcToken and dstToken are different

    const srcAmount = Math.floor(Math.random() * 1000000000) + 1; // Random amount between 1 and 10000
    const minReceived = Math.floor(Math.random() * srcAmount); // Random minReceived less than srcAmount
    const expiration = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now as a Unix timestamp
    const address = crypto.randomBytes(20).toString('hex'); // Random address

    const order = new Order({
      intentId: Math.floor(Math.random() * 1000000), // Random numeric intentId
      srcToken,
      srcAddress: address,
      srcAmount,
      dstToken,
      dstAddress: address, // Same as srcAddress
      minReceived,
      expiration,
      status: 'open',
      batch: null,
    });

    orders.push(order);
  }

  // Save the orders to the database
  for (const order of orders) {
    await order.save();
    console.log(`Added mock order with ID: ${order.intentId}`);
  }
}

// Function to create a plain IRouteStep object
function createRouteStep(routeStep: {
  srcName: string;
  srcAddress: string;
  srcImage: string;
  sentToken: string;
  sentAmount: number;
  dstName: string;
  dstAddress: string;
  dstImage: string;
}): IRouteStep {
  return {
    srcName: routeStep.srcName,
    srcAddress: routeStep.srcAddress,
    srcImage: routeStep.srcImage,
    sentToken: routeStep.sentToken,
    sentAmount: routeStep.sentAmount,
    dstName: routeStep.dstName,
    dstAddress: routeStep.dstAddress,
    dstImage: routeStep.dstImage,
  } as IRouteStep;
}

// Function to generate a random graph
function generateRandomGraph(orders: IOrder[]): IRouteStep[] {
  const routeSteps: IRouteStep[] = [];

  const userAddressesAsVenues = orders.map((order, i) => {
    return {
      venueName: "User " + i,
      venueAddress: order.srcAddress,
      venueImage: USER_VENUE_IMAGE
    }
  });

  // Pick out (number of orders * (random 1 - 3 venues))
  const randomVenues = VENUES.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * orders.length * 3) + 1);

  // Combine the two lists into one nodes list
  const nodes = [...userAddressesAsVenues, ...randomVenues];

  // Connect nodes in a chain-like structure
  for (let i = 0; i < nodes.length - 1; i++) {
    const sentToken = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    const sentAmount = Math.floor(Math.random() * 10000000000) + 1;

    routeSteps.push(createRouteStep({
      srcName: nodes[i].venueName,
      srcAddress: nodes[i].venueAddress,
      srcImage: nodes[i].venueImage,
      sentToken: sentToken,
      sentAmount: sentAmount,
      dstName: nodes[i + 1].venueName,
      dstAddress: nodes[i + 1].venueAddress,
      dstImage: nodes[i + 1].venueImage
    }));
  }

  // Optionally add a few more random connections
  const additionalConnections = Math.min(2, nodes.length - 1);
  const usedConnections = new Set<string>();

  for (let k = 0; k < additionalConnections; k++) {
    let attempts = 0;

    while (attempts < 10) {
      attempts++;
      const i = Math.floor(Math.random() * nodes.length);
      const j = Math.floor(Math.random() * nodes.length);

      if (i !== j && !usedConnections.has(`${i}-${j}`) && !usedConnections.has(`${j}-${i}`)) {
        usedConnections.add(`${i}-${j}`);

        const sentToken = TOKENS[Math.floor(Math.random() * TOKENS.length)];
        const sentAmount = Math.floor(Math.random() * 1000) + 1;

        routeSteps.push(createRouteStep({
          srcName: nodes[i].venueName,
          srcAddress: nodes[i].venueAddress,
          srcImage: nodes[i].venueImage,
          sentToken: sentToken,
          sentAmount: sentAmount,
          dstName: nodes[j].venueName,
          dstAddress: nodes[j].venueAddress,
          dstImage: nodes[j].venueImage
        }));

        break;
      }
    }
  }

  return routeSteps;
}

// Function to add mock solutions and fill data
async function addMockSolutionsAndFillData() {
  try {
    const latestBatch = await Batch.findOne().sort({ batchId: -1 }).populate('orders').exec();
    if (latestBatch && latestBatch.status === 'open') {
      const agents = await Agent.find();
      const selectedAgents = agents.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * agents.length) + 1);

      for (const agent of selectedAgents) {
        const orders = latestBatch.orders.map(order => order.toObject()) as IOrder[];
        const routeSteps = generateRandomGraph(orders);
        const solution = new Solution({
          agent: agent._id,
          route: routeSteps,
          score: Math.floor(Math.random() * 101), // Random score between 0 and 100
          batchId: latestBatch.batchId
        });
        await solution.save();
      }

      // Find the solution with the highest score
      const solutions = await Solution.find({ batchId: latestBatch.batchId });
      const topSolution = solutions.reduce((prev, current) => (prev.score > current.score ? prev : current));
      const agent = await Agent.findById(topSolution.agent);

      const fillData = new FillData({
        tx: 'mocktx123',
        agentName: agent?.name || 'Unknown Agent', // Ensure agentName is set correctly
        route: topSolution.route,
      });
      latestBatch.fillData = fillData;

      latestBatch.status = 'filled';
      await latestBatch.save();

      // Set the orders to filled
      await Order.updateMany(
        { _id: { $in: latestBatch.orders.map(order => order._id) } },
        { $set: { status: 'filled' } }
      );

      console.log(`Updated batch ${latestBatch.batchId} with solutions and fill data`);
    }
  } catch (error) {
    console.error('Error adding mock solutions and fill data:', error);
  }
}

// Mock data
setInterval(addMockOrders, batchInterval);

setTimeout(() => {
  setInterval(createNewBatch, batchInterval);
}, batchInterval / 2);

setTimeout(() => {
  setInterval(addMockSolutionsAndFillData, batchInterval);
}, 3 * batchInterval / 4);

// Start the server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app;
