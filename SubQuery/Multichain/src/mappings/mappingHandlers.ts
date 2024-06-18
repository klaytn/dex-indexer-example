import {
  Kaia as KaiaTx,
  State,
  Finschia as FinschiaTx,
  Bridge as Transaction,
} from "../types";
import Status from "../utils/status";
import {
  ChangeTransferTimeLockLog,
  ClaimLog,
  HoldClaimLog,
  ProvisionConfirmLog,
  ReleaseClaimLog,
  RemoveProvisionLog,
} from "../types/abi-interfaces/BridgeAbi";

import assert from "assert";
import { CosmosEvent } from "@subql/types-cosmos";

const TRANSFER_TIME_LOCK = BigInt(1800); // 30 minutes

export async function handleProvisionLog(
  log: ProvisionConfirmLog
): Promise<void> {
  assert(log.args, "No log.args");
  logger.info(
    `Kaia > New ProvisionConfirm Log at block ${
      log.blockNumber
    } with seq ${log.args.provision.seq.toString()}`
  );
  const event = log.args.provision;
  // store the seq
  await storeSeqIfNotExists(event.seq.toString());
  // fetch the transfer lock time
  const transferLock = await getLatestTransferTimeLock(log.address);

  const tx = KaiaTx.create({
    id: event.seq.toString(),
    destinationTxHash: log.transaction.hash,
    seq: event.seq.toBigInt(),
    sender: event.sender,
    receiver: event.receiver,
    amount: event.amount.toBigInt(),
    contractAddress: log.address,
    timestamp: log.block.timestamp,
    deliverTimestamp: log.block.timestamp + BigInt(transferLock),
    operator: log.transaction.from,
    status: Status.CONFIRMING,
    txFee: log.transaction.gas * log.transaction.gasPrice,
    blockHeight: BigInt(log.block.number),
    bridgeId: event.seq.toString(),
  });
  // save the tx record
  await tx.save();
}

export async function handleClaimLog(log: ClaimLog): Promise<void> {
  assert(log.args, "No log.args");
  logger.info(
    `Kaia > New Claim Log at block ${
      log.blockNumber
    } with seq ${log.args.provision.seq.toString()}`
  );
  const event = log.args.provision;

  // fetch the KaiaTx record
  const tx = await KaiaTx.get(event.seq.toString());
  if (!tx) {
    // logically this could never happen [logging just in case ;) ]
    logger.error(`kaia > Claim: Bridge record not found for seq ${event.seq}`);
  } else {
    tx.status = Status.DELIVERED;
    await tx.save();
    logger.info(`Kaia > Claim: Bridge record updated for seq ${event.seq}`);
  }
}
export async function handleRemoveProvisionLog(
  log: RemoveProvisionLog
): Promise<void> {
  assert(log.args, "No log.args");
  logger.warn(
    `Kaia > New RemoveProvision Log at block ${
      log.blockNumber
    } with seq ${log.args.provision.seq.toString()}`
  );
  const event = log.args.provision;

  // fetch the KaiaTx record
  const tx = await KaiaTx.get(event.seq.toString());
  if (!tx) {
    // logically this could never happen [logging just in case ;) ]
    logger.error(
      `Kaia > RemoveProvision: Bridge record not found for seq ${event.seq}`
    );
  } else {
    // set status to failed
    tx.status = Status.FAILED;
    tx.destinationTxHash = log.transaction.hash;
    tx.blockHeight = BigInt(log.blockNumber);
    await tx.save();
    logger.info(
      `Kaia > RemoveProvision: Bridge record updated for seq ${event.seq}`
    );
  }
}

// finschia mappings

