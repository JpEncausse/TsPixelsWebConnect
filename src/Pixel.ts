import {
  MessageTypeValues,
  MessageType,
  MessageOrType,
  getMessageType,
  isMessage,
  getMessageName,
  serializeMessage,
  deserializeMessage,
  IAmADie,
  RollState,
  BatteryLevel,
  Rssi,
  Blink,
} from './Messages'

import { enumVal, exponentialBackOff, Mutex } from './Utils'

// Pixel dice service UUID
export const serviceUuid = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
// Pixel dice notify characteristic UUID
export const notifyCharacteristicUuid = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
// Pixel dice write characteristic UUID
export const writeCharacteristicUuid = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'

// Peripheral connection events.
export const ConnectionEventValues = {
  // Raised at the beginning of the connect sequence and is followed either by Connected or FailedToConnect.
  Connecting: enumVal(0),

  // Raised once the peripheral is connected, just before services are being discovered.
  Connected: enumVal(),

  // Raised when the peripheral fails to connect, the reason for the failure is also given.
  FailedToConnect: enumVal(),

  // Raised after a Connected event, once the required services have been discovered.
  Ready: enumVal(),

  // Raised at the beginning of a user initiated disconnect.
  Disconnecting: enumVal(),

  // Raised when the peripheral is disconnected, the reason for the disconnection is also given.
  Disconnected: enumVal(),
}

// The "enum" type for ConnectionEventValues.
export type ConnectionEvent =
  typeof ConnectionEventValues[keyof typeof ConnectionEventValues]

// Peripheral connection event reasons.
export const ConnectionEventReasonValues = {
  // The disconnect happened for an unknown reason.
  Unknown: enumVal(-1),

  // The disconnect was initiated by user.
  Success: enumVal(0),

  // Connection attempt canceled by user.
  Canceled: enumVal(),

  // Peripheral doesn't have all required services.
  NotSupported: enumVal(),

  // Peripheral didn't responded in time.
  Timeout: enumVal(),

  // Peripheral was disconnected while in "auto connect" mode.
  LinkLoss: enumVal(),

  // The local device Bluetooth adapter is off.
  AdapterOff: enumVal(),

  // Disconnection was initiated by peripheral.
  Peripheral: enumVal(),
}

// The "enum" type for ConnectionEventReasonValues.
export type ConnectionEventReason =
  typeof ConnectionEventReasonValues[keyof typeof ConnectionEventReasonValues]

// Callable for BLE peripheral connection event, with the reason.
export type ConnectionEventFunction = (
  event: ConnectionEvent,
  reason: ConnectionEventReason
) => void

// Store Pixel instances to avoid creating more than one for the same device
const _pixels = new Map<BluetoothDevice, Pixel>()

// Request user to select a Pixel to connect to.
// Pixels instances are kept and returned if the same die is selected again.
export async function requestPixel(
  connEv?: ConnectionEventFunction
): Promise<Pixel> {
  // Request user to select a Pixel
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [serviceUuid] }],
  })
  // Keep Pixel instances
  let pixel = _pixels.get(device)
  if (!pixel) {
    pixel = new Pixel(device, connEv)
    _pixels.set(device, pixel)
  }
  return pixel
}

// Represents a Pixel die.
// It may connect to and disconnect from the Pixel, and also send and receive messages.
export class Pixel {
  private readonly _device: BluetoothDevice
  private readonly _name: string
  private readonly _eventTarget = new EventTarget()
  private readonly _connMtx = new Mutex()
  private _connected = false
  private _reconnect = false
  private _connEv?: ConnectionEventFunction = undefined
  private _session?: Session = undefined
  private _info?: IAmADie = undefined

  get name(): string {
    return this._name
  }

  get connected(): boolean {
    return this._connected && (this._device.gatt?.connected ?? false)
  }

  get ready(): boolean {
    return this.connected && this._info !== undefined
  }

  get info(): IAmADie | undefined {
    return this._info
  }

  // Instantiates a Pixel from a Bluetooth device.
  constructor(device: BluetoothDevice, connEv?: ConnectionEventFunction) {
    this._device = device
    if (!device.name) {
      throw Error('Device has no name')
    }

    // Store name and connection event handler
    this._name = device.name
    this._connEv = connEv

    // Subscribe to disconnect event
    device.addEventListener('gattserverdisconnected', (/*ev: Event*/) => {
      this.log('Disconnected!')

      let reason = ConnectionEventReasonValues.Success
      if (this._connected) {
        // Disconnect not called by user code
        reason = this._reconnect
          ? ConnectionEventReasonValues.LinkLoss
          : ConnectionEventReasonValues.Timeout
      }

      // Automatically reconnect?
      // We're still running the connection code if _info is undefined
      const reconnect = this._reconnect && this._info !== undefined

      // Reset internal state
      this._connected = false
      this._session = undefined // Note: we shouldn't need to unsubscribe since we are got disconnected anyways
      this._info = undefined

      // Notify disconnection
      this.notifyConnEv(ConnectionEventValues.Disconnected, reason)

      if (reconnect) {
        // Schedule a reconnect
        // Note: it's probably best to avoid reconnecting directly from a disconnect event
        this.log('Auto-reconnecting')
        setTimeout(async () => {
          try {
            await this.reconnect()
          } catch {
            // Catch all errors, nothing we can do about them
          }
        })
      }
    })
  }

