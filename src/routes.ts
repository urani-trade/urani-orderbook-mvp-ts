import { Router } from 'express';
import { Order, Batch, Agent, Solution, IFillData } from './models';
import { getTransaction, getTokenMetadata, getMultipleTokenMetadata } from './solscan';
import crypto from 'crypto';
import { USER_VENUE_IMAGE } from './constants';

const router = Router();

/**
 * Create a new order
 */
router.post('/orders', async (req, res) => {
  try {
    req.body.status = "open";
    const order = new Order(req.body);
    await order.save();
    await mockDemoBatch(order);

    res.status(201).send(order);

  } catch (error) {
    console.error('Error:', error);
    res.status(400).send(error);
  }
});

/**
 * Get all orders with pagination and optional srcAddress filter
 */
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page?.toString() || '1', 10);
    const limit = parseInt(req.query.limit?.toString() || '100', 100);
    const skip = (page - 1) * limit;
    const srcAddress = req.query.srcAddress?.toString();

    const query: any = {};
    if (srcAddress) {
      query.srcAddress = { $regex: new RegExp(srcAddress, "i") };
    }

    let orders = await Order.find(query).skip(skip).limit(limit);

    
    // Add batchId to orders
    orders = await Promise.all(
      orders.map(async order => {
        const batch = await Batch.findById(order.batch);
        return {
          ...order.toJSON(),
          batchId: batch ? batch.batchId : null,
        };
      })
    );

    res.status(200).send(orders);
  } catch (error) {
    res.status(500).send(error);
  }
});

/**
 * Get an order by ID
 */
router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('batch');
    if (!order) {
      return res.status(404).send({ error: 'Order not found' });
    }
    const batch = await Batch.findOne({ batchId: order.batch });
    const orderWithBatchId = {
      ...order.toJSON(),
      batchId: batch ? batch.batchId : null
    };
    res.status(200).send(orderWithBatchId);
  } catch (error) {
    res.status(500).send(error);
  }
});

/**
 * Get batches with optional filtering by startBatchId, endBatchId, and status
 */
router.get('/batches', async (req, res) => {
  try {
    const startBatchId = req.query.startBatchId ? parseInt(req.query.startBatchId.toString()) : null;
    const endBatchId = req.query.endBatchId ? parseInt(req.query.endBatchId.toString()) : null;
    const status = req.query.status?.toString();

    if ((startBatchId && isNaN(startBatchId)) || (endBatchId && isNaN(endBatchId))) {
      return res.status(400).send({ error: 'startBatchId and endBatchId must be valid integers' });
    }

    const query: any = {};
    if (startBatchId !== null) {
      query.batchId = { $gte: startBatchId };
    }
    if (endBatchId !== null) {
      query.batchId = { ...query.batchId, $lte: endBatchId };
    }
    if (status) {
      query.status = status;
    }

    const batches = await Batch.find(query)
      .populate('orders')
      .sort({ batchId: -1 })
      .limit(10);  // Limit to 10 most recent by default if no range is provided

    const batchIds = batches.map(batch => batch.batchId);
    const solutions = await Solution.find({ batchId: { $in: batchIds } }).populate('agent');

    const batchesWithSolutions = await Promise.all(batches.map(async batch => {
      let batchSolutions = solutions.filter(solution => solution.batchId === batch.batchId);
      batchSolutions = batchSolutions.map(solution => {
        solution = solution.toJSON();
        delete (solution as any).batchId;
        return solution;
      });
      let resp = {
        ...batch.toJSON(),
        solutions: batchSolutions,
      };

      // Get all token addresses
      const tokenAddresses = Array.from(new Set([
        ...resp.orders.map((order: any) => order.srcToken),
        ...resp.orders.map((order: any) => order.dstToken),
        ...resp.solutions.map((solution: any) => solution.route.map((step: any) => step.sentToken)).flat(),
      ]));

      // Make a mapping from token address to token metadata
      let tokenMetadata = await getMultipleTokenMetadata(tokenAddresses);
      tokenMetadata = tokenMetadata.reduce((acc, metadata) => {
        acc[metadata.address] = metadata;
        return acc;
      }, {});

      return {
        ...resp,
        tokenMetadata,
      };
    }));

    res.status(200).send(batchesWithSolutions);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(error);
  }
});


/**
 * Get a batch by batchId
 */
