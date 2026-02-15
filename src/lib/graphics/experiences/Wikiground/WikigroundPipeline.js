class WikigroundPipeline {
    constructor(device, resourceManager) {
      this.device = device;
      this.resourceManager = resourceManager;
      this.isInitialized = false;
      this.isActive = true;
      this.shaderModule = null;
      this.renderPipeline = null;
      this.bindGroup = null;
      this.heightTex = null;
      this.heightView = null;
      this.heightSampler = null;
      this.globeParamsBuffer = null;
    }
  
    async _loadPackedRGBA(pathBin, pathHdr) {
      const [bin, hdr] = await Promise.all([fetch(pathBin), fetch(pathHdr)]);
      if (!bin.ok || !hdr.ok) throw new Error('Failed to fetch DEM assets');
      const u16 = new Uint16Array(await bin.arrayBuffer());
      const hdrText = await hdr.text();
  
      const samples = Number((/samples\s*=\s*(\d+)/i.exec(hdrText) || [])[1]);
      const lines   = Number((/lines\s*=\s*(\d+)/i.exec(hdrText) || [])[1]);
      if (!samples || !lines) throw new Error('Could not parse ENVI header');
  
      const limits = this.device.limits;
      if (samples > limits.maxTextureDimension2D || lines > limits.maxTextureDimension2D) {
        throw new Error(`Height texture ${samples}x${lines} exceeds device limit ${limits.maxTextureDimension2D}`);
      }
  
      // Pack u16 -> RG of RGBA8 (R=hi, G=lo)
      const rgba = new Uint8Array(samples * lines * 4);
      for (let i = 0, j = 0; i < u16.length; i++, j += 4) {
        const v = u16[i];
        rgba[j + 0] = (v >> 8) & 0xff;
        rgba[j + 1] = v & 0xff;
        rgba[j + 2] = 0;
        rgba[j + 3] = 255;
      }
  
      const tex = this.device.createTexture({
        size: { width: samples, height: lines, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
  
      this.device.queue.writeTexture(
        { texture: tex },
        rgba,
        { bytesPerRow: samples * 4, rowsPerImage: lines },
        { width: samples, height: lines, depthOrArrayLayers: 1 }
      );
  
      const sampler = this.device.createSampler({
        addressModeU: 'repeat',
        addressModeV: 'clamp-to-edge',
        magFilter: 'linear',
        minFilter: 'linear',
      });
  
      return { tex, sampler };
    }
  
    async initialize() {
      try {
        // 🔧 Visibility fix: bindings 3,4,5 are used by FRAGMENT too
        this.bindGroupLayout = this.device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // proj
            { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // view
            { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // time/radius
            { binding: 3, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // heightTex
            { binding: 4, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },   // sampler
            { binding: 5, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },      // GlobeParams
          ],
        });
  
        this.pipelineLayout = this.device.createPipelineLayout({
          bindGroupLayouts: [this.bindGroupLayout],
        });
  
        await this.initializeShader('/shaders/wikiground/wikigroundShader.wgsl');
  
        const { tex, sampler } = await this._loadPackedRGBA(
          '/assets/etopo_8k_u16.bin',
          '/assets/etopo_8k_u16.hdr'
        );
        this.heightTex = tex;
        this.heightView = this.heightTex.createView();
        this.heightSampler = sampler;
  
        const a = 6378137.0;
        const f = 1.0 / 298.257223563;
        const elevMin = -11000.0;
        const elevMax =  9000.0;
        const scaleChange = 0.0000001
        const baseScale = 1.0 * scaleChange;
  
        this.globeParamsBuffer = this.device.createBuffer({
          size: 5 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(
          this.globeParamsBuffer,
          0,
          new Float32Array([a, f, elevMin, elevMax, baseScale])
        );
  
        this.isInitialized = true;
        return true;
      } catch (error) {
        console.error('Error initializing Wikiground pipeline:', error);
        return false;
      }
    }
  
    async initializeShader(shaderPath) {
      try {
        const response = await fetch(shaderPath);
        if (!response.ok) throw new Error(`Failed to fetch shader: ${response.statusText}`);
        const shaderCode = await response.text();
  
        this.shaderModule = this.device.createShaderModule({
          code: shaderCode,
          label: 'Wikiground Sphere Shader',
        });
  
        this.renderPipeline = this.device.createRenderPipeline({
          layout: this.pipelineLayout,
          vertex: {
            module: this.shaderModule,
            entryPoint: 'vertexMain',
            buffers: [{
              arrayStride: 12,
              attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
            }],
          },
          fragment: {
            module: this.shaderModule,
            entryPoint: 'fragmentMain',
            targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
          },
          primitive: { topology: 'triangle-list', cullMode: 'back' },
          depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
        });
  
        return true;
      } catch (error) {
        console.error('Error initializing Wikiground shader:', error);
        return false;
      }
    }
  
    render(commandEncoder, textureView, depthTextureView, vertexBuffer, indexBuffer, uniformBuffer, indexCount) {
      if (!this.isInitialized || !this.renderPipeline || !this.isActive) return;
      if (!depthTextureView) {
        console.warn('Skipping render: depthTextureView is null');
        return;
      }
  
      try {
        const { projectionBuffer, viewBuffer } = this.resourceManager.camera.getBuffers();
  
        const bindGroup = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: projectionBuffer } },
            { binding: 1, resource: { buffer: viewBuffer } },
            { binding: 2, resource: { buffer: uniformBuffer } },
            { binding: 3, resource: this.heightView },
            { binding: 4, resource: this.heightSampler },
            { binding: 5, resource: { buffer: this.globeParamsBuffer } },
          ],
        });
  
        const renderPassDescriptor = {
          colorAttachments: [{
            view: textureView,
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          }],
          depthStencilAttachment: {
            view: depthTextureView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
        };
  
        const pass = commandEncoder.beginRenderPass(renderPassDescriptor);
        pass.setPipeline(this.renderPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.setIndexBuffer(indexBuffer, 'uint32');
        pass.drawIndexed(indexCount);
        pass.end();
      } catch (error) {
        console.error('Error in Wikiground Pipeline render:', error);
      }
    }
  
    cleanup() {
      this.isInitialized = false;
      this.isActive = false;
      try {
        if (this.shaderModule && this.resourceManager) {
          this.resourceManager.unregisterResource?.(this.shaderModule, 'shaderModules');
          this.shaderModule = null;
        }
        if (this.renderPipeline && this.resourceManager) {
          this.resourceManager.unregisterResource?.(this.renderPipeline, 'pipelines');
          this.renderPipeline = null;
        }
        if (this.bindGroup && this.resourceManager) {
          this.resourceManager.unregisterResource?.(this.bindGroup, 'bindGroups');
          this.bindGroup = null;
        }
        this.bindGroupLayout = null;
        this.pipelineLayout = null;
  
        this.device = null;
        this.resourceManager = null;
      } catch (error) {
        console.error('Error during WikigroundPipeline cleanup:', error);
      }
    }
  }
  
  export default WikigroundPipeline;
  