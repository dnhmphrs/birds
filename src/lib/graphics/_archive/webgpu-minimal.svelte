<script>
  import { onMount } from 'svelte';

  let canvas;
  let context;
  let aspectRatio;

  onMount(() => {
    async function initializeWebGPU() {
      if (!navigator.gpu) {
        console.error('WebGPU is not supported in this browser.');
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error('Failed to get GPU adapter.');
        return;
      }

      const device = await adapter.requestDevice();
      context = canvas.getContext('webgpu');

      if (!context) {
        console.error('Failed to initialize WebGPU context.');
        return;
      }

      // Configure the WebGPU canvas context
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'opaque',
      });

      // Initial render
      resizeCanvas();
      render(device, format);

      // Resize event listener
      window.addEventListener('resize', resizeCanvas);
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }

    // Handle resizing the canvas
    function resizeCanvas() {
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(canvas.clientWidth * devicePixelRatio);
      canvas.height = Math.floor(canvas.clientHeight * devicePixelRatio);
      aspectRatio = canvas.width / canvas.height;
    }

    // Render function to clear the screen with red color
    function render(device, format) {
      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();

      const renderPassDescriptor = {
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 1, g: 0, b: 0, a: 1 }, // red background
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);

      requestAnimationFrame(() => render(device, format));
    }

    // Initialize WebGPU on mount
    initializeWebGPU();
  });
</script>

<canvas bind:this={canvas} class="geometry"></canvas>

<style>
.geometry {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  padding: 0;
  margin: 0;
  border: none;
  z-index: -1;
  /* opacity: 0;
  transition: opacity 0.5s ease-in-out; */
}

</style>