  // Asynchronously connects to the Pixel.
  // Throws a NetworkError on AbortError on failure to connect
  // Other errors may be thrown on rare occasions
  async connect(autoReconnect = false): Promise<Pixel> {
    this._reconnect = autoReconnect
    await this.reconnect()
    return this
  }

  private async reconnect(): Promise<void> {
    // Our connect function
    const doConnect = async () => {
      const server = this._device.gatt
      if (server) {
        if (!server.connected) {
          // Attempt to connect.
          this.log('Connecting')
          this.notifyConnEv(ConnectionEventValues.Connecting)
          await server.connect()

          // Notify connected
          this._connected = true
          this.notifyConnEv(ConnectionEventValues.Connected)
        }

        // Use a mutex to prevent creating multiple sessions
        let info: IAmADie | undefined = undefined
        await this._connMtx.dispatch(async () => {
          if (!this._session) {
            // Create session
            this.log('Getting service and characteristics')
            const service = await server.getPrimaryService(serviceUuid)
            const notifyCharacteristic = await service.getCharacteristic(
              notifyCharacteristicUuid
            )
            const writeCharacteristic = await service.getCharacteristic(
              writeCharacteristicUuid
            )
            this._session = new Session(
              service,
              notifyCharacteristic,
              writeCharacteristic,
              this.log.bind(this)
            )
            this.log('Subscribing')
            await this._session.subscribe((dv: DataView) =>
              this.onValueChanged(dv)
            )

            // Identify Pixel
            if (this._session) {
              this.log('Waiting on identification message')
              const response = await this.sendAndWaitForMsg(
                MessageTypeValues.WhoAreYou,
                MessageTypeValues.IAmADie
              )

              // Check that we weren't disconnected
              if (this.connected) {
                this._info = info = response as IAmADie
              }
            }
          }
        })
        if (info && this._info === info) {
          // Notify ready
          this.log('Ready')
          this.notifyConnEv(ConnectionEventValues.Ready)
        }
      } else {
        throw {
          name: 'NetworkError',
          message: 'No GATT Server, check Bluetooth permissions',
        }
      }
    }

    // Attempt to connect multiple times when autoReconnect is true
    const autoReconnect = this._reconnect
    // Prevent another automatic reconnection to happen while already doing it
    this._reconnect = false
    await exponentialBackOff({
      retries: autoReconnect ? 4 : 0,
      delay: 2,
      toTry: doConnect,
      success: () => {
        // Restore auto reconnect flag ony if successful
        this._reconnect = autoReconnect
      },
      fail: (error) => {
        this.log(
          `Failed to ${autoReconnect ? 're' : ''}connect with error: ${error}`
        )
        this.notifyConnEv(
          ConnectionEventValues.FailedToConnect,
          ConnectionEventReasonValues.Timeout
        )
        throw error
      },
    })
  }

  // Immediately disconnects from the Pixel.
  disconnect(): void {
    const server = this._device.gatt
    if (server?.connected) {
      this.notifyConnEv(ConnectionEventValues.Disconnecting)
      this._connected = false
      server.disconnect()
    }
  }

  // Appends an event listener for received messages of the given type.
  // The callback argument sets the callback that will be invoked when
  // the event is dispatched.
  addMessageListener(
    msgType: MessageType,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean
  ): void {
    const name = getMessageName(msgType)
    this._eventTarget.addEventListener(name, callback, options)
  }

  // Removes the event listener in target's event listener list with the
  // same type, callback, and options.
  removeMessageListener(
    msgType: MessageType,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ): void {
    const name = getMessageName(msgType)
    this._eventTarget.removeEventListener(name, callback, options)
  }

  // Asynchronously retrieves the roll state.
  async getRollState(): Promise<RollState> {
    const response = await this.sendAndWaitForMsg(
      MessageTypeValues.RequestRollState,
      MessageTypeValues.RollState
    )
    return response as RollState
  }

