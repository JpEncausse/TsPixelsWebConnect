const constants = {
  /** Pixel dice service UUID. */
  PixelServiceUuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",

  /** Pixel dice notify characteristic UUID. */
  PixelNotifyCharacteristicUuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",

  /** Pixel dice write characteristic UUID. */
  PixelWriteCharacteristicUuid: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",

  MaxMtu: 512,

  AckMessageTimeout: 5000,

  MaxMessageSize: 100,
} as const;

export default constants;
