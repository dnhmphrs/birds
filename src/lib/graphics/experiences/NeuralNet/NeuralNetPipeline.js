import Pipeline from '../../pipelines/Pipeline';

export default class NeuralNetPipeline extends Pipeline {
	constructor(device, camera, viewportBuffer, mouseBuffer, neuronCount, dendriteCount) {
		super(device);
		this.device = device;
		this.camera = camera;
		this.viewportBuffer = viewportBuffer;
		this.mouseBuffer = mouseBuffer;
		this.neuronCount = neuronCount;
		this.dendriteCount = dendriteCount;

		// Buffers for neuron-specific data
		this.activityBuffer = null;
		this.positionBuffer = null;
		this.dendriteVertexBuffer = null;
		
		// Field lines for magnetic field visualization
		this.fieldLineVertexBuffer = null;
		this.fieldLineVertexCount = 0;
		this.fieldLinePipeline = null;
		this.fieldLineBindGroup = null;
		
		// Shader code
		this.shaderCode = null;
	}

	async initialize() {
		const format = navigator.gpu.getPreferredCanvasFormat();
		const { projectionBuffer, viewBuffer } = this.camera.getBuffers();

		// Fetch the shader from the static directory
		try {
			const response = await fetch('/shaders/neuralnet/neuronShader.wgsl');
			if (response.ok) {
				this.shaderCode = await response.text();
			}
		} catch (error) {
			console.error("Error loading neuron shader:", error);
			return;
		}

		// Ensure sizes are aligned to 4 bytes
		const alignTo4Bytes = (size) => Math.ceil(size / 4) * 4;

		// Calculate the required sizes
		const activityBufferSize = alignTo4Bytes(this.neuronCount * Float32Array.BYTES_PER_ELEMENT);
		const positionBufferSize = alignTo4Bytes(this.neuronCount * 16); // 16 bytes per position due to alignment

		// Create buffers
		this.activityBuffer = this.device.createBuffer({
			size: activityBufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Activity Buffer'
		});

		this.positionBuffer = this.device.createBuffer({
			size: positionBufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			label: 'Position Buffer'
		});

		// Neuron bind group layout
		const neuronBindGroupLayout = this.device.createBindGroupLayout({
			label: 'Neuron Pipeline Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
				{ binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Positions
				{ binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }, // Activities
				{ binding: 7, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } // Mouse Position
			]
		});

		// Dendrite bind group layout
		const dendriteBindGroupLayout = this.device.createBindGroupLayout({
			label: 'Dendrite Pipeline Bind Group Layout',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // Projection Matrix
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // View Matrix
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Viewport Size
				{ binding: 7, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } // Mouse Position
			]
		});

