importScripts("engine.js");
onmessage = async ({data}) => {
  try {
    const canvas = new OffscreenCanvas(data.width, data.height);
    CubeEngine.render(canvas, data.graph, data.options);
    postMessage({blob: await canvas.convertToBlob({type:"image/png"})});
  } catch(error) { postMessage({error:error.message}); }
};
