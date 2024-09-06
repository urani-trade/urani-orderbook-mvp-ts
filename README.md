## Urani Orderbook MVP 

<br>

#### 👉🏼 Quick and dirty proof-of-concept for the **<a href="https://www.loom.com/share/41396d9ef04e4a86bce179285d47dde6?sid=a7866556-53af-4bdd-954f-be840913afbd">Solana Colosseum Accelerator</a>**. 

#### 👉🏼 Note: this is NOT the Urani Protocol (which is authored by **[bt3gl](https://github.com/von-steinkirch)**), but rather our first MVP for orderbook, authored by **Sage (aka [Gman](https://github.com/0xDualCube))**.



<br>

----

### Overview 


<br>

This orderbook:

1. receives orders from the frontend
2. creates a batch every 10s (configured in `config.ts`)
3. generates bullshit agent solutions and finalizes the batch 2.5s after the batch is created

<br>

##### Notes for the Demo

* To reproduce the same batch solution scripted in the demo video uncomment this in `routes.ts`
* To disable the mock orders and agent solutions, remove this code from `app.ts` and replace it with logic that submits the solution with the highest score for the batch.

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
SOLSCAN_API_KEY=
```

5.  run with docker-compose:
```bash
docker compose up -d
```

<br>

#### II. Request a TLS certificate in the same region (`us-east-1`) for the following domains. Validate domain ownership via `CNAME`.


<img width="1000" src="https://github.com/zxSage/ORDERBOOK/assets/165684384/1d422f84-1725-4d24-9b0a-7992e7a59be3">

<br>

#### III. Create a Cloudfront distribution with the following settings (legacy cache setting & CORs is important).

<img width="422" src="https://github.com/zxSage/ORDERBOOK/assets/165684384/09e7dd4e-c219-4caa-a405-fc66917109a7">

<br>

#### IV. Forward `api.urani.trade` to the cloudfront domain.

<br>

#### V. Update the `env` variables in Vercel to point to `api.urani.trade`.

<br>


---

### License

<br>

This project is licensed under the **[Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0)**. 

<br>


