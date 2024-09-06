## Urani Orderbook MVP 

<br>

#### 👉🏼 "Quick n' dirty" proof-of-concept of a batching orderbook, presented at the **<a href="https://www.loom.com/share/41396d9ef04e4a86bce179285d47dde6?sid=a7866556-53af-4bdd-954f-be840913afbd">Solana Colosseum Accelerator's Demo Day</a>**. 

#### 👉🏼 Note: this is NOT the Urani Protocol (which is authored by **[bt3gl](https://github.com/von-steinkirch)**), but rather our first MVP, authored by **Sage (aka [Gman](https://github.com/0xDualCube))**.



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

* To reproduce the same batch solution scripted in the demo, uncomment this in `routes.ts`
* To disable the mock orders and agent solutions, remove this code from `app.ts` and replace it with logic that submits the solution with the highest score for the batch.

```
setInterval(addMockOrders, batchInterval);

setTimeout(() => {
  setInterval(addMockSolutionsAndFillData, batchInterval);
}, 3 * batchInterval / 4);
```

<br>

---

### Production Deployment

<br>

#### Create the AWS Instance

<br>

Create a `t4g.small` ec2 instance in the `us-east-1` region:

- `ssh` into the ec2 instance
- clone the repo
- install docker
- create and fill `.env.development`.
- run `docker-compose`:
```bash
docker compose up -d
```

<br>

#### Configure the TLS Certificate

<br>

Request a TLS certificate for the desired domains in the same region (e.g., `us-east-1`). Validate domain ownership via `CNAME`.


<img width="1000" src="https://github.com/zxSage/ORDERBOOK/assets/165684384/1d422f84-1725-4d24-9b0a-7992e7a59be3">

<br>

#### Configure CloudFront

<br>

Create a CloudFront distribution with the following settings (legacy cache settings and CORs are important):

<img width="422" src="https://github.com/zxSage/ORDERBOOK/assets/165684384/09e7dd4e-c219-4caa-a405-fc66917109a7">

<br>

#### Complete the Routing

<br>

Forward the desired domain (e.g., `api.urani.trade`) to the Cloudfront domain.

Then Update the `env` variables in Vercel to point to this domain

<br>


---

### License and Contributing

<br>

This project is distributed under the **[Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0)**. 

You are welcome to contribute. See the guidelines **[here](docs/CONTRIBUTING.md)**.

<br>