  // Asynchronously gets the battery level.
  async getBatteryLevel(): Promise<BatteryLevel> {
    const response = await this.sendAndWaitForMsg(
      MessageTypeValues.RequestBatteryLevel,
      MessageTypeValues.BatteryLevel
    )
    return response as BatteryLevel
  }

  // Asynchronously gets the RSSI.
  async getRssi(): Promise<number> {
    const response = await this.sendAndWaitForMsg(
      MessageTypeValues.RequestRssi,
      MessageTypeValues.Rssi
    )
    return (response as Rssi).rssi
  }

  // Requests the Pixel to blink and wait for a confirmation.
  async blink(color: number, count: number): Promise<void> {
    await this.sendAndWaitForMsg(
      new Blink(count, color),
      MessageTypeValues.BlinkFinished
    )
  }

  private log(msg: unknown): void {
    if (isMessage(msg)) {
      console.log(msg)
    } else {
      console.log(`[${new Date().toISOString()}] Pixel ${this._name}: ${msg}`)
    }
  }

  private notifyConnEv(
    ev: ConnectionEvent,
    reason: ConnectionEventReason = ConnectionEventReasonValues.Success
  ): void {
    if (this._connEv) {
      this._connEv(ev, reason)
    }
  }

  private checkAndGetSession(): Session {
    if (this._session) {
      return this._session
    } else {
      throw {
        name: 'NetworkError',
        message: 'Pixel not ready',
      }
    }
  }

  private onValueChanged(dataView: DataView) {
    try {
      const msgOrType = deserializeMessage(dataView.buffer)
      if (msgOrType) {
        this.log(`Received message of type ${getMessageType(msgOrType)}`)
        if (typeof msgOrType !== 'number') {
          // Log message contents
          this.log(msgOrType)
        }
        // Dispatch generic message event
        this._eventTarget.dispatchEvent(
          new CustomEvent('message', { detail: msgOrType })
        )
        // Dispatch specific message event
        const name = getMessageName(msgOrType)
        this._eventTarget.dispatchEvent(
          new CustomEvent(name, { detail: msgOrType })
        )
      } else {
        this.log('Received invalid message!')
      }
    } catch (error) {
      this.log('ValueChanged error: ' + error)
    }
  }

  private waitForMsg(
    expectedMsgType: MessageType,
    timeoutMs = 5000
  ): Promise<MessageOrType> {
    return new Promise((resolve, reject) => {
      const onMessage = (evt: Event) => {
        const msgOrType = (evt as CustomEvent).detail as MessageOrType
        resolve(msgOrType)
      }
      setTimeout(() => {
        this.removeMessageListener(expectedMsgType, onMessage)
        reject(new Error('Timeout waiting on message'))
      }, timeoutMs)
      this.addMessageListener(expectedMsgType, onMessage, { once: true })
    })
  }

  private async sendAndWaitForMsg(
    msgOrTypeToSend: MessageOrType,
    expectedMsgType: MessageType,
    timeoutMs = 5000
  ): Promise<MessageOrType> {
    const session = this.checkAndGetSession()
    const result = await Promise.all([
      this.waitForMsg(expectedMsgType, timeoutMs),
      session.send(msgOrTypeToSend),
    ])
    return result[0]
  }
}

// A Bluetooth session with a Pixel die.
class Session {
  private readonly _service: BluetoothRemoteGATTService
  private readonly _notify: BluetoothRemoteGATTCharacteristic
  private readonly _write: BluetoothRemoteGATTCharacteristic
  private readonly log: (msg: unknown) => void

  constructor(
    service: BluetoothRemoteGATTService,
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic,
    writeCharacteristic: BluetoothRemoteGATTCharacteristic,
    logFunc: (msg: unknown) => void
  ) {
    this._service = service
    this._notify = notifyCharacteristic
    this._write = writeCharacteristic
    this.log = logFunc
  }

  // Subscribes to notify characteristic and returns unsubscribe function
  async subscribe(listener: (dataView: DataView) => void): Promise<() => void> {
    function internalListener(
      this: BluetoothRemoteGATTCharacteristic /*, ev: Event*/
    ) {
      if (this.value?.buffer?.byteLength) {
        listener(this.value)
      }
    }
    this._notify.addEventListener(
      'characteristicvaluechanged',
      internalListener
    )
    await this._notify.startNotifications()
    return () => {
      this._notify.removeEventListener(
        'characteristicvaluechanged',
        internalListener
      )
    }
  }

  async send(msgOrType: MessageOrType, withoutResponse?: boolean) {
    this.log(`Sending message of type ${getMessageType(msgOrType)}`)
    const data = serializeMessage(msgOrType)
    const promise = withoutResponse
      ? this._write.writeValueWithoutResponse(data)
      : this._write.writeValueWithResponse(data)
    await promise
  }
}