		// Create neuron pipeline
		this.neuronPipeline = this.device.createRenderPipeline({
			label: 'Neuron Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [neuronBindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: this.shaderCode }),
				entryPoint: 'vertex_main_neuron',
				buffers: [
					{
						arrayStride: 12, // Each vertex is 3 floats (x, y, z)
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: this.shaderCode }),
				entryPoint: 'fragment_main_neuron',
				targets: [
					{
						format: format,
						blend: {
							color: {
								srcFactor: 'src-alpha',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							},
							alpha: {
								srcFactor: 'one',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							}
						},
						writeMask: GPUColorWrite.ALL
					}
				]
			},
			primitive: {
				topology: 'line-list'
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'less'
			}
		});

		// Create dendrite pipeline
		this.dendritePipeline = this.device.createRenderPipeline({
			label: 'Dendrite Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [dendriteBindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: this.shaderCode }),
				entryPoint: 'vertex_main_dendrite',
				buffers: [
					{
						arrayStride: 12, // Each vertex is 3 floats (x, y, z)
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: this.shaderCode }),
				entryPoint: 'fragment_main_dendrite',
				targets: [
					{
						format: format,
						blend: {
							color: {
								srcFactor: 'src-alpha',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							},
							alpha: {
								srcFactor: 'one',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							}
						},
						writeMask: GPUColorWrite.ALL
					}
				]
			},
			primitive: {
				topology: 'line-list'
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'less'
			}
		});

		// Create neuron bind group
		this.neuronBindGroup = this.device.createBindGroup({
			layout: neuronBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: projectionBuffer } },
				{ binding: 1, resource: { buffer: viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 3, resource: { buffer: this.positionBuffer } },
				{ binding: 4, resource: { buffer: this.activityBuffer } },
				{ binding: 7, resource: { buffer: this.mouseBuffer } }
			]
		});

		// Create dendrite bind group
		this.dendriteBindGroup = this.device.createBindGroup({
			layout: dendriteBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: projectionBuffer } },
				{ binding: 1, resource: { buffer: viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 7, resource: { buffer: this.mouseBuffer } }
			]
		});
		
		// Create field line pipeline (same as dendrite but different color in shader)
		this.fieldLinePipeline = this.device.createRenderPipeline({
			label: 'Field Line Render Pipeline',
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [dendriteBindGroupLayout] }),
			vertex: {
				module: this.device.createShaderModule({ code: this.shaderCode }),
				entryPoint: 'vertex_main_fieldline',
				buffers: [
					{
						arrayStride: 12,
						attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({ code: this.shaderCode }),
				entryPoint: 'fragment_main_fieldline',
				targets: [
					{
						format: format,
						blend: {
							color: {
								srcFactor: 'src-alpha',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							},
							alpha: {
								srcFactor: 'one',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add'
							}
						},
						writeMask: GPUColorWrite.ALL
					}
				]
			},
			primitive: {
				topology: 'line-strip'
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'less'
			}
		});
		
		this.fieldLineBindGroup = this.device.createBindGroup({
			layout: dendriteBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: projectionBuffer } },
				{ binding: 1, resource: { buffer: viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 7, resource: { buffer: this.mouseBuffer } }
			]
		});
	}

	render(commandEncoder, passDescriptor, objects) {
		const passEncoder = commandEncoder.beginRenderPass(passDescriptor);

		// Render neurons
		passEncoder.setPipeline(this.neuronPipeline);
		passEncoder.setBindGroup(0, this.neuronBindGroup);

		const firstObject = objects[0]; // Assuming all neurons share the same geometry
		passEncoder.setVertexBuffer(0, firstObject.getVertexBuffer());
		passEncoder.setIndexBuffer(firstObject.getIndexBuffer(), 'uint16');

		passEncoder.drawIndexed(firstObject.getIndexCount(), this.neuronCount, 0, 0, 0);

		// Render dendrites
		passEncoder.setPipeline(this.dendritePipeline);
		passEncoder.setBindGroup(0, this.dendriteBindGroup);

		passEncoder.setVertexBuffer(0, this.dendriteVertexBuffer);

		// Each dendrite consists of two vertices
		passEncoder.draw(2 * this.dendriteCount, 1, 0, 0);
		
		// Render field lines (if available)
		if (this.fieldLineVertexBuffer && this.fieldLineVertexCount > 0 && this.fieldLineLengths) {
			passEncoder.setPipeline(this.fieldLinePipeline);
			passEncoder.setBindGroup(0, this.fieldLineBindGroup);
			passEncoder.setVertexBuffer(0, this.fieldLineVertexBuffer);
			
			// Draw each field line as a separate line-strip
			let vertexOffset = 0;
			for (const lineLength of this.fieldLineLengths) {
				if (lineLength > 1) {
					passEncoder.draw(lineLength, 1, vertexOffset, 0);
				}
				vertexOffset += lineLength;
			}
		}

		passEncoder.end();
	}

	updateConnections(connections, positions) {
		// Flatten dendrite positions into a Float32Array
		const dendritePositions = new Float32Array(connections.length * 6);

		connections.forEach((connection, i) => {
			const sourcePosition = positions[connection.source];
			const targetPosition = positions[connection.target];
			dendritePositions.set([...sourcePosition, ...targetPosition], i * 6);
		});

		// Create the dendrite vertex buffer
		if (this.dendriteVertexBuffer) {
			this.dendriteVertexBuffer.destroy();
		}

		this.dendriteVertexBuffer = this.device.createBuffer({
			size: dendritePositions.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			label: 'Dendrite Vertex Buffer'
		});

		this.device.queue.writeBuffer(this.dendriteVertexBuffer, 0, dendritePositions);

		// Update dendrite count
		this.dendriteCount = connections.length;
	}

	/**
	 * Update activity from chip firing simulation
	 * This replaces the old updateActivity method
	 */
	updateActivityFromChipFiring(activityArray, sinkNodeIndex = -1) {
		if (!activityArray || activityArray.length !== this.neuronCount) {
			console.error('Invalid activity array provided');
			return;
		}

		// Convert to Float32Array and update buffer
		const activities = new Float32Array(activityArray);
		
		// Mark sink node with special value (-1.0) so shader can identify it
		if (sinkNodeIndex >= 0 && sinkNodeIndex < this.neuronCount) {
			activities[sinkNodeIndex] = -1.0;
		}
		
		this.device.queue.writeBuffer(this.activityBuffer, 0, activities);
	}

	updatePositions(positions) {
		this.positions = positions; // Store positions locally

		// Create a Float32Array with padding (16 bytes per position)
		const paddedPositions = new Float32Array(this.neuronCount * 4); // 4 floats per position
		for (let i = 0; i < this.neuronCount; i++) {
			paddedPositions[i * 4 + 0] = positions[i][0];
			paddedPositions[i * 4 + 1] = positions[i][1];
			paddedPositions[i * 4 + 2] = positions[i][2];
			paddedPositions[i * 4 + 3] = 0; // Padding
		}

		this.device.queue.writeBuffer(this.positionBuffer, 0, paddedPositions);
	}
	
	/**
	 * Update field lines from magnetic field computation
	 */
	updateFieldLines(fieldLines) {
		if (!fieldLines || fieldLines.length === 0) {
			this.fieldLineVertexCount = 0;
			return;
		}
		
		// Flatten all field lines into single vertex buffer
		// Each line is a series of 3D points
		const vertices = [];
		
		for (const line of fieldLines) {
			for (const point of line) {
				vertices.push(point[0], point[1], point[2]);
			}
		}
		
		if (vertices.length === 0) {
			this.fieldLineVertexCount = 0;
			return;
		}
		
		const vertexData = new Float32Array(vertices);
		
		// Create or update field line vertex buffer
		if (this.fieldLineVertexBuffer) {
			this.fieldLineVertexBuffer.destroy();
		}
		
		this.fieldLineVertexBuffer = this.device.createBuffer({
			size: vertexData.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			label: 'Field Line Vertex Buffer'
		});
		
		this.device.queue.writeBuffer(this.fieldLineVertexBuffer, 0, vertexData);
		this.fieldLineVertexCount = vertices.length / 3;
		
		// Store line lengths for rendering
		this.fieldLineLengths = fieldLines.map(line => line.length);
	}

	cleanup() {
		try {
			// Clean up buffers
			if (this.activityBuffer) {
				try {
					this.activityBuffer.destroy();
				} catch (e) {
					console.warn("Error destroying activityBuffer:", e);
				}
				this.activityBuffer = null;
			}
			
			if (this.positionBuffer) {
				try {
					this.positionBuffer.destroy();
				} catch (e) {
					console.warn("Error destroying positionBuffer:", e);
				}
				this.positionBuffer = null;
			}
			
			if (this.dendriteVertexBuffer) {
				try {
					this.dendriteVertexBuffer.destroy();
				} catch (e) {
					console.warn("Error destroying dendriteVertexBuffer:", e);
				}
				this.dendriteVertexBuffer = null;
			}
			
			// Clean up other resources
			this.neuronPipeline = null;
			this.dendritePipeline = null;
			this.neuronBindGroup = null;
			this.dendriteBindGroup = null;
			
			// Call parent cleanup
			super.cleanup();
		} catch (error) {
			console.error("Error in NeuralNetPipeline cleanup:", error);
		}
	}
}