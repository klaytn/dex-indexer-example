import { Bridge, State } from "../types";
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
  // fetch the transfer lock time
  const transferLock = await getLatestTransferTimeLock(log.address);
  // fetch the bridge record
  const bridge = await Bridge.get(event.seq.toString());
  if (!bridge) {
    // handling rare case where ProvisionConfirm event was received before fbridge event
    logger.warn(
      `Kaia > ProvisionConfirm: Bridge record not found for seq ${event.seq}`
    );
    const tx = Bridge.create({
      id: event.seq.toString(),
      sourceTxHash: "",
      destinationTxHash: log.transaction.hash,
      seq: event.seq.toBigInt(),
      sender: event.sender,
      receiver: event.receiver,
      fromAmount: event.amount.toBigInt(),
      toAmount: event.amount.toBigInt(),
      contractAddress: log.address,
      timestamp: log.block.timestamp,
      deliverTimestamp: log.block.timestamp + BigInt(transferLock),
      operator: log.transaction.from,
      status: Status.CONFIRMING,
      txFee: log.transaction.gas * log.transaction.gasPrice,
      blockHeight: BigInt(log.block.number),
    });
    // save the bridge record
    await tx.save();
  } else {
    // update the bridge record
    bridge.status = Status.CONFIRMING;
    bridge.destinationTxHash = log.transaction.hash;
    bridge.txFee = log.transaction.gas * log.transaction.gasPrice;
    bridge.operator = log.transaction.from;
    bridge.timestamp = log.block.timestamp;
    bridge.deliverTimestamp = log.block.timestamp + BigInt(transferLock);
    bridge.toAmount = event.amount.toBigInt();
    bridge.contractAddress = log.address;
    bridge.blockHeight = BigInt(log.block.number);
    // save the bridge record
    await bridge.save();
    logger.info(
      `Kaia > ProvisionConfirm: Bridge record updated for seq ${event.seq}`
    );
  }
}

export async function handleClaimLog(log: ClaimLog): Promise<void> {
  assert(log.args, "No log.args");
  logger.info(
    `Kaia > New Claim Log at block ${
      log.blockNumber
    } with seq ${log.args.provision.seq.toString()}`
  );
  const event = log.args.provision;

  // fetch the bridge record
  const bridge = await Bridge.get(event.seq.toString());
  if (!bridge) {
    // logically this could never happen [logging just in case ;) ]
    logger.error(`kaia > Claim: Bridge record not found for seq ${event.seq}`);
  } else {
    bridge.status = Status.DELIVERED;
    await bridge.save();
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

  // fetch the bridge record
  const bridge = await Bridge.get(event.seq.toString());
  if (!bridge) {
    // logically this could never happen [logging just in case ;) ]
    logger.error(
      `Kaia > RemoveProvision: Bridge record not found for seq ${event.seq}`
    );
  } else {
    // set status to failed
    bridge.status = Status.FAILED;
    bridge.destinationTxHash = log.transaction.hash;
    bridge.blockHeight = BigInt(log.blockNumber);
    await bridge.save();
    logger.info(
      `Kaia > RemoveProvision: Bridge record updated for seq ${event.seq}`
    );
  }
}

// finschia mappings

export async function handleFbridgeLog(event: CosmosEvent): Promise<void> {
  logger.info(
    `Finschia > New fbridge event at block ${
      event.block.block.header.height
    } with seq ${event.event.attributes
      .find((attr) => attr.key === "seq")
      ?.value.replace(/"/g, "")}`
  );
  const bridge = Bridge.create({
    id: event.tx.hash,
    sourceTxHash: event.tx.hash,
    destinationTxHash: "",
    seq: BigInt(0),
    sender: "",
    receiver: "",
    fromAmount: BigInt(0),
    toAmount: BigInt(0),
    contractAddress: "",
    timestamp: BigInt(
      Math.floor(event.block.block.header.time.getTime() / 1000)
    ), // convert ms to seconds
    deliverTimestamp: BigInt(0),
    operator: "",
    status: Status.INFLIGHT,
    txFee: BigInt(0),
    blockHeight: BigInt(event.block.block.header.height),
  });
  for (const attr of event.event.attributes) {
    switch (attr.key) {
      case "receiver":
        bridge.receiver = attr.value.replace(/"/g, ""); // remove quotes
        break;
      case "amount":
        bridge.fromAmount = BigInt(attr.value.replace(/"/g, ""));
        break;
      case "sender":
        bridge.sender = attr.value.replace(/"/g, ""); // remove quotes
        break;
      case "seq":
        const seqStr = attr.value.replace(/"/g, ""); // remove quotes - "100" => 100
        bridge.seq = BigInt(seqStr);
        bridge.id = seqStr; // set id to seq to avoid duplicate records
        break;
      default:
        break;
    }
  }
  // check if the bridge record already exists
  const existingBridge = await Bridge.get(bridge.seq.toString()); // seq is used as id
  if (!existingBridge) {
    await bridge.save();
    logger.info(
      `Finschia > fbridge: Bridge record created for seq ${bridge.seq}`
    );
  } else {
    // handling rare case where bridge record already exists e.g: ProvisionConfirm event was received before fbridge event
    logger.warn(
      `Finschia > fbridge: Bridge record already exists for seq ${bridge.seq}`
    );
    existingBridge.sourceTxHash = event.tx.hash;
    await existingBridge.save();
    logger.info(
      `Finschia > fbridge: Bridge record updated for seq ${bridge.seq}`
    );
  }
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

export async function handleHoldClaim(event: HoldClaimLog): Promise<void> {
  assert(event.args, "No event.args");
  logger.info(
    `Kaia > New HoldClaim Log at block ${
      event.blockNumber
    } with seq ${event.args.seq.toString()}`
  );
  const log = event.args;
  const bridge = await Bridge.get(log.seq.toString());
  if (!bridge) {
    logger.error(
      `Kaia > HoldClaim: Bridge record not found for seq ${log.seq}`
    );
  } else {
    bridge.deliverTimestamp = log.time.toBigInt(); // uin256 max value - INFINITE
    bridge.status = Status.HOLD;
    await bridge.save();
    logger.info(
      `Kaia > HoldClaim: Bridge record updated for seq ${event.args.seq}`
    );
  }
}

export async function handleReleaseClaim(
  event: ReleaseClaimLog
): Promise<void> {
  assert(event.args, "No event.args");
  logger.info(
    `Kaia > New ReleaseClaim Log at block ${
      event.blockNumber
    } with seq ${event.args.seq.toString()}`
  );
  const log = event.args;
  const bridge = await Bridge.get(log.seq.toString());
  if (!bridge) {
    logger.error(
      `Kaia > ReleaseClaim: Bridge record not found for seq ${log.seq}`
    );
  } else {
    bridge.deliverTimestamp = event.block.timestamp; // set deliverTimestamp to current block timestamp
    bridge.status = Status.CONFIRMING;
    await bridge.save();
    logger.info(
      `Kaia > ReleaseClaim: Bridge record updated for seq ${event.args.seq}`
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
