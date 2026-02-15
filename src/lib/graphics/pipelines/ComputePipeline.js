export default class ComputePipeline {
	constructor(device) {
		this.device = device;
		this.pipeline = null;
		this.storageBuffer = null;
		this.readBuffer = null;
		this.bindGroup = null;
		this.shaderCode = null;
	}

	async initialize() {
		try {
			// Load shader code
			const shaderCode = await this.loadShader();
			if (!shaderCode) {
				return false;
			}
			
			// Create shader module
			const shaderModule = this.device.createShaderModule({
				label: "Compute Shader",
				code: shaderCode
			});
			
			// Create pipeline layout
			const bindGroupLayout = this.device.createBindGroupLayout({
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.COMPUTE,
						buffer: {
							type: "storage"
						}
					},
					{
						binding: 1,
						visibility: GPUShaderStage.COMPUTE,
						buffer: {
							type: "storage"
						}
					}
				]
			});
			
			const pipelineLayout = this.device.createPipelineLayout({
				bindGroupLayouts: [bindGroupLayout]
			});
			
			// Create compute pipeline
			this.pipeline = this.device.createComputePipeline({
				layout: pipelineLayout,
				compute: {
					module: shaderModule,
					entryPoint: "main"
				}
			});
			
			// Create bind group
			this.bindGroup = this.createBindGroup();
			if (!this.bindGroup) {
				return false;
			}
			
			return true;
		} catch (error) {
			console.error("Error initializing compute pipeline:", error);
			return false;
		}
	}

	async loadShader() {
		try {
			const response = await fetch('/shaders/compute.wgsl');
			if (response.ok) {
				const shader = await response.text();
				return shader;
			} else {
				console.error("Failed to load compute shader from static directory");
				return null;
			}
		} catch (error) {
			console.error("Error loading compute shader:", error);
			return null;
		}
	}

	createBuffers() {
		// Create the storage buffer for compute data
		this.storageBuffer = this.device.createBuffer({
			label: 'Compute Storage Buffer',
			size: 256 * Float32Array.BYTES_PER_ELEMENT, // Example size (256 floats)
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
		});

		// Create the read buffer for CPU-side data reading
		this.readBuffer = this.device.createBuffer({
			label: 'Compute Read Buffer',
			size: 256 * Float32Array.BYTES_PER_ELEMENT,
			usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST // Only MAP_READ and COPY_DST
		});
	}

	createBindGroup() {
		if (!this.pipeline || !this.storageBuffer || !this.readBuffer) {
			console.error('Pipeline or buffers not initialized for bind group creation.');
			return null;
		}
		
		return this.device.createBindGroup({
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.storageBuffer
					}
				},
				{
					binding: 1,
					resource: {
						buffer: this.readBuffer
					}
				}
			]
		});
	}

	async run() {
		if (!this.pipeline || !this.storageBuffer || !this.readBuffer) {
			console.error('Compute pipeline or buffers are not initialized.');
			return;
		}

		const commandEncoder = this.device.createCommandEncoder();

		// Start the compute pass
		const passEncoder = commandEncoder.beginComputePass();
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.bindGroup);
		passEncoder.dispatchWorkgroups(4); // Adjust based on buffer size and workgroup layout
		passEncoder.end();

		// Copy the data from storageBuffer to readBuffer
		commandEncoder.copyBufferToBuffer(
			this.storageBuffer,
			0,
			this.readBuffer,
			0,
			256 * Float32Array.BYTES_PER_ELEMENT
		);

		// Submit the compute pass
		this.device.queue.submit([commandEncoder.finish()]);

		// Map and read the buffer (optional, for CPU-side usage)
		await this.readBuffer.mapAsync(GPUMapMode.READ);
		const mappedData = new Float32Array(this.readBuffer.getMappedRange());
		this.readBuffer.unmap();
	}

	async readBuffer() {
		try {
			// Create a staging buffer for reading
			const stagingBuffer = this.device.createBuffer({
				size: this.outputBuffer.size,
				usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
			});
			
			// Create command encoder
			const commandEncoder = this.device.createCommandEncoder();
			
			// Copy output buffer to staging buffer
			commandEncoder.copyBufferToBuffer(
				this.outputBuffer,
				0,
				stagingBuffer,
				0,
				stagingBuffer.size
			);
			
			// Submit commands
			this.device.queue.submit([commandEncoder.finish()]);
			
			// Map the staging buffer for reading
			await stagingBuffer.mapAsync(GPUMapMode.READ);
			const mappedData = new Float32Array(stagingBuffer.getMappedRange());
			
			// Get the data
			const data = mappedData.slice();
			
			// Unmap and destroy staging buffer
			stagingBuffer.unmap();
			stagingBuffer.destroy();
			
			return data;
		} catch (error) {
			console.error("Error reading compute buffer:", error);
			return null;
		}
	}

	cleanup() {
		try {
			// Clean up buffers that have destroy method
			if (this.storageBuffer && typeof this.storageBuffer.destroy === 'function') {
				try {
					this.storageBuffer.destroy();
				} catch (e) {
					console.warn("Error destroying storageBuffer:", e);
				}
			}
			this.storageBuffer = null;
			
			if (this.readBuffer && typeof this.readBuffer.destroy === 'function') {
				try {
					this.readBuffer.destroy();
				} catch (e) {
					console.warn("Error destroying readBuffer:", e);
				}
			}
			this.readBuffer = null;
			
			// WebGPU pipelines don't have destroy methods, just nullify references
			this.pipeline = null;
			this.bindGroup = null;
			this.device = null;
			this.shaderCode = null;
		} catch (error) {
			console.error("Error in ComputePipeline cleanup:", error);
		}
	}
}
