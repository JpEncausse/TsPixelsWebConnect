import {
  MessageTypeValues,
  MessageType,
  MessageOrType,
  getMessageType,
  isMessage,
  getMessageName,
  serializeMessage,
  deserializeMessage,
  RollState,
  BatteryLevel,
  Rssi,
  Blink,
} from './Messages'

// Log function
function log(msg: unknown): void {
  if (isMessage(msg)) {
    console.log(msg)
  } else {
    console.log(`Pixel: ${msg}`)
  }
}

// Pixel dice service UUID
export const serviceUuid = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
// Pixel dice notify characteristic UUID
export const notifyCharacteristicUuid = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
// Pixel dice write characteristic UUID
export const writeCharacteristicUuid = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'

// Request user to select a Pixel to connect to.
export async function requestPixel(): Promise<Pixel> {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [serviceUuid] }],
  })
  return new Pixel(device)
}

// Represents a Pixel die.
// It may connect to and disconnect from the Pixel, and also send and receive messages.
export class Pixel {
  private readonly _device: BluetoothDevice
  private readonly _eventTarget: EventTarget = new EventTarget()
  private _session: Session | null = null

  // Instantiates a Pixel from a Bluetooth device.
  constructor(device: BluetoothDevice) {
    this._device = device
  }

  // Asynchronously connects to the Pixel.
  async connect(): Promise<void> {
    if (this._device?.gatt) {
      // Attempt to connect.
      log('Gatt connect')
      const server = await this._device.gatt.connect()
      log('Get service and characteristics')
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
        writeCharacteristic
      )
      log('Subscribe')
      await this._session.subscribe((dv: DataView) => this.onValueChanged(dv))
      log('Waiting on identification message')
      const waitResponse = this.waitForMessage(MessageTypeValues.IAmADie)
      log('Get info')
      await this.sendMessage(MessageTypeValues.WhoAreYou)
      await waitResponse
    }
  }

  private waitForMessage(expectedMsgType: MessageType): Promise<MessageOrType> {
    return new Promise((resolve /*, reject*/) => {
      const onMessage = (evt: Event) => {
        log(evt)
        const msgOrType = (evt as CustomEvent).detail as MessageOrType
        resolve(msgOrType)
      }
      this.addMessageListener(expectedMsgType, onMessage, { once: true })
      //TODO timeout reject();
    })
  }

  private onValueChanged(dataView: DataView) {
    try {
      const msgOrType = deserializeMessage(dataView.buffer)
      if (msgOrType) {
        log(`Received message of type ${getMessageType(msgOrType)}`)
        if (typeof msgOrType !== 'number') {
          // Log message contents
          log(msgOrType)
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
        log('Received invalid message!')
      }
    } catch (error) {
      log('ValueChanged error: ' + error)
    }
  }

  // Immediately disconnects from the Pixel.
  disconnect(): void {
    this._session = null
    if (this._device?.gatt) {
      this._device.gatt.disconnect()
      //TODO Unsubscribe?
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

  // Asynchronously sends a message to the Pixel.
  async sendMessage(
    msgOrType: MessageOrType,
    withoutResponse?: boolean
  ): Promise<void> {
    if (this._device?.gatt && this._session) {
      await this._session.send(msgOrType, withoutResponse)
    }
  }

  async getRollState(): Promise<RollState> {
    const waitResponse = this.waitForMessage(MessageTypeValues.RollState)
    await this.sendMessage(MessageTypeValues.RequestRollState)
    const response = await waitResponse
    return response as RollState
  }

  async getBatteryLevel(): Promise<BatteryLevel> {
    const waitResponse = this.waitForMessage(MessageTypeValues.BatteryLevel)
    await this.sendMessage(MessageTypeValues.RequestBatteryLevel)
    const response = await waitResponse
    return response as BatteryLevel
  }

  async getRssi(): Promise<number> {
    const waitResponse = this.waitForMessage(MessageTypeValues.Rssi)
    await this.sendMessage(MessageTypeValues.RequestRssi)
    const response = await waitResponse
    return (response as Rssi).rssi
  }

  async blink(color: number, count: number): Promise<void> {
    const waitResponse = this.waitForMessage(MessageTypeValues.BlinkFinished)
    await this.sendMessage(new Blink(count, color))
    await waitResponse
  }
}

// A Bluetooth session with a Pixel die.
class Session {
  private readonly _service: BluetoothRemoteGATTService
  private readonly _notify: BluetoothRemoteGATTCharacteristic
  private readonly _write: BluetoothRemoteGATTCharacteristic

  constructor(
    service: BluetoothRemoteGATTService,
    notifyCharacteristic: BluetoothRemoteGATTCharacteristic,
    writeCharacteristic: BluetoothRemoteGATTCharacteristic
  ) {
    this._service = service
    this._notify = notifyCharacteristic
    this._write = writeCharacteristic
  }

  async subscribe(listener: (dataView: DataView) => void): Promise<void> {
    this._notify.addEventListener(
      'characteristicvaluechanged',
      function (this: BluetoothRemoteGATTCharacteristic /*, ev: Event*/) {
        if (this.value?.buffer?.byteLength) {
          listener(this.value)
        }
      }
    )
    await this._notify.startNotifications()
  }

  async send(msgOrType: MessageOrType, withoutResponse?: boolean) {
    const data = serializeMessage(msgOrType)
    log(`Sending message of type ${data[0]}`)
    const promise = withoutResponse
      ? this._write.writeValueWithoutResponse(data)
      : this._write.writeValueWithResponse(data)
    await promise
  }
}