router.get('/batches/:batchId', async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: parseInt(req.params.batchId) })
      .populate('orders');
    if (!batch) {
      return res.status(404).send({ error: 'Batch not found' });
    }
    let solutions = await Solution.find({ batchId: batch.batchId }).populate('agent');
    solutions = solutions.map(solution => {
      solution = solution.toJSON();
      delete (solution as any).batchId;
      return solution;
    });
    const resp = {
      ...batch.toJSON(),
      solutions: solutions
    };

    // Get all token addresses
    const tokenAddresses = Array.from(new Set([
      ...resp.orders.map(order => order.srcToken),
      ...resp.orders.map(order => order.dstToken),
      ...resp.solutions.map(solution => solution.route.map(step => step.sentToken)).flat(),
    ]));

    // Make a mapping from token address to token metadata
    let tokenMetadata = await getMultipleTokenMetadata(tokenAddresses);
    tokenMetadata = tokenMetadata.reduce((acc, metadata) => {
      acc[metadata.address] = metadata;
      return acc;
    }, {});

    res.status(200).send({
      ...resp,
      tokenMetadata,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(error);
  }
});

/**
 * Create a new solution
 */
router.post('/solutions', async (req, res) => {
  try {
    const { agentName, route, score, batchId } = req.body;

    // Ensure the batch exists and is not filled
    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res.status(404).send({ error: 'Batch not found' });
    }
    if (batch.status === 'filled') {
      return res.status(400).send({ error: 'Cannot add solution to a filled batch' });
    }

    // Lookup agent by agentName
    const agent = await Agent.findOne({ name: agentName });
    if (!agent) {
      return res.status(404).send({ error: 'Agent not found' });
    }

    const solution = new Solution({
      agent: agent._id,
      route,
      score,
      batchId
    });
    await solution.save();
    res.status(201).send(solution);
  } catch (error) {
    res.status(400).send(error);
  }
});

export default router;



