const connect = async (Pixel) => {
    const pixel = await Pixel.requestPixel();
    console.log("Connecting...");
    await pixel.connect();
    console.log("Done");
}


window.requirejs(['/dist/umd/index.js'], (Pixel) => {
    document.addEventListener('click', (event) => {
        connect(Pixel)
    });
});

