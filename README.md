# Pixels Web Package

This is the Pixels web package for front end web development.
It enables communications between Pixels dice and a web browser
using Bluetooth Low Energy.

This package relies on the
[*Web Bluetooth API*](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
for accessing Bluetooth.
At the time of writing, only the Chrome, Edge and Opera browsers have support
for this API.

Currently all testing is done with Chrome on Windows 10.
You may need to first set this flag to enable the Bluetooth API:
chrome://flags/#enable-experimental-web-platform-features

Please open a [ticket](https://github.com/GameWithPixels/PixelsWebPackage/issues)
in GitHub if you're having any issue.

This package is based on https://github.com/tomchen/example-typescript-package.

## Getting Started

Start by calling the `requestPixel` function to ask the user to select a Pixel die
to connect to.

This function returns a `Pixel` object.
Call the `connect` asynchronous method to initiate a Bluetooth connection with the die.

The `Pixel` class has a number of methods to retrieve information about the die state.
It also let you add a listener for any Pixel message (as defined in `MessageTypeValues`).

Here is simple code example:

```JavaScript
// Ask user to select a Pixel
const pixel = await requestPixel();
log('Connecting...')
await pixel.connect();

// Get some info
const rollState = await pixel.getRollState();
log(`=> roll state: ${rollState.state}, face ${rollState.face}`);
const battery = await pixel.getBatteryLevel();
log(`=> battery: ${battery.level}, ${battery.voltage}v`);
const rssi = await pixel.getRssi();

// Add listener to get notified when the Pixel state changes
pixel.addMessageListener(MessageTypeValues.RollState, (evt: Event) => {
    const msg = (evt as CustomEvent).detail as RollState
    log(`=> roll state: ${msg.state}, face ${msg.face}`)
```
