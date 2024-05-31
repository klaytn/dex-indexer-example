import { Bridge } from "../types";
import Status from "../utils/status";
import {
  ClaimLog,
  ProvisionConfirmLog,
  RemoveProvisionLog,
} from "../types/abi-interfaces/BridgeAbi";

import assert from "assert";
import { CosmosEvent } from "@subql/types-cosmos";

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
      operator: log.transaction.from,
      status: Status.CONFIRMING,
      txFee: log.transaction.gas * log.transaction.gasPrice,
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
    bridge.toAmount = event.amount.toBigInt();
    bridge.contractAddress = log.address;
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
    operator: "",
    status: Status.INFLIGHT,
    txFee: BigInt(0),
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
