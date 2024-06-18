# FNSA -> KAIA bridge Indexer (Multichain SubQuery Indexer)

Using [SubQuery's](https://subquery.network) [Multi-chain indexing support](https://academy.subquery.network/build/multi-chain.html) this project indexes bridge transactions on both Finschia and Kaia chains and provides a GraphQL API to query the data.

## Start

First, install SubQuery CLI globally on your terminal by using NPM `npm install -g @subql/cli`

Then, clone this repository and navigate to the project directory.

```bash
git clone https://github.com/klaytn/dex-indexer-example.git
```
```bash
cd dex-indexer-example/SubQuery/Multichain
```

Don't forget to install dependencies with `npm install` or `yarn install`!

## Editing your SubQuery project

Although this is a working example SubQuery project, you can edit the SubQuery project by changing the following files:

- The project manifest in `project-kaia.yaml` defines the key project configuration and mapping handler filters of Kaia chain
- The project manifest in `project-finschia.yaml` defines the key project configuration and mapping handler filters of Finschia chain
- The GraphQL Schema (`schema.graphql`) defines the shape of the resulting data that you are using SubQuery to index
- The Mapping functions in `src/mappings/` directory are typescript functions that handle transformation logic

SubQuery supports various layer-1 blockchain networks and provides [dedicated quick start guides](https://academy.subquery.network/quickstart/quickstart.html) as well as [detailed technical documentation](https://academy.subquery.network/build/introduction.html) for each of them.

## Run your project

_If you get stuck, find out how to get help below._

The simplest way to run your project is by running `yarn dev > log.txt 2>&1`. This does all of the following:

1.  `yarn codegen` - Generates types from the GraphQL schema definition and contract ABIs and saves them in the `/src/types` directory. This must be done after each change to the `schema.graphql` file or the contract ABIs
2.  `yarn build` - Builds and packages the SubQuery project into the `/dist` directory
3.  `docker-compose pull && docker-compose up` - Runs a Docker container with an indexer, PostgeSQL DB, and a query service. This requires [Docker to be installed](https://docs.docker.com/engine/install) and running locally. The configuration for this container is set from your `docker-compose.yml`

You can observe the four services start, and once all are running (it may take a few minutes on your first start), please open your browser and head to [http://localhost:3000](http://localhost:3000) - you should see a GraphQL playground showing with the schemas ready to query. [Read the docs for more information](https://academy.subquery.network/run_publish/run.html) or [explore the possible service configuration for running SubQuery](https://academy.subquery.network/run_publish/references.html).

## Query your project

You can explore the different possible queries and entities to help you with GraphQL using the documentation draw on the right.

Here is an example query to get the first 5 bridge transactions ordered by sequence number in descending order:

```graphql
{
  query {
    bridges (first: 5, orderBy: SEQ_DESC) {
      nodes {
      seq
        finschia{
          sourceTxHash
          sender
          receiver
          amount
          status
          timestamp
        }
        kaia{
          sender
          receiver
          amount
          contractAddress
          timestamp
          deliverTimestamp
          operator
          status
          txFee
          destinationTxHash
        }
    }
    }
  }
}
```

## Publish your project

SubQuery is open-source, meaning you have the freedom to run it in the following three ways:

- Locally on your own computer (or a cloud provider of your choosing), [view the instructions on how to run SubQuery Locally](https://academy.subquery.network/run_publish/run.html)
- By publishing it to our enterprise-level [Managed Service](https://managedservice.subquery.network), where we'll host your SubQuery project in production ready services for mission critical data with zero-downtime blue/green deployments. We even have a generous free tier. [Find out how](https://academy.subquery.network/run_publish/publish.html)
- [Coming Soon] By publishing it to the decentralised [SubQuery Network](https://subquery.network/network), the most open, performant, reliable, and scalable data service for dApp developers. The SubQuery Network indexes and services data to the global community in an incentivised and verifiable way

## What Next?

Take a look at some of our advanced features to take your project to the next level!

- [**Dynamic Data Sources**](https://academy.subquery.network/build/dynamicdatasources.html) - When you want to index factory contracts, for example on a DEX or generative NFT project.
- [**Project Optimisation Advice**](https://academy.subquery.network/build/optimisation.html) - Some common tips on how to tweak your project to maximise performance.
- [**GraphQL Subscriptions**](https://academy.subquery.network/run_publish/subscription.html) - Build more reactive front end applications that subscribe to changes in your SubQuery project.

## Need Help?

The fastest way to get support is by [searching our documentation](https://academy.subquery.network), or by [joining our discord](https://discord.com/invite/subquery) and messaging us in the `#technical-support` channel.
