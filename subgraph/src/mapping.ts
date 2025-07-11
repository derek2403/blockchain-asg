import { Log } from "../generated/EventScanner/EventScanner"
import { Event } from "../generated/schema"

export function handleLog(event: Log): void {
  let entity = new Event(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString()
  )
  
  entity.contractAddress = event.address.toHexString()
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash.toHexString()
  entity.logIndex = event.logIndex
  entity.data = event.params.data.toHexString()
  entity.topics = []
  entity.createdAt = event.block.timestamp

  // We cannot extract event signature from data in this generic handler
  entity.eventSignature = "unknown"

  // Decoded data is unknown for generic events
  entity.decodedData = "Unknown Event"

  entity.save()
} 