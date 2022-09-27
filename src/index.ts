// Package based on https://github.com/tomchen/example-typescript-package

// npm install -g typescript
// In %APPDATA%/npm remove or rename tsc.ps1
// npm install --save @types/web-bluetooth
// npm install color
// npm install --save @types/color

// Chrome: chrome://flags/#enable-experimental-web-platform-features
// /!\ This flag might need to be set multiple time depending on how your run chrome
// (normally v.s. from a debug session with VS Code for example)

import {
  DiceTypeValues,
  type DiceType,
  ConnectionEventValues,
  ConnectionEvent,
  ConnectionEventReasonValues,
  ConnectionEventReason,
  ConnectionEventData,
  PixelEventMap,
  Pixel,
} from "./Pixel";

export {
  DiceTypeValues,
  type DiceType,
  ConnectionEventValues,
  ConnectionEvent,
  ConnectionEventReasonValues,
  ConnectionEventReason,
  ConnectionEventData,
  PixelEventMap,
  Pixel,
};

import {
  MessageTypeValues,
  type MessageType,
  PixelMessage,
  type MessageOrType,
  type MessageClass,
  getMessageType,
  isMessage,
  getMessageName,
  instantiateMessage,
  serializeMessage,
  deserializeMessage,
  GenericPixelMessage,
  PixelDesignAndColorValues,
  type PixelDesignAndColor,
  IAmADie,
  PixelRollStateValues,
  type PixelRollState,
  RollState,
  BulkSetup,
  BulkData,
  BulkDataAck,
  TransferAnimationSet,
  TransferAnimationSetAck,
  TransferTestAnimationSet,
  TransferInstantAnimationsSetAckTypeValues,
  type TransferInstantAnimationSetAckType,
  TransferTestAnimationSetAck,
  DebugLog,
  PlaySound,
  Blink,
  BatteryLevel,
  Rssi,
  NotifyUser,
  NotifyUserAck,
  TransferInstantAnimationSet,
  TransferInstantAnimationSetAck,
  PlayInstantAnimation,
} from "./Messages";

export {
  MessageTypeValues,
  type MessageType,
  PixelMessage,
  type MessageOrType,
  type MessageClass,
  getMessageType,
  isMessage,
  getMessageName,
  instantiateMessage,
  serializeMessage,
  deserializeMessage,
  GenericPixelMessage,
  PixelDesignAndColorValues,
  type PixelDesignAndColor,
  IAmADie,
  PixelRollStateValues,
  type PixelRollState,
  RollState,
  BulkSetup,
  BulkData,
  BulkDataAck,
  TransferAnimationSet,
  TransferAnimationSetAck,
  TransferTestAnimationSet,
  TransferInstantAnimationsSetAckTypeValues,
  type TransferInstantAnimationSetAckType,
  TransferTestAnimationSetAck,
  DebugLog,
  PlaySound,
  Blink,
  BatteryLevel,
  Rssi,
  NotifyUser,
  NotifyUserAck,
  TransferInstantAnimationSet,
  TransferInstantAnimationSetAck,
  PlayInstantAnimation,
};
