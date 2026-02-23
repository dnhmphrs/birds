import { initWebGPU } from './core/WebGPU.js';
import { Camera, CameraController } from './camera/Camera.js';
import { PredatorCamera } from './camera/PredatorCamera.js';
import { createBirdGeometry, createPredatorGeometry } from './flocking/Geometry.js';

const BIRD_COUNT = 8192;
const BOUNDS = 2500;

export class FlockingEngine {
	constructor(canvas) {
		this.canvas = canvas;
		this.running = false;
		this.lastTime = performance.now();
		this.lastTargetChange = this.lastTime;
		this.targetChangeInterval = 10000;
	}

	async init() {
		const { device, context, format } = await initWebGPU(this.canvas);
		this.device = device;
		this.context = context;
		this.format = format;

		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		this.canvasWidth = width;
		this.canvasHeight = height;
		this.canvas.width = width;
		this.canvas.height = height;

		this.camera = new Camera(device, width, height);
		this.cameraController = new CameraController(this.camera);
		this.predatorCamera = new PredatorCamera(device);

		this.createDepthTexture(width, height);
		this.createBuffers();
		await this.createPipelines();
		this.initBoids();
		this.setupEvents();

		this.running = true;
		this.render();
	}

	createDepthTexture(width, height) {
		this.depthTexture?.destroy();
		this.depthTexture = this.device.createTexture({
			size: { width, height },
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT
		});
	}

