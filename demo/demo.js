const connect = async (Pixel) => {
    const pixel = await Pixel.requestPixel();
    console.log("Connecting...");
    await pixel.connect();
    console.log("Done");

    const rollState = await pixel.getRollState();
    console.log(`=> roll state: ${rollState.state}, face ${rollState.faceIndex}`);

    const battery = await pixel.getBatteryLevel();
    console.log(`=> battery: ${battery.level}, ${battery.voltage}v`);

    const rssi = await pixel.getRssi();
    console.log(`=> rssi: ${rssi}`);

    const blink = await pixel.blink(Color.red);
    console.log(`=> blink: ${blink}`);

    // Add listener to get notified when the Pixel roll state changes
    pixel.addEventListener("messageRollState", (ev) => {
    // Or: pixel.addMessageListener(MessageTypeValues.RollState, (ev: CustomEvent<MessageOrType>) => {
        const msg = ev.detail;
        console.log(`=> roll state: ${msg.state}, face ${msg.faceIndex + 1}`);
    });
}


window.requirejs(['/dist/umd/index.js'], (Pixel) => {
    document.addEventListener('click', (event) => {
        connect(Pixel)
    });
});