export async function handleFbridgeLog(event: CosmosEvent): Promise<void> {
  const seq = event.event.attributes
    .find((attr) => attr.key === "seq")
    ?.value.replace(/"/g, "");
  assert(seq, "Finschia > No seq attribute found in event");

  logger.info(
    `Finschia > New fbridge event at block ${event.block.block.header.height} with seq ${seq}`
  );
  // store the seq
  await storeSeqIfNotExists(seq);
  // create a new finschiaTx record
  const tx = FinschiaTx.create({
    id: seq,
    seq: BigInt(seq),
    sender: "",
    receiver: "",
    amount: BigInt(0),
    timestamp: BigInt(
      Math.floor(event.block.block.header.time.getTime() / 1000)
    ), // convert ms to seconds
    blockHeight: BigInt(event.block.block.header.height),
    sourceTxHash: event.tx.hash,
    status: Status.INFLIGHT,
    bridgeId: seq,
  });
  for (const attr of event.event.attributes) {
    switch (attr.key) {
      case "receiver":
        tx.receiver = attr.value.replace(/"/g, ""); // remove quotes
        break;
      case "amount":
        tx.amount = BigInt(attr.value.replace(/"/g, ""));
        break;
      case "sender":
        tx.sender = attr.value.replace(/"/g, ""); // remove quotes
        break;
      default:
        break;
    }
  }
  await tx.save();
  logger.info(`Finschia > fbridge: Bridge record created for seq ${tx.seq}`);
}
// state sync mappings

export async function handleChangeTimeLockLog(
  log: ChangeTransferTimeLockLog
): Promise<void> {
  assert(log.args, "No log.args");
  logger.info(
    `Kaia > New ChangeTransferTimeLock Log at block ${log.blockNumber}`
  );
  const event = log.args;
  const bridge = await State.get(log.address);
  if (!bridge) {
    logger.warn(
      `Kaia > ChangeTransferTimeLock: State record not found. Creating new record`
    );
    const tx = State.create({
      id: log.address,
      transferLock: event.time.toBigInt(), // seconds e.g: 1800 => 30 minutes
    });
    await tx.save();
    logger.info(
      `Kaia > ChangeTransferTimeLock: State record created with transferLock time ${event.time.toBigInt()}`
    );
  } else {
    bridge.transferLock = event.time.toBigInt();
    await bridge.save();
    logger.info(
      `Kaia > ChangeTransferTimeLock: State record updated with new transferLock time ${event.time.toBigInt()}`
    );
  }
}

export async function handleHoldClaim(log: HoldClaimLog): Promise<void> {
  assert(log.args, "No event.args");
  logger.info(
    `Kaia > New HoldClaim Log at block ${log.blockNumber} with seq ${log.args.seq}`
  );
  const event = log.args;
  const tx = await KaiaTx.get(event.seq.toString());
  if (!tx) {
    logger.error(
      `Kaia > HoldClaim: Bridge record not found for seq ${event.seq}`
    );
  } else {
    tx.deliverTimestamp = event.time.toBigInt(); // uin256 max value - INFINITE
    tx.status = Status.HOLD;
    await tx.save();
    logger.info(`Kaia > HoldClaim: Bridge record updated for seq ${event.seq}`);
  }
}

export async function handleReleaseClaim(log: ReleaseClaimLog): Promise<void> {
  assert(log.args, "No event.args");
  logger.info(
    `Kaia > New ReleaseClaim Log at block ${log.blockNumber} with seq ${log.args.seq}`
  );
  const event = log.args;
  const tx = await KaiaTx.get(event.seq.toString());
  if (!tx) {
    logger.error(
      `Kaia > ReleaseClaim: Bridge record not found for seq ${event.seq}`
    );
  } else {
    tx.deliverTimestamp = log.block.timestamp; // set deliverTimestamp to current block timestamp
    tx.status = Status.CONFIRMING;
    await tx.save();
    logger.info(
      `Kaia > ReleaseClaim: Bridge record updated for seq ${event.seq}`
    );
  }
}

// utility function
async function getLatestTransferTimeLock(
  bridge_contract_address: string
): Promise<bigint> {
  // fetch the state record
  const state = await State.get(bridge_contract_address);
  if (state) {
    return state.transferLock;
  } else {
    // return default transfer lock
    return TRANSFER_TIME_LOCK;
  }
}

async function storeSeqIfNotExists(seq: string): Promise<void> {
  const existingSeq = await Transaction.get(seq);
  if (!existingSeq) {
    const newTransaction = Transaction.create({
      id: seq,
      seq: BigInt(seq),
    });

    await newTransaction.save();
    logger.info(`Indexer > New Transaction record created for seq ${seq}`);
  }
}
