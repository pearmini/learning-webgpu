# Fundamentals

> [tutorial](https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html)

WebGPU can only do two things:

- Draw triangles/points/lines to textures by _Vertex_ and _Fragment Shaders_
- Run computations on GPU with _Compute Shaders_

A Vertex Shader computes vertices. The shader returns vertex positions. For every group of 3 vertices the vertex shader returns, a triangle is drawn between those 3 positions. A vertex shader returns a vertex on vertex position index.

A Fragment Shader computes colors. When a triangle is drawn, for each pixels to be drawn the GPU calls your fragment shader. A fragment shader returns a color for the current pixels.

A Compute Shader is just a function you can and say "execute this function N times". Thinks of these functions as similar to _Array.prototype.map_ which is called on _index_ and input _datum_.

A texture is a 2D rectangle of pixels.

## Draw triangles to textures

Drawing shapes starts with requesting a _device_ and ends with submitting a _command_ its queue: `device.queue.submit([commandBuffer])`. Between these two steps, you need to create all of resources and set up the state.

![webgpu-draw-diagram](https://webgpufundamentals.org/webgpu/lessons/resources/webgpu-draw-diagram.svg)

The key steps,

- Create a rendering context.
- Create a shader module.
- Create a render pipeline.
- Create a command encoder.

```js eval
drawTrianglesToTextures();
```

```js eval
async function drawTrianglesToTextures(
  canvas = document.createElement("canvas")
) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  if (!device) {
    fail("need a browser that supports WebGPU");
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const context = canvas.getContext("webgpu");
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const module = device.createShaderModule({
    label: "our hardcoded red triangle shaders",
    code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1, 0, 0, 1);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: "our hardcoded red triangle pipeline",
    layout: "auto",
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  });

  const renderPassDescriptor = {
    label: "our basic canvas renderPass",
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  function render() {
    // Get the current texture from the canvas context and
    // set it as the texture to render to.
    renderPassDescriptor.colorAttachments[0].view = context
      .getCurrentTexture()
      .createView();

    // make a command encoder to start encoding commands
    const encoder = device.createCommandEncoder({ label: "our encoder" });

    // make a render pass encoder to encode render specific commands
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.draw(3); // call our vertex shader 3 times.
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  render();

  return canvas;
}
```

## Run computations on GPU

The keys for running computations on GPU,

- A compute shader
- A compute pipeline
- A work buffer to hold input and output
- A bindGroup to tell the shader which buffer to use for the computation
- A result buffer to reading the result

![webgpu-simple-compute-diagram](https://webgpufundamentals.org/webgpu/lessons/resources/webgpu-simple-compute-diagram.svg)

```js eval
doubleGPU([1, 3, 5]);
```

```js eval
async function doubleGPU(numbers) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  if (!device) {
    fail("need a browser that supports WebGPU");
    return;
  }

  const module = device.createShaderModule({
    label: "doubling compute module",
    code: `
      @group(0) @binding(0) var<storage, read_write> data: array<f32>;

      @compute @workgroup_size(1) fn computeSomething(
        @builtin(global_invocation_id) id: vec3u
      ) {
        let i = id.x;
        data[i] = data[i] * 2.0;
      }
    `,
  });

  const pipeline = device.createComputePipeline({
    label: "doubling compute pipeline",
    layout: "auto",
    compute: {
      module,
    },
  });

  const input = new Float32Array(numbers);

  // create a buffer on the GPU to hold our computation
  // input and output
  const workBuffer = device.createBuffer({
    label: "work buffer",
    size: input.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });
  // Copy our input data to that buffer
  device.queue.writeBuffer(workBuffer, 0, input);

  // create a buffer on the GPU to get a copy of the results
  const resultBuffer = device.createBuffer({
    label: "result buffer",
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // Setup a bindGroup to tell the shader which
  // buffer to use for the computation
  const bindGroup = device.createBindGroup({
    label: "bindGroup for work buffer",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: workBuffer } }],
  });

  // Encode commands to do the computation
  const encoder = device.createCommandEncoder({
    label: "doubling encoder",
  });
  const pass = encoder.beginComputePass({
    label: "doubling compute pass",
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(input.length);
  pass.end();

  // Encode a command to copy the results to a mappable buffer.
  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);

  // Finish encoding and submit the commands
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  // Read the results
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange().slice());
  resultBuffer.unmap();

  return result;
}
```

## Canvas dimensions and resolution

Just like normal _context2d_, WebGPU needs to resolve the issue of blurry content on the high-resolution displays (such as Retina screens).

The method here is to match the canvas's physical pixel dimensions to the device's _devicePixelRatio_:

```js eval
high = Inputs.toggle({ label: "High Resolution", value: true });
```

```js eval t=braces
{
  const canvas = document.createElement("canvas");
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.style.width = width + "px";
  canvas.style.height = width * 0.618 + "px";

  if (!high) return drawTrianglesToTextures(canvas);

  requestAnimationFrame(() => {
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;
    drawTrianglesToTextures(canvas);
  });
  return canvas;
}
```

## Appendix

```js eval
function fail(msg) {
  alert(msg);
}
```
