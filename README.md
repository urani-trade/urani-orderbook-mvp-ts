## Quick and Dirty Orderbook PoC for Colosseum Demo

<br>

#### 👉🏼 Quick and dirty PoC for the **<a href="https://www.loom.com/share/41396d9ef04e4a86bce179285d47dde6?sid=a7866556-53af-4bdd-954f-be840913afbd">Solana Colosseum Accelerator</a>**. 

#### 👉🏼 Note: this is NOT the Urani Protocol (which is authored by **[bt3gl](https://github.com/von-steinkirch)**), but rather a quick PoC just for the demo authored by **Sage ([Griffin Howllet](https://github.com/0xDualCube))**.



<br>

----

### Overview 


<br>

This orderbook:

1. receives orders from the frontend
2. creates a batch every 10s (configured in `config.ts`)
3. generates bullshit agent solutions and finalizes the batch 2.5s after the batch is created

<br>

To reproduce the same batch solution scripted in the demo video uncomment this in `routes.ts`

To disable the mock orders and agent solutions, remove this code from `app.ts` and replace it with logic that submits the solution with the highest score for the batch.

```
setInterval(addMockOrders, batchInterval);

setTimeout(() => {
  setInterval(addMockSolutionsAndFillData, batchInterval);
}, 3 * batchInterval / 4);
```

<br>

---
### Deployment

<br>

#### I. Create a `t4g.small` ec2 instance in the `us-east-1` region:

1. ssh into the ec2 
2. clone the repo & checkout `demo` branch
3. install docker
4. create a file `.env.development` and put this inside:

```
NODE_ENV=development
ORDERBOOK_PORT=5000
MONGODB_URI=mongodb://mongo:27017/ordersDB
SOLSCAN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3MTcxNTgxMzU4MDgsImVtYWlsIjoiZ3JpZmYuaG93bEBnbWFpbC5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJpYXQiOjE3MTcxNTgxMzV9.jeI5psnDpF_HyLXRZyAA9MS1ULAHoIndd3myiLNroyg
```

5.  run with docker-compose:
```bash
docker compose up -d
```

<br>

#### II. Request a TLS cert in the same region (us-east-1) for the following domains. Validate domain ownership via CNAME.


<img width="1275" alt="Screenshot" src="https://github.com/zxSage/ORDERBOOK/assets/165684384/1d422f84-1725-4d24-9b0a-7992e7a59be3">

<br>

#### III. Create a cloudfront distribution with the following settings (legacy cache setting & cors is important).

<img width="422" alt="Screenshot" src="https://github.com/zxSage/ORDERBOOK/assets/165684384/09e7dd4e-c219-4caa-a405-fc66917109a7">

<br>

#### IV. Forward `api.urani.trade` to the cloudfront domain.

<br>

#### V. Update the `env` variables in Vercel for arena and swap to point to `api.urani.trade`.

<br>



