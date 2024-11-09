# Inter-stage Variables

> [tutorial](https://webgpufundamentals.org/webgpu/lessons/webgpu-inter-stage-variables.html)

Inter-stage Variables are used to pass data from vertex shader to fragment shader. Here the vertex shader output extra color values by declare a custom struct: _OurVertexShaderOutput_. In the fragment shader, we declare it to take one of these structs as an argument to the function and finally returning the color.

```js eval
drawTriangleWithShader({
  label: "our hardcoded rgb triangle shaders",
  code: `
    struct OurVertexShaderOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    };

    @vertex fn vs(
      @builtin(vertex_index) vertexIndex : u32
    ) -> OurVertexShaderOutput {
      let pos = array(
        vec2f( 0.0,  0.5),  // top center
        vec2f(-0.5, -0.5),  // bottom left
        vec2f( 0.5, -0.5)   // bottom right
      );

      var color = array<vec4f, 3>(
        vec4f(1, 0, 0, 1), // red
        vec4f(0, 1, 0, 1), // green
        vec4f(0, 0, 1, 1), // blue
      );

      var vsOutput: OurVertexShaderOutput;
      vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
      vsOutput.color = color[vertexIndex];
      return vsOutput;
    }

    @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
      return fsInput.color;
    }
  `,
});
```

## Connect by _location_

Inter-stage Variables are connected by _location_. They can access the same variables at the specified location.

```js eval
drawTriangleWithFragmentShader(`
  @fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
    return color;
  }
`);
```

## _@builtin(position)_

_@builtin(position)_ is not a inter-stage variable. For vertex shader, it is the output coordinate that the GPU used to draw triangles/lines/points, while it is the input coordinate of the the pixel that being asked to compute a color for fragment shader.

```js eval
drawTriangleWithShader({
  label: "hardcoded checkerboard triangle shaders",
  code: `
    struct OurVertexShaderOutput {
      @builtin(position) position: vec4f,
    };

    @vertex fn vs(
      @builtin(vertex_index) vertexIndex : u32
    ) -> OurVertexShaderOutput {
      let pos = array(
        vec2f( 0.0,  0.5),  // top center
        vec2f(-0.5, -0.5),  // bottom left
        vec2f( 0.5, -0.5)   // bottom right
      );

      var vsOutput: OurVertexShaderOutput;
      vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
      return vsOutput;
    }

    @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
      let red = vec4f(1, 0, 0, 1);
      let cyan = vec4f(0, 1, 1, 1);

      let grid = vec2u(fsInput.position.xy) / 8;
      let checker = (grid.x + grid.y) % 2 == 1;

      return select(red, cyan, checker);
    }
  `,
});
```

Although the fact that vertex shader and fragment shader are in the same string is a convenience, it is better to split them into separate modules. In this way, you won't duplicate all of them, once for each entry point.

```js eval t=braces
{
  const vsModule = {
    label: "hardcoded triangle",
    code: `
      struct OurVertexShaderOutput {
        @builtin(position) position: vec4f,
      };

      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> OurVertexShaderOutput {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        var vsOutput: OurVertexShaderOutput;
        vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        return vsOutput;
      }
    `,
  };

  const fsModule = {
    label: "checkerboard",
    code: `
      @fragment fn fs(@builtin(position) pixelPosition: vec4f) -> @location(0) vec4f {
        let red = vec4f(1, 0, 0, 1);
        let cyan = vec4f(0, 1, 1, 1);

        let grid = vec2u(pixelPosition.xy) / 8;
        let checker = (grid.x + grid.y) % 2 == 1;

        return select(red, cyan, checker);
      }
    `,
  };

  return drawTriangleWithShader(vsModule, fsModule);
}
```

## Appendix

```js eval code=false
function fail(msg) {
  alert(msg);
}
```

```js eval code=false
function drawTriangleWithFragmentShader(fragment) {
  return drawTriangleWithShader({
    label: "our hardcoded rgb triangle shaders",
    code: `
    struct OurVertexShaderOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    };

    @vertex fn vs(
      @builtin(vertex_index) vertexIndex : u32
    ) -> OurVertexShaderOutput {
      let pos = array(
        vec2f( 0.0,  0.5),  // top center
        vec2f(-0.5, -0.5),  // bottom left
        vec2f( 0.5, -0.5)   // bottom right
      );

      var color = array<vec4f, 3>(
        vec4f(1, 0, 0, 1), // red
        vec4f(0, 1, 0, 1), // green
        vec4f(0, 0, 1, 1), // blue
      );

      var vsOutput: OurVertexShaderOutput;
      vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
      vsOutput.color = color[vertexIndex];
      return vsOutput;
    }

    ${fragment}
  `,
  });
}
```

```js eval code=false
async function drawTriangleWithShader(shader, fragmentShader) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  if (!device) {
    fail("need a browser that supports WebGPU");
    return;
  }

  // Get a WebGPU context from the canvas and configure it
  const canvas = document.createElement("canvas");
  const devicePixelRatio = window.devicePixelRatio || 1;

  const context = canvas.getContext("webgpu");
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
  });

  const module = device.createShaderModule(shader);

  const pipeline = device.createRenderPipeline({
    label: "our hardcoded red triangle pipeline",
    layout: "auto",
    vertex: {
      module,
    },
    fragment: {
      module: fragmentShader
        ? device.createShaderModule(fragmentShader)
        : module,
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
