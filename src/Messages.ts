// A note about enums:
// Typescript documentation recommends using "as const" over "enum"
// https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums

let _enumValue = 0
function _genEVal(value?: number): number {
  if (value) {
    _enumValue = value
  }
  return _enumValue++
}

// Lists all the Pixel dice message types.
// The value is used for the first byte of data in a Pixel message to identify it's type.
// These message identifiers have to match up with the ones on the firmware.
export const MessageTypeValues = {
  None: _genEVal(0),
  WhoAreYou: _genEVal(),
  IAmADie: _genEVal(),
  RollState: _genEVal(),
  Telemetry: _genEVal(),
  BulkSetup: _genEVal(),
  BulkSetupAck: _genEVal(),
  BulkData: _genEVal(),
  BulkDataAck: _genEVal(),
  TransferAnimationSet: _genEVal(),
  TransferAnimationSetAck: _genEVal(),
  TransferAnimationSetFinished: _genEVal(),
  TransferSettings: _genEVal(),
  TransferSettingsAck: _genEVal(),
  TransferSettingsFinished: _genEVal(),
  TransferTestAnimationSet: _genEVal(),
  TransferTestAnimationSetAck: _genEVal(),
  TransferTestAnimationSetFinished: _genEVal(),
  DebugLog: _genEVal(),
  PlayAnimation: _genEVal(),
  PlayAnimationEvent: _genEVal(),
  StopAnimation: _genEVal(),
  PlaySound: _genEVal(),
  RequestRollState: _genEVal(),
  RequestAnimationSet: _genEVal(),
  RequestSettings: _genEVal(),
  RequestTelemetry: _genEVal(),
  ProgramDefaultAnimationSet: _genEVal(),
  ProgramDefaultAnimationSetFinished: _genEVal(),
  Blink: _genEVal(),
  BlinkFinished: _genEVal(),
  RequestDefaultAnimationSetColor: _genEVal(),
  DefaultAnimationSetColor: _genEVal(),
  RequestBatteryLevel: _genEVal(),
  BatteryLevel: _genEVal(),
  RequestRssi: _genEVal(),
  Rssi: _genEVal(),
  Calibrate: _genEVal(),
  CalibrateFace: _genEVal(),
  NotifyUser: _genEVal(),
  NotifyUserAck: _genEVal(),
  TestHardware: _genEVal(),
  SetStandardState: _genEVal(),
  SetLEDAnimationState: _genEVal(),
  SetBattleState: _genEVal(),
  ProgramDefaultParameters: _genEVal(),
  ProgramDefaultParametersFinished: _genEVal(),
  SetDesignAndColor: _genEVal(),
  SetDesignAndColorAck: _genEVal(),
  SetCurrentBehavior: _genEVal(),
  SetCurrentBehaviorAck: _genEVal(),
  SetName: _genEVal(),
  SetNameAck: _genEVal(),

  // Testing
  TestBulkSend: _genEVal(),
  TestBulkReceive: _genEVal(),
  SetAllLEDsToColor: _genEVal(),
  AttractMode: _genEVal(),
  PrintNormals: _genEVal(),
  PrintA2DReadings: _genEVal(),
  LightUpFace: _genEVal(),
  SetLEDToColor: _genEVal(),
  DebugAnimationController: _genEVal(),
} as const

// The "enum" type for MessageTypeValues
export type MessageType =
  typeof MessageTypeValues[keyof typeof MessageTypeValues]

// Base type for all Pixels messages.
// Note: messages that have no specific data don't require a class,
// a MessageType value may be used instead.
export interface Message {
  readonly type: MessageType
}

// Union type of Message and MessageType types.
export type MessageOrType = Message | MessageType

// Serialize the given Pixel message into a Uint8Array.
export function serializeMessage(message_or_type: MessageOrType): Uint8Array {
  if (typeof message_or_type === 'number') {
    return Uint8Array.of(message_or_type)
  } else {
    const msg = message_or_type as Blink
    const dataView = new DataView(new ArrayBuffer(6))
    dataView.setUint8(0, msg.type)
    dataView.setUint8(1, msg.flashCount)
    dataView.setUint32(2, msg.color, true)
    return new Uint8Array(dataView.buffer)
  }
}

