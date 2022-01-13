import { MessageOrType, serializeMessage, deserializeMessage } from './Messages'

// Direct access to log
const log = console.log

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
  private _session: Session | null = null

  // Instantiates a Pixel from a Bluetooth device.
  constructor(device: BluetoothDevice) {
    this._device = device
  }

  // Asynchronously connects to the Pixel.
  async connect(): Promise<void> {
    if (this._device?.gatt) {
      // Attempt to connect.
      log('Pixel: gatt connect')
      const server = await this._device.gatt.connect()
      log('Pixel: get service and characteristics')
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
      log('Pixel: subscribe')
      await this._session.subscribe()
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

  // Asynchronously sends a message to the Pixel.
  async sendMessage(
    message_or_type: MessageOrType,
    withoutResponse?: boolean
  ): Promise<void> {
    if (this._device?.gatt && this._session) {
      await this._session.send(message_or_type, withoutResponse)
    }
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

  async subscribe() {
    this._notify.addEventListener(
      'characteristicvaluechanged',
      this.onValueChanged
    )
    await this._notify.startNotifications()
  }

  async send(message_or_type: MessageOrType, withoutResponse?: boolean) {
    const data = serializeMessage(message_or_type)
    log(`Sending message of type ${data[0]}`)
    const promise = withoutResponse
      ? this._write.writeValueWithoutResponse(data)
      : this._write.writeValueWithResponse(data)
    await promise
  }

  private onValueChanged(
    this: BluetoothRemoteGATTCharacteristic /*, ev: Event*/
  ) {
    try {
      if (this.value?.buffer?.byteLength) {
        const message_or_type = deserializeMessage(this.value.buffer)
        if (message_or_type) {
          if (typeof message_or_type === 'number') {
            log(`Received message of type ${message_or_type}`)
          } else {
            log(`Received message ${message_or_type}`)
          }
        } else {
          log('Received invalid message!')
        }
      }
    } catch (error) {
      log('ValueChanged error: ' + error)
    }
  }
}