	createBuffers() {
		const device = this.device;

		this.positionBuffer = device.createBuffer({
			size: BIRD_COUNT * 3 * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		});

		this.velocityBuffer = device.createBuffer({
			size: BIRD_COUNT * 3 * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		});

		this.phaseBuffer = device.createBuffer({
			size: BIRD_COUNT * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		});

		this.predatorPosBuffer = device.createBuffer({
			size: 12,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
		});

		this.predatorVelBuffer = device.createBuffer({
			size: 12,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
		});

		this.targetIndexBuffer = device.createBuffer({
			size: 4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.deltaTimeBuffer = device.createBuffer({
			size: 4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.flockingParamsBuffer = device.createBuffer({
			size: 32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.viewportBuffer = device.createBuffer({
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.mouseBuffer = device.createBuffer({
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.guidingLineBuffer = device.createBuffer({
			size: 32,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
		});

		this.birdGeom = createBirdGeometry(device);
		this.predatorGeom = createPredatorGeometry(device);

		const params = new Float32Array([250.0, 5.0, 10.0, 0, 0, 0, 0, 0]);
		device.queue.writeBuffer(this.flockingParamsBuffer, 0, params);
	}

	async createPipelines() {
		const device = this.device;

		const [birdShader, predatorShader, bgShader, flockingShader, huntingShader, lineShader, borderShader] =
			await Promise.all([
				fetch('/shaders/bird.wgsl').then(r => r.text()),
				fetch('/shaders/predator.wgsl').then(r => r.text()),
				fetch('/shaders/background.wgsl').then(r => r.text()),
				fetch('/shaders/flocking.wgsl').then(r => r.text()),
				fetch('/shaders/hunting.wgsl').then(r => r.text()),
				fetch('/shaders/line.wgsl').then(r => r.text()),
				fetch('/shaders/border.wgsl').then(r => r.text())
			]);

		// Flocking compute
		const flockingLayout = device.createBindGroupLayout({
			entries: [
				{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
				{ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
				{ binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
				{ binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
				{ binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
				{ binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }
			]
		});

		this.flockingPipeline = device.createComputePipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [flockingLayout] }),
			compute: { module: device.createShaderModule({ code: flockingShader }), entryPoint: 'main' }
		});

		this.flockingBindGroup = device.createBindGroup({
			layout: flockingLayout,
			entries: [
				{ binding: 0, resource: { buffer: this.deltaTimeBuffer } },
				{ binding: 1, resource: { buffer: this.positionBuffer } },
				{ binding: 2, resource: { buffer: this.velocityBuffer } },
				{ binding: 3, resource: { buffer: this.phaseBuffer } },
				{ binding: 4, resource: { buffer: this.flockingParamsBuffer } },
				{ binding: 5, resource: { buffer: this.predatorPosBuffer } },
				{ binding: 6, resource: { buffer: this.predatorVelBuffer } }
			]
		});

		// Hunting compute
		const huntingLayout = device.createBindGroupLayout({
			entries: [
				{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
				{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
				{ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
				{ binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
				{ binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
			]
		});

		this.huntingPipeline = device.createComputePipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [huntingLayout] }),
			compute: { module: device.createShaderModule({ code: huntingShader }), entryPoint: 'main' }
		});

		this.huntingBindGroup = device.createBindGroup({
			layout: huntingLayout,
			entries: [
				{ binding: 0, resource: { buffer: this.positionBuffer } },
				{ binding: 1, resource: { buffer: this.predatorPosBuffer } },
				{ binding: 2, resource: { buffer: this.predatorVelBuffer } },
				{ binding: 3, resource: { buffer: this.targetIndexBuffer } },
				{ binding: 4, resource: { buffer: this.guidingLineBuffer } }
			]
		});

		// Bird render
		this.birdBindGroupLayout = device.createBindGroupLayout({
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
				{ binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
				{ binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 6, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }
			]
		});

		this.birdPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.birdBindGroupLayout] }),
			vertex: {
				module: device.createShaderModule({ code: birdShader }),
				entryPoint: 'vertex_main',
				buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }]
			},
			fragment: {
				module: device.createShaderModule({ code: birdShader }),
				entryPoint: 'fragment_main',
				targets: [{ format: this.format }]
			},
			depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
		});

		this.birdBindGroup = device.createBindGroup({
			layout: this.birdBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: this.camera.projectionBuffer } },
				{ binding: 1, resource: { buffer: this.camera.viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 3, resource: { buffer: this.positionBuffer } },
				{ binding: 4, resource: { buffer: this.phaseBuffer } },
				{ binding: 5, resource: { buffer: this.mouseBuffer } },
				{ binding: 6, resource: { buffer: this.velocityBuffer } }
			]
		});

		// Predator render
		const predatorLayout = device.createBindGroupLayout({
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
				{ binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
				{ binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }
			]
		});

		this.predatorPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [predatorLayout] }),
			vertex: {
				module: device.createShaderModule({ code: predatorShader }),
				entryPoint: 'vertex_main',
				buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }]
			},
			fragment: {
				module: device.createShaderModule({ code: predatorShader }),
				entryPoint: 'fragment_main',
				targets: [{ format: this.format }]
			},
			depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
		});

		this.predatorBindGroup = device.createBindGroup({
			layout: predatorLayout,
			entries: [
				{ binding: 0, resource: { buffer: this.camera.projectionBuffer } },
				{ binding: 1, resource: { buffer: this.camera.viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 3, resource: { buffer: this.predatorPosBuffer } },
				{ binding: 4, resource: { buffer: this.predatorVelBuffer } }
			]
		});

		// Background render
		const bgLayout = device.createBindGroupLayout({ entries: [] });

		this.bgPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [bgLayout] }),
			vertex: { module: device.createShaderModule({ code: bgShader }), entryPoint: 'vertex_main', buffers: [] },
			fragment: { module: device.createShaderModule({ code: bgShader }), entryPoint: 'fragment_main', targets: [{ format: this.format }] },
			depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' }
		});

		this.bgBindGroup = device.createBindGroup({ layout: bgLayout, entries: [] });

		// Line render
		const lineLayout = device.createBindGroupLayout({
			entries: [
				{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
				{ binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }
			]
		});

		this.linePipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [lineLayout] }),
			vertex: { module: device.createShaderModule({ code: lineShader }), entryPoint: 'vertex_main', buffers: [] },
			fragment: { module: device.createShaderModule({ code: lineShader }), entryPoint: 'fragment_main', targets: [{ format: this.format }] },
			primitive: { topology: 'line-list' },
			depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }
		});

		this.lineBindGroup = device.createBindGroup({
			layout: lineLayout,
			entries: [
				{ binding: 0, resource: { buffer: this.camera.projectionBuffer } },
				{ binding: 1, resource: { buffer: this.camera.viewBuffer } },
				{ binding: 2, resource: { buffer: this.guidingLineBuffer } }
			]
		});

		// Border render (green outline for predator PIP)
		const borderLayout = device.createBindGroupLayout({ entries: [] });

		this.borderPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [borderLayout] }),
			vertex: { module: device.createShaderModule({ code: borderShader }), entryPoint: 'vertex_main', buffers: [] },
			fragment: { module: device.createShaderModule({ code: borderShader }), entryPoint: 'fragment_main', targets: [{ format: this.format }] },
			primitive: { topology: 'line-list' },
			depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' }
		});

		this.borderBindGroup = device.createBindGroup({ layout: borderLayout, entries: [] });
	}

	initBoids() {
		const positions = new Float32Array(BIRD_COUNT * 3);
		const velocities = new Float32Array(BIRD_COUNT * 3);
		const phases = new Float32Array(BIRD_COUNT);
		const half = BOUNDS / 2;

		for (let i = 0; i < BIRD_COUNT; i++) {
			positions[i * 3] = Math.random() * BOUNDS - half;
			positions[i * 3 + 1] = Math.random() * BOUNDS - half;
			positions[i * 3 + 2] = Math.random() * BOUNDS - half;
			velocities[i * 3] = (Math.random() - 0.5);
			velocities[i * 3 + 1] = (Math.random() - 0.5);
			velocities[i * 3 + 2] = (Math.random() - 0.5);
			phases[i] = 0;
		}

		this.device.queue.writeBuffer(this.positionBuffer, 0, positions);
		this.device.queue.writeBuffer(this.velocityBuffer, 0, velocities);
		this.device.queue.writeBuffer(this.phaseBuffer, 0, phases);
		this.device.queue.writeBuffer(this.predatorPosBuffer, 0, new Float32Array([0, 0, 0]));
		this.device.queue.writeBuffer(this.predatorVelBuffer, 0, new Float32Array([0, 0, 0]));
		this.device.queue.writeBuffer(this.targetIndexBuffer, 0, new Uint32Array([Math.floor(Math.random() * BIRD_COUNT)]));
	}

	setupEvents() {
		const canvas = this.canvas;
		const ctrl = this.cameraController;

		canvas.addEventListener('mousedown', (e) => {
			const rect = canvas.getBoundingClientRect();
			ctrl.onMouseDown((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
		});

		window.addEventListener('mouseup', () => ctrl.onMouseUp());
		window.addEventListener('mousemove', (e) => {
			const rect = canvas.getBoundingClientRect();
			ctrl.onMouseMove((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
		});

		canvas.addEventListener('wheel', (e) => { e.preventDefault(); ctrl.onWheel(e.deltaY); }, { passive: false });
		window.addEventListener('resize', () => this.resize());
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') this.lastTime = performance.now();
		});
	}

	resize() {
		const width = this.canvas.clientWidth;
		const height = this.canvas.clientHeight;
		if (width === 0 || height === 0) return;
		this.canvas.width = width;
		this.canvas.height = height;
		this.canvasWidth = width;
		this.canvasHeight = height;
		this.camera.resize(width, height);
		this.createDepthTexture(width, height);
	}

	render = () => {
		if (!this.running) return;

		const now = performance.now();
		const dt = document.visibilityState === 'visible' ? (now - this.lastTime) / 1000 : 0;
		this.lastTime = now;

		if (now - this.lastTargetChange > this.targetChangeInterval) {
			this.device.queue.writeBuffer(this.targetIndexBuffer, 0, new Uint32Array([Math.floor(Math.random() * BIRD_COUNT)]));
			this.lastTargetChange = now;
		}

		this.device.queue.writeBuffer(this.deltaTimeBuffer, 0, new Float32Array([dt]));

		const encoder = this.device.createCommandEncoder();

		// Compute passes
		const flockingPass = encoder.beginComputePass();
		flockingPass.setPipeline(this.flockingPipeline);
		flockingPass.setBindGroup(0, this.flockingBindGroup);
		flockingPass.dispatchWorkgroups(Math.ceil(BIRD_COUNT / 64));
		flockingPass.end();

		const huntingPass = encoder.beginComputePass();
		huntingPass.setPipeline(this.huntingPipeline);
		huntingPass.setBindGroup(0, this.huntingBindGroup);
		huntingPass.dispatchWorkgroups(1);
		huntingPass.end();

		// Read guiding line for predator camera (async, updates next frame)
		this.updatePredatorCamera();

		const textureView = this.context.getCurrentTexture().createView();
		const depthView = this.depthTexture.createView();

		// Main render pass
		const renderPass = encoder.beginRenderPass({
			colorAttachments: [{ view: textureView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.2, g: 0.5, b: 0.9, a: 1 } }],
			depthStencilAttachment: { view: depthView, depthLoadOp: 'clear', depthClearValue: 1.0, depthStoreOp: 'store' }
		});

		renderPass.setViewport(0, 0, this.canvasWidth, this.canvasHeight, 0, 1);

		renderPass.setPipeline(this.bgPipeline);
		renderPass.setBindGroup(0, this.bgBindGroup);
		renderPass.draw(3);

		renderPass.setPipeline(this.birdPipeline);
		renderPass.setBindGroup(0, this.birdBindGroup);
		renderPass.setVertexBuffer(0, this.birdGeom.vertexBuffer);
		renderPass.setIndexBuffer(this.birdGeom.indexBuffer, 'uint16');
		renderPass.drawIndexed(this.birdGeom.indexCount, BIRD_COUNT);

		renderPass.setPipeline(this.predatorPipeline);
		renderPass.setBindGroup(0, this.predatorBindGroup);
		renderPass.setVertexBuffer(0, this.predatorGeom.vertexBuffer);
		renderPass.setIndexBuffer(this.predatorGeom.indexBuffer, 'uint16');
		renderPass.drawIndexed(this.predatorGeom.indexCount, 1);

		renderPass.setPipeline(this.linePipeline);
		renderPass.setBindGroup(0, this.lineBindGroup);
		renderPass.draw(2);

		renderPass.end();

		// Predator POV render pass
		const pipSize = Math.min(Math.max(Math.min(this.canvasWidth, this.canvasHeight) * 0.4, 300), 350);
		const pipX = 20;
		const pipY = this.canvasHeight - pipSize - 20;

		const povPass = encoder.beginRenderPass({
			colorAttachments: [{ view: textureView, loadOp: 'load', storeOp: 'store' }],
			depthStencilAttachment: { view: depthView, depthLoadOp: 'clear', depthClearValue: 1.0, depthStoreOp: 'store' }
		});

		povPass.setViewport(pipX, pipY, pipSize, pipSize, 0, 1);

		// Create predator camera bind group
		const povBirdBindGroup = this.device.createBindGroup({
			layout: this.birdBindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: this.predatorCamera.projectionBuffer } },
				{ binding: 1, resource: { buffer: this.predatorCamera.viewBuffer } },
				{ binding: 2, resource: { buffer: this.viewportBuffer } },
				{ binding: 3, resource: { buffer: this.positionBuffer } },
				{ binding: 4, resource: { buffer: this.phaseBuffer } },
				{ binding: 5, resource: { buffer: this.mouseBuffer } },
				{ binding: 6, resource: { buffer: this.velocityBuffer } }
			]
		});

		povPass.setPipeline(this.bgPipeline);
		povPass.setBindGroup(0, this.bgBindGroup);
		povPass.draw(3);

		povPass.setPipeline(this.birdPipeline);
		povPass.setBindGroup(0, povBirdBindGroup);
		povPass.setVertexBuffer(0, this.birdGeom.vertexBuffer);
		povPass.setIndexBuffer(this.birdGeom.indexBuffer, 'uint16');
		povPass.drawIndexed(this.birdGeom.indexCount, BIRD_COUNT);

		povPass.end();

		// Green border outline around predator PIP
		const borderThickness = 2;
		const borderPass = encoder.beginRenderPass({
			colorAttachments: [{ view: textureView, loadOp: 'load', storeOp: 'store' }],
			depthStencilAttachment: { view: depthView, depthLoadOp: 'clear', depthClearValue: 1.0, depthStoreOp: 'store' }
		});

		borderPass.setViewport(pipX - borderThickness, pipY - borderThickness, pipSize + borderThickness * 2, pipSize + borderThickness * 2, 0, 1);
		borderPass.setPipeline(this.borderPipeline);
		borderPass.setBindGroup(0, this.borderBindGroup);
		borderPass.draw(8);
		borderPass.end();

		this.device.queue.submit([encoder.finish()]);
		requestAnimationFrame(this.render);
	};

	updatePredatorCamera() {
		const device = this.device;
		const stagingBuffer = device.createBuffer({
			size: 32,
			usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
		});

		const copyEncoder = device.createCommandEncoder();
		copyEncoder.copyBufferToBuffer(this.guidingLineBuffer, 0, stagingBuffer, 0, 32);
		device.queue.submit([copyEncoder.finish()]);

		stagingBuffer.mapAsync(GPUMapMode.READ).then(() => {
			const data = new Float32Array(stagingBuffer.getMappedRange());
			const predatorPos = [data[0], data[1], data[2]];
			const targetPos = [data[4], data[5], data[6]];
			this.predatorCamera.updateFromPositionAndTarget(predatorPos, targetPos);
			stagingBuffer.unmap();
			stagingBuffer.destroy();
		});
	}

	destroy() {
		this.running = false;
		this.camera?.destroy();
		this.predatorCamera?.destroy();
		this.depthTexture?.destroy();
		this.positionBuffer?.destroy();
		this.velocityBuffer?.destroy();
		this.phaseBuffer?.destroy();
		this.predatorPosBuffer?.destroy();
		this.predatorVelBuffer?.destroy();
		this.targetIndexBuffer?.destroy();
		this.deltaTimeBuffer?.destroy();
		this.flockingParamsBuffer?.destroy();
		this.viewportBuffer?.destroy();
		this.mouseBuffer?.destroy();
		this.guidingLineBuffer?.destroy();
		this.birdGeom?.vertexBuffer?.destroy();
		this.birdGeom?.indexBuffer?.destroy();
		this.predatorGeom?.vertexBuffer?.destroy();
		this.predatorGeom?.indexBuffer?.destroy();
	}
}