async function mockDemoBatch(order: any) {
  // make a mock order in the opposite direction double the size
  const srcAddress = crypto.randomBytes(20).toString('hex');
  const oppositeOrder = new Order({
    intentId: 2,
    srcAddress: srcAddress,
    dstAddress: srcAddress,
    srcToken: order.dstToken,
    dstToken: order.srcToken,
    srcAmount: Math.floor(order.minReceived * 2.02),
    minReceived: Math.floor(order.srcAmount * 2.02),
    expiration: Date.now() + 1000 * 60 * 60 * 24,
    status: "open"
  });
  await oppositeOrder.save();

  // mock a batch and fill
  const batch = new Batch({
    orders: [order._id, oppositeOrder._id],
    status: 'open',
    fillData: null
  });
  await batch.save();

  function convertDecimalAmountToU64(amount: number, decimals: number): number {
    return Math.floor(amount * Math.pow(10, decimals));
  }

  let betAgent = await Agent.findOne({ name: 'Bet' });
  let alephAgent = await Agent.findOne({ name: 'Aleph' });

  // mock aleph solution
  const alephSolution = new Solution({
    agent: alephAgent?._id,
    route: [
      // fill user 2 with jupiter
      {
        srcName: "User 2",
        srcAddress: oppositeOrder.srcAddress,
        srcImage: USER_VENUE_IMAGE,
        sentToken: oppositeOrder.srcToken,
        sentAmount: Math.floor(oppositeOrder.srcAmount),
        dstName: "Jupiter",
        dstAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        dstImage: "https://statics.solscan.io/ex-img/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4.svg"
      },
      {
        srcName: "Jupiter",
        srcAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        srcImage: "https://statics.solscan.io/ex-img/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4.svg",
        sentToken: oppositeOrder.srcToken,
        sentAmount: Math.floor(oppositeOrder.srcAmount),
        dstName: "Raydium",
        dstAddress: "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h",
        dstImage: "https://statics.solscan.io/ex-img/CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK.png",
      },
      {
        srcName: "Raydium",
        srcAddress: "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h",
        srcImage: "https://statics.solscan.io/ex-img/CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK.png",
        sentToken: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
        sentAmount: convertDecimalAmountToU64(403.34, 6),
        dstName: "Orca",
        dstAddress: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
        dstImage: "https://statics.solscan.io/ex-img/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc.svg",
      },
      {
        srcName: "Orca",
        srcAddress: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
        srcImage: "https://statics.solscan.io/ex-img/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc.svg",
        sentToken: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDC
        sentAmount: convertDecimalAmountToU64(401.11, 6),
        dstName: "Meteora",
        dstAddress: "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
        dstImage: "https://statics.solscan.io/ex-img/Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB.svg",
      },
      {
        srcName: "Meteora",
        srcAddress: "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
        srcImage: "https://statics.solscan.io/ex-img/Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB.svg",
        sentToken: oppositeOrder.dstToken,
        sentAmount: Math.floor(oppositeOrder.minReceived),
        dstName: "User 2",
        dstAddress: oppositeOrder.dstAddress,
        dstImage: USER_VENUE_IMAGE
      },

      // also fill user 1 with jupiter
      {
        srcName: "User 1",
        srcAddress: order.srcAddress,
        srcImage: USER_VENUE_IMAGE,
        sentToken: order.srcToken,
        sentAmount: Math.floor(order.srcAmount),
        dstName: "Jupiter",
        dstAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        dstImage: "https://statics.solscan.io/ex-img/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4.svg"
      },
      {
        srcName: "Jupiter",
        srcAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        srcImage: "https://statics.solscan.io/ex-img/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4.svg",
        sentToken: order.srcToken,
        sentAmount: Math.floor(order.srcAmount),
        dstName: "Orca 2",
        dstAddress: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCA",
        dstImage: "https://statics.solscan.io/ex-img/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc.svg",
      },
      {
        srcName: "Orca 2",
        srcAddress: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCA",
        srcImage: "https://statics.solscan.io/ex-img/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc.svg",
        sentToken: order.dstToken,
        sentAmount: Math.floor(order.minReceived),
        dstName: "User 1",
        dstAddress: order.dstAddress,
        dstImage: USER_VENUE_IMAGE
      }
    ],
    score: 10,
    batchId: batch.batchId
  });
  await alephSolution.save();
  
  // mock bet solution
  const betSolution = new Solution({
    agent: betAgent?._id,
    route: [
      // fill user 1 order with user 2 order at 5% surplus
      {
        srcName: "User 2",
        srcAddress: oppositeOrder.srcAddress,
        srcImage: USER_VENUE_IMAGE,
        sentToken: order.dstToken,
        sentAmount: Math.floor(order.minReceived * 1.05),
        dstName: "User 1",
        dstAddress: order.dstAddress,
        dstImage: USER_VENUE_IMAGE,
      },
      // fill half of user 2 order with user 1 order
      {
        srcName: "User 1",
        srcAddress: order.srcAddress,
        srcImage: USER_VENUE_IMAGE,
        sentToken: oppositeOrder.dstToken,
        sentAmount: Math.floor(oppositeOrder.minReceived * 1.05 / 2),
        dstName: "User 2",
        dstAddress: oppositeOrder.dstAddress,
        dstImage: USER_VENUE_IMAGE,
      },
      // fill the other half with a route through jupiter
      {
        srcName: "User 2",
        srcAddress: oppositeOrder.srcAddress,
        srcImage: USER_VENUE_IMAGE,
        sentToken: oppositeOrder.srcToken,
        sentAmount: Math.floor(oppositeOrder.srcAmount / 2),
        dstName: "Jupiter",
        dstAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        dstImage: "https://statics.solscan.io/ex-img/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4.svg"
      },
      {
        srcName: "Jupiter",
        srcAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        srcImage: "https://statics.solscan.io/ex-img/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4.svg",
        sentToken: oppositeOrder.srcToken,
        sentAmount: Math.floor(oppositeOrder.srcAmount / 2),
        dstName: "Raydium",
        dstAddress: "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h",
        dstImage: "https://statics.solscan.io/ex-img/CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK.png",
      },
      {
        srcName: "Raydium",
        srcAddress: "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h",
        srcImage: "https://statics.solscan.io/ex-img/CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK.png",
        sentToken: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
        sentAmount: convertDecimalAmountToU64(205, 6),
        dstName: "Orca",
        dstAddress: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
        dstImage: "https://statics.solscan.io/ex-img/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc.svg",
      },
      {
        srcName: "Orca",
        srcAddress: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
        srcImage: "https://statics.solscan.io/ex-img/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc.svg",
        sentToken: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDC
        sentAmount: convertDecimalAmountToU64(204.5, 6),
        dstName: "Meteora",
        dstAddress: "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
        dstImage: "https://statics.solscan.io/ex-img/Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB.svg",
      },
      {
        srcName: "Meteora",
        srcAddress: "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
        srcImage: "https://statics.solscan.io/ex-img/Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB.svg",
        sentToken: oppositeOrder.dstToken,
        sentAmount: Math.floor(oppositeOrder.minReceived * 1.05 / 2),
        dstName: "User 2",
        dstAddress: oppositeOrder.dstAddress,
        dstImage: USER_VENUE_IMAGE
      }
    ],
    score: 14,
    batchId: batch.batchId
  });
  await betSolution.save();

  // mock the batch getting filled
  batch.status = 'filled';
  batch.fillData = {
    tx: 'mocktx',
    agentName: 'bet',
    route: betSolution.route
  } as IFillData; 
  await batch.save();
  
  order.status = 'filled';
  order.batch = batch._id as any;
  await order.save();

  oppositeOrder.status = 'filled';
  oppositeOrder.batch = batch._id as any;
  await oppositeOrder.save();
}