// Attempts to deserialize the data of the given buffer into a Pixel message.
export function deserializeMessage(buffer: ArrayBuffer): MessageOrType {
  if (!buffer?.byteLength) {
    throw new Error('Empty buffer')
  }

  const dataView = new DataView(buffer)
  let index = 0
  function incAndRet<T>(v: T, inc: number) {
    index += inc
    return v
  }
  const readU8 = () => incAndRet(dataView.getUint8(index), 1)
  const readU16 = () => incAndRet(dataView.getUint16(index, true), 2) // Little endianness
  const readU32 = () => incAndRet(dataView.getUint32(index, true), 4) // Little endianness
  const readFloat = () => incAndRet(dataView.getFloat32(index, true), 4) // Little endianness
  // Can only be called last as it reads through the end of the buffer
  function readString() {
    const str = new TextDecoder().decode(dataView.buffer.slice(index))
    const c = str.indexOf('\0') // We might have trailing null characters
    return c >= 0 ? str.substring(0, c) : str
  }

  // First byte is message type
  const msgType = readU8()
  switch (msgType) {
    case MessageTypeValues.IAmADie:
      const diceType = readU8()
      const designAndColor = readU8()
      index += 1
      const dataSetHash = readU32()
      const deviceId = readU32()
      const flashSize = readU16()
      const version = readString()
      return new IAmADie(
        diceType,
        designAndColor,
        dataSetHash,
        deviceId,
        flashSize,
        version
      )

    case MessageTypeValues.RollState:
      const state = readU8()
      const face = readU8() + 1
      return new RollState(state, face)

    case MessageTypeValues.PlaySound:
      const clipId = readU16()
      return new PlaySound(clipId)

    case MessageTypeValues.BatteryLevel:
      const level = readFloat()
      const voltage = readFloat()
      const charging = readU8() != 0
      return new BatteryLevel(level, voltage, charging)

    case MessageTypeValues.Rssi:
      const value = readU16()
      return new Rssi(value)

    default:
      return msgType
  }
}

// Available combinations of Pixel designs and colors.
export const PixelDesignAndColorValues = {
  Unknown: _genEVal(0),
  Generic: _genEVal(),
  V3_Orange: _genEVal(),
  V4_BlackClear: _genEVal(),
  V4_WhiteClear: _genEVal(),
  V5_Grey: _genEVal(),
  V5_White: _genEVal(),
  V5_Black: _genEVal(),
  V5_Gold: _genEVal(),
  Onyx_Back: _genEVal(),
  Hematite_Grey: _genEVal(),
  Midnight_Galaxy: _genEVal(),
  Aurora_Sky: _genEVal(),
} as const

export type PixelDesignAndColor =
  typeof PixelDesignAndColorValues[keyof typeof PixelDesignAndColorValues]

export class IAmADie implements Message {
  readonly type: MessageType = MessageTypeValues.IAmADie

  readonly diceType: number
  readonly designAndColor: PixelDesignAndColor
  readonly dataSetHash: number
  readonly pixelId: number
  readonly flashSize: number
  readonly version: string

  constructor(
    diceType: number,
    designAndColor: PixelDesignAndColor,
    dataSetHash: number,
    pixelId: number,
    flashSize: number,
    version: string
  ) {
    this.diceType = diceType
    this.designAndColor = designAndColor
    this.dataSetHash = dataSetHash
    this.pixelId = pixelId
    this.flashSize = flashSize
    this.version = version
  }
}

// Pixel roll states.
export const PixelRollStateValues = {
  // The Pixel roll state could not be determined.
  Unknown: _genEVal(0),

  // The Pixel is resting in a position with a face up.
  OnFace: _genEVal(),

  // The Pixel is being handled.
  Handling: _genEVal(),

  // The Pixel is rolling.
  Rolling: _genEVal(),

  // The Pixel is resting in a crooked position.
  Crooked: _genEVal(),
} as const

// The "enum" type for PixelRollStateValues
export type PixelRollState =
  typeof PixelRollStateValues[keyof typeof PixelRollStateValues]

// Message send by a Pixel to notify of its rolling state.
export class RollState implements Message {
  readonly type: MessageType = MessageTypeValues.RollState

  // Current roll state.
  readonly state: PixelRollState

  // Face number (if applicable), starts at 1.
  readonly face: number

  constructor(state: PixelRollState, face: number) {
    this.state = state
    this.face = face
  }
}

// Message send by a Pixel to request playing a specific sound clip.
export class PlaySound implements Message {
  readonly type: MessageType = MessageTypeValues.PlaySound

  readonly clipId: number

  constructor(clipId: number) {
    this.clipId = clipId
  }
}

// Message send to a Pixel to have it blink its LEDs.
export class Blink implements Message {
  readonly type: MessageType = MessageTypeValues.Blink

  // Number of flashes.
  readonly flashCount: number

  // Color to use the flash.
  readonly color: number

  constructor(flashCount: number, color: number) {
    this.flashCount = flashCount
    this.color = color
  }
}

// Message send by a Pixel to notify of its battery level and state.
export class BatteryLevel implements Message {
  readonly type: MessageType = MessageTypeValues.BatteryLevel

  // The battery charge level, between 0 and 1.
  readonly level: number

  // The battery measured voltage.
  readonly voltage: number

  // Whether the batter is charging.
  readonly charging: boolean

  constructor(level: number, voltage: number, charging: boolean) {
    this.level = level
    this.voltage = voltage
    this.charging = charging
  }
}

// Message send by a Pixel to notify of its measured RSSI.
export class Rssi implements Message {
  readonly type: MessageType = MessageTypeValues.Rssi

  // The RSSI value, between 0 and 65535.
  readonly value: number

  constructor(value: number) {
    this.value = value
  }
}
