import Experience from '../Experience';
import RiemannPipeline from './RiemannPipeline.js';

class RiemannExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		// Store device and resource manager
		this.device = device;
		this.resourceManager = resourceManager;

		// Initialize surface type
		this.surfaceType = 'flat';

		// Initialize loading state
		this.isLoading = true;
		this.loadingProgress = 0;
		this.loadingMessage = 'Initializing...';

		// Initialize surface shader map
		this.initializeSurfaceShaderMap();

		// Register this experience with the resource manager
		if (this.resourceManager) {
			if (!this.resourceManager.experiences) {
				this.resourceManager.experiences = {};
			}
			this.resourceManager.experiences.riemann = this;
		}

		// Grid resolution - increase for better visual quality
		this.resolution = 1000;
		this.totalVertices = this.resolution * this.resolution;
		this.totalIndices = (this.resolution - 1) * (this.resolution - 1) * 6;

		// Create a map to store buffers for each surface type
		this.vertexBuffers = new Map();

		// Create index buffer (shared across all surface types)
		this.createIndexBuffer();

		// Initialize vertex buffers for each surface type
		this.initializeVertexBuffers();

		// Create uniform buffer for time
		this.uniformBuffer = this.device.createBuffer({
			size: 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Riemann Uniforms Buffer'
		});

		// Create zeta parameters buffer
		this.zetaParamsBuffer = this.device.createBuffer({
			size: 16, // 4 floats: numWaves, scale, scalingMode, phaseMode
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Zeta Parameters Buffer'
		});

		// Create geometry parameters buffer
		this.geometryParamsBuffer = this.device.createBuffer({
			size: 16, // 4 floats: geometryMode, unused, unused, unused
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			label: 'Geometry Parameters Buffer'
		});

		// Initialize zeta parameters
		this.zetaNumWaves = 5; // Default number of waves
		this.zetaScale = 0.5; // Default scale factor
		this.zetaScalingMode = 0; // 0=log, 1=theta/quadratic
		this.zetaPhaseMode = 0; // 0=auto, 1=manual
		this.zetaManualPhase = 0; // radians, -2π to 2π
		this.zetaGeometryMode = 0; // 0=euclidean, 1=poincare disc
		this.zetaWaveMode = 0; // 0=radial, 1=hexagonal (default radial)
		this.updateZetaParams();
		this.updateGeometryParams();

		// Initialize time
		this.time = 0;
	}

	// Initialize the mapping of surface types to shader types
	initializeSurfaceShaderMap() {
		this.surfaceShaderMap = new Map();
		this.surfaceShaderMap.set('flat', 'flat');
		this.surfaceShaderMap.set('sine', 'sine');
		this.surfaceShaderMap.set('ripple', 'ripple');
		this.surfaceShaderMap.set('weird', 'weird');
		this.surfaceShaderMap.set('torus', 'torus');
		this.surfaceShaderMap.set('zeta', 'zeta'); // Add zeta mapping

		// Set current surface
		this.currentSurface = 'ripple';
	}

	// Method to update zeta parameters
	updateZetaParams() {
		if (!this.device || !this.zetaParamsBuffer) return;

		// Clamp number of waves to reasonable range
		this.zetaNumWaves = Math.max(1, Math.min(50, this.zetaNumWaves));

		// Clamp scale to reasonable range
		this.zetaScale = Math.max(1.0, Math.min(100.0, this.zetaScale));

		// Clamp scalingMode and phaseMode
		this.zetaScalingMode = this.zetaScalingMode === 1 ? 1 : 0;
		this.zetaPhaseMode = this.zetaPhaseMode === 1 ? 1 : 0;

		// Update the buffer
		this.device.queue.writeBuffer(
			this.zetaParamsBuffer,
			0,
			new Float32Array([
				this.zetaNumWaves,
				this.zetaScale,
				this.zetaScalingMode,
				this.zetaPhaseMode
			])
		);
	}

	// Add method to update geometry parameters
	updateGeometryParams() {
		if (!this.device || !this.geometryParamsBuffer) return;

		// Clamp geometry and wave modes
		this.zetaGeometryMode = this.zetaGeometryMode === 1 ? 1 : 0;
		this.zetaWaveMode = this.zetaWaveMode === 1 ? 1 : 0;

		// Update the buffer
		this.device.queue.writeBuffer(
			this.geometryParamsBuffer,
			0,
			new Float32Array([this.zetaGeometryMode, this.zetaWaveMode, 0, 0])
		);
	}

	// Method to set number of waves for zeta surface
	setZetaNumWaves(numWaves) {
		this.zetaNumWaves = numWaves;
		this.updateZetaParams();
	}

	// Method to set scale for zeta surface
	setZetaScale(scale) {
		this.zetaScale = scale;
		this.updateZetaParams();
	}

	// Method to get current number of waves
	getZetaNumWaves() {
		return this.zetaNumWaves;
	}

	// Method to get current scale
	getZetaScale() {
		return this.zetaScale;
	}

	// Add setters/getters
	setZetaScalingMode(mode) {
		this.zetaScalingMode = mode === 1 ? 1 : 0;
		this.updateZetaParams();
	}
	getZetaScalingMode() {
		return this.zetaScalingMode;
	}
	setZetaPhaseMode(mode) {
		this.zetaPhaseMode = mode === 1 ? 1 : 0;
		this.updateZetaParams();
	}
	getZetaPhaseMode() {
		return this.zetaPhaseMode;
	}
	setZetaManualPhase(phase) {
		// Clamp to -2π to 2π
		const pi2 = Math.PI * 2;
		this.zetaManualPhase = Math.max(-pi2, Math.min(pi2, phase));
	}
	getZetaManualPhase() {
		return this.zetaManualPhase;
	}

	// Add setters/getters for geometry mode
	setZetaGeometryMode(mode) {
		this.zetaGeometryMode = mode === 1 ? 1 : 0;
		this.updateGeometryParams();
	}
	getZetaGeometryMode() {
		return this.zetaGeometryMode;
	}

	// Add setters/getters for wave mode
	setZetaWaveMode(mode) {
		this.zetaWaveMode = mode === 1 ? 1 : 0;
		this.updateGeometryParams();
	}
	getZetaWaveMode() {
		return this.zetaWaveMode;
	}

	// Method to update loading state
	updateLoadingState(isLoading, message = '', progress = 0) {
		this.isLoading = isLoading;
		this.loadingMessage = message;
		this.loadingProgress = progress;

		// Dispatch a custom event that the UI can listen for
		if (typeof window !== 'undefined') {
			const event = new CustomEvent('riemann-loading-update', {
				detail: {
					isLoading: this.isLoading,
					message: this.loadingMessage,
					progress: this.loadingProgress
				}
			});
			window.dispatchEvent(event);
		}
	}

	// For compatibility with the original code
	changeManifold(surfaceType) {
		return this.updateSurface(surfaceType);
	}

	// Create index buffer (only need one for all surface types since topology is the same)
	createIndexBuffer() {
		// Create indices for the grid
		const indices = new Uint32Array(this.totalIndices);
		let index = 0;

		for (let y = 0; y < this.resolution - 1; y++) {
			for (let x = 0; x < this.resolution - 1; x++) {
				// First triangle
				indices[index++] = y * this.resolution + x;
				indices[index++] = y * this.resolution + x + 1;
				indices[index++] = (y + 1) * this.resolution + x;

				// Second triangle
				indices[index++] = y * this.resolution + x + 1;
				indices[index++] = (y + 1) * this.resolution + x + 1;
				indices[index++] = (y + 1) * this.resolution + x;
			}
		}

		// Create index buffer with mappedAtCreation for better memory management
		this.indexBuffer = this.device.createBuffer({
			size: indices.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
			label: 'Riemann Index Buffer'
		});

		// Copy data to the mapped buffer and unmap
		new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
		this.indexBuffer.unmap();
	}

	// Initialize separate vertex buffers for each surface type
	initializeVertexBuffers() {
		// Create vertex buffers for each surface type
		const surfaceTypes = ['flat', 'sine', 'ripple', 'weird', 'torus', 'zeta'];

		for (const surfaceType of surfaceTypes) {
			// Generate vertices for this surface type
			const vertices = new Float32Array(this.totalVertices * 3);

			// Create specific surface geometry
			this.generateSurfaceData(vertices, surfaceType);

			// Create vertex buffer
			const vertexBuffer = this.device.createBuffer({
				size: vertices.byteLength,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
				mappedAtCreation: true,
				label: `Riemann Vertex Buffer (${surfaceType})`
			});

			// Copy data to the mapped buffer and unmap
			new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
			vertexBuffer.unmap();

			// Store the buffer in our map
			this.vertexBuffers.set(surfaceType, vertexBuffer);
		}

		// Set the current vertex buffer based on the current surface
		this.vertexBuffer = this.vertexBuffers.get(this.currentSurface);
	}

	// Generate appropriate data for a specific surface type
	generateSurfaceData(vertexData, surfaceType) {
		switch (surfaceType) {
			case 'flat':
				return this.generateFlatGrid(vertexData);
			case 'sine':
				return this.generateSineWave(vertexData);
			case 'ripple':
				return this.generateRipple(vertexData);
			case 'weird':
				return this.generateWeirdSurface(vertexData, 0);
			case 'torus':
				return this.generateTorus(vertexData);
			case 'zeta':
				return this.generateZetaSurface(vertexData);
			default:
				return this.generateFlatGrid(vertexData);
		}
	}

	// Method to update the surface based on the selected type
	updateSurface(surfaceType) {
		try {
			if (!this.surfaceShaderMap) {
				console.warn('surfaceShaderMap is not defined, initializing with defaults');
				this.initializeSurfaceShaderMap();
			}

			// Update the surface type
			this.surfaceType = surfaceType;
			this.currentSurface = surfaceType;

			// Get the appropriate vertex buffer for this surface type
			if (this.vertexBuffers && this.vertexBuffers.has(surfaceType)) {
				this.vertexBuffer = this.vertexBuffers.get(surfaceType);
			} else {
				// If buffer not found, use flat as fallback
				console.warn(
					`Vertex buffer for surface type '${surfaceType}' not found, using 'flat' as fallback`
				);
				this.vertexBuffer = this.vertexBuffers.get('flat');
			}

			return true;
		} catch (error) {
			console.error('Error updating surface:', error);
			return false;
		}
	}

	// Generate different surface types - maintain for compatibility
	generateSurface(vertices, surfaceType) {
		try {
			if (!this.surfaceShaderMap) {
				console.warn('surfaceShaderMap is not defined, initializing with defaults');
				this.initializeSurfaceShaderMap();
			}

			// Use provided values or fall back to defaults
			const vertexData = vertices || new Float32Array(this.totalVertices * 3);
			const surface = surfaceType || this.surfaceType || 'riemann';

			// Update current surface
			this.currentSurface = surface;

			// Generate surface using our data generator
			this.generateSurfaceData(vertexData, surface);

			return true;
		} catch (error) {
			console.error('Error generating surface:', error);
			return false;
		}
	}

	// Helper method to generate a flat grid
	generateFlatGrid(vertexData) {
		const vertices = vertexData || new Float32Array(this.totalVertices * 3);
		let index = 0;

		// Scale factor to make the grid larger
		const scale = 2.0;

		for (let y = 0; y < this.resolution; y++) {
			for (let x = 0; x < this.resolution; x++) {
				// Convert grid coordinates to -1 to 1 range, but scaled larger
				const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
				const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;

				// Set flat z position
				const zPos = 0;

				// Set vertex position
				vertices[index++] = xPos;
				vertices[index++] = yPos;
				vertices[index++] = zPos;
			}
		}

		return vertices;
	}

	// Helper method to generate a sine wave surface
	generateSineWave(vertexData) {
		const vertices = vertexData || new Float32Array(this.totalVertices * 3);
		let index = 0;

		// Scale factor to make the grid larger
		const scale = 2.0;

		for (let y = 0; y < this.resolution; y++) {
			for (let x = 0; x < this.resolution; x++) {
				// Convert grid coordinates to -1 to 1 range, but scaled larger
				const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
				const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;

				// Much larger amplitude
				const zPos = 1.2 * Math.sin(xPos * Math.PI * 2) * Math.cos(yPos * Math.PI * 1.5);

				// Set vertex position
				vertices[index++] = xPos;
				vertices[index++] = yPos;
				vertices[index++] = zPos;
			}
		}

		return vertices;
	}

	// Helper method to generate a ripple surface
	generateRipple(vertexData) {
		const vertices = vertexData || new Float32Array(this.totalVertices * 3);
		let index = 0;

		// Scale factor to make the grid larger
		const scale = 2.0;

		for (let y = 0; y < this.resolution; y++) {
			for (let x = 0; x < this.resolution; x++) {
				// Convert grid coordinates to -1 to 1 range, but scaled larger
				const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
				const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;

				// Distance from center
				const dist = Math.sqrt(xPos * xPos + yPos * yPos) / scale;

				// Much larger amplitude
				const zPos = (1.5 * Math.sin(dist * Math.PI * 5)) / (1 + dist);

				// Set vertex position
				vertices[index++] = xPos;
				vertices[index++] = yPos;
				vertices[index++] = zPos;
			}
		}

		return vertices;
	}

	// Helper method to generate a weird surface
	generateWeirdSurface(vertexData, time = 0) {
		const vertices = vertexData || new Float32Array(this.totalVertices * 3);
		let index = 0;

		// Scale factor to make the grid larger
		const scale = 2.0;

		// Use a more reasonable time scale
		const t = time * 0.5;

		for (let y = 0; y < this.resolution; y++) {
			for (let x = 0; x < this.resolution; x++) {
				// Convert grid coordinates to -1 to 1 range, but scaled larger
				const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
				const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;

				// Calculate polar coordinates
				const r = Math.sqrt(xPos * xPos + yPos * yPos);
				const theta = Math.atan2(yPos, xPos);

				// Moving poles (meromorphic singularities)
				const pole1X = Math.sin(t * 0.3) * scale * 0.5;
				const pole1Y = Math.cos(t * 0.4) * scale * 0.5;
				const pole2X = Math.sin(t * 0.5 + 2) * scale * 0.5;
				const pole2Y = Math.cos(t * 0.2 + 1) * scale * 0.5;

				// Distances to poles
				const dist1 = Math.sqrt(Math.pow(xPos - pole1X, 2) + Math.pow(yPos - pole1Y, 2));
				const dist2 = Math.sqrt(Math.pow(xPos - pole2X, 2) + Math.pow(yPos - pole2Y, 2));

				// Avoid true singularities with epsilon
				const epsilon = 0.1;

				// Laurent series-like approach for poles
				const pole1Term = 1.0 / Math.max(dist1, epsilon);
				const pole2Term = 0.8 / Math.max(dist2, epsilon);

				// Scale for visual balance
				const poleEffect = (pole1Term + pole2Term) * 0.4;

				// Wave pattern based on distance and angle
				const waveFreq = 3.0 + Math.sin(t * 0.2);
				const wave = 0.3 * Math.sin(r * waveFreq + t * 1.5);

				// Spiral term (varies with angle)
				const spiral = 0.2 * Math.sin(theta * 3.0 + r * 2.0 + t * 0.7);

				// Combine effects in a way that maintains meromorphicity
				let zPos = poleEffect + wave + spiral;

				// Add gentle overall pulsing
				const pulse = 0.2 * Math.sin(t * 0.4) + 1.0;
				zPos *= pulse;

				// Set vertex position
				vertices[index++] = xPos;
				vertices[index++] = yPos;
				vertices[index++] = zPos;
			}
		}

		return vertices;
	}

	// Helper method to generate a torus surface
	generateTorus(vertexData) {
		const vertices = vertexData || new Float32Array(this.totalVertices * 3);
		let index = 0;

		// Scale factor to match other surfaces
		const scale = 2.0;

		// Enhanced torus parameters with scaling
		const R = 0.65 * scale; // Major radius
		const r = 0.35 * scale; // Minor radius

		for (let y = 0; y < this.resolution; y++) {
			for (let x = 0; x < this.resolution; x++) {
				// Convert grid coordinates to angle values
				const theta = (x / (this.resolution - 1)) * Math.PI * 2;
				const phi = (y / (this.resolution - 1)) * Math.PI * 2;

				// Parametric equation for torus with scaling
				const xPos = (R + r * Math.cos(phi)) * Math.cos(theta);
				const yPos = (R + r * Math.cos(phi)) * Math.sin(theta);
				const zPos = r * Math.sin(phi);

				// Set vertex position
				vertices[index++] = xPos;
				vertices[index++] = yPos;
				vertices[index++] = zPos;
			}
		}

		return vertices;
	}

	// Helper method to generate zeta surface
	generateZetaSurface(vertexData) {
		const vertices = vertexData || new Float32Array(this.totalVertices * 3);
		let index = 0;

		// Scale factor to make the grid larger
		const scale = 5.0;

		for (let y = 0; y < this.resolution; y++) {
			for (let x = 0; x < this.resolution; x++) {
				// Convert grid coordinates to -1 to 1 range, but scaled larger
				const xPos = ((x / (this.resolution - 1)) * 2 - 1) * scale;
				const yPos = ((y / (this.resolution - 1)) * 2 - 1) * scale;

				// For zeta surface, we create a base flat surface
				// The actual zeta computation happens in the vertex shader
				const zPos = 0;

				// Set vertex position
				vertices[index++] = xPos;
				vertices[index++] = yPos;
				vertices[index++] = zPos;
			}
		}

		return vertices;
	}

	async initialize() {
		this.updateLoadingState(true, 'Initializing pipeline...', 10);

		try {
			// Create the pipeline
			this.pipeline = new RiemannPipeline(this.device, this.resourceManager);

			// Initialize the pipeline
			const success = await this.pipeline.initialize();
			if (!success) {
				this.updateLoadingState(true, 'Failed to initialize pipeline', 100);
				return false;
			}

			this.updateLoadingState(true, 'Pipeline initialized', 50);

			// Make sure all vertex buffers are initialized
			this.updateLoadingState(true, 'Generating surfaces...', 70);
			if (!this.vertexBuffers || this.vertexBuffers.size === 0) {
				this.initializeVertexBuffers();
			}

			// Set the proper current buffer
			this.vertexBuffer =
				this.vertexBuffers.get(this.currentSurface) || this.vertexBuffers.get('flat');

			// Set up camera target to center of grid without overriding position
			this.updateLoadingState(true, 'Configuring camera...', 90);
			if (this.resourceManager && this.resourceManager.camera) {
				// Look at the center of the grid (0,0,0)
				this.resourceManager.camera.target = [0, 0, 0];
				this.resourceManager.camera.updateView();

				// Set up camera controller if available
				if (this.resourceManager.cameraController) {
					// Set the target to the center of the grid
					this.resourceManager.cameraController.target = [0, 0, 0];
				}
			}

			this.updateLoadingState(false, 'Initialization complete', 100);
			return true;
		} catch (error) {
			this.updateLoadingState(false, `Error: ${error.message}`, 100);
			return false;
		}
	}

	render(commandEncoder, textureView) {
		if (!this.pipeline || !this.pipeline.isInitialized) {
			return;
		}

		try {
			// Get depth texture view
			const depthTextureView = this.resourceManager.getDepthTextureView?.();
			if (!depthTextureView) {
				return;
			}

			// Update time with smoother value for more elegant animation
			if (this.zetaPhaseMode === 0) {
				this.time += 0.015;
			}

			// Only the weird surface needs to be updated each frame for animation
			if (this.currentSurface === 'weird') {
				// Reuse vertices array instead of creating a new one every frame
				if (!this._verticesCache) {
					// Create once and cache
					this._verticesCache = new Float32Array(this.totalVertices * 3);
				}

				// For weird surface, update with time-based animation using cached array
				this.generateWeirdSurface(this._verticesCache, this.time);
				this.device.queue.writeBuffer(this.vertexBuffer, 0, this._verticesCache);
			}

			// Update uniform buffer with time and additional parameters
			// Create this Float32Array once and reuse it
			if (!this._timeUniformData) {
				this._timeUniformData = new Float32Array(4);
			}

			// Update values without creating new array
			this._timeUniformData[0] = 0.15;
			this._timeUniformData[1] = 0.2;
			// z = manual phase, w = time
			this._timeUniformData[2] = this.zetaManualPhase;
			this._timeUniformData[3] = this.time;

			// Write reused buffer to GPU
			this.device.queue.writeBuffer(this.uniformBuffer, 0, this._timeUniformData);

			// Update zeta parameters
			this.updateZetaParams();

			// Safety check for surfaceShaderMap
			if (!this.surfaceShaderMap) {
				console.warn('surfaceShaderMap is not defined in render, initializing with defaults');
				this.initializeSurfaceShaderMap();
			}

			// Get the shader type for the current surface
			let shaderType = this.surfaceShaderMap.get(this.currentSurface) || 'flat';

			// Force 'flat' shader for flat surface to ensure consistent rendering
			if (this.currentSurface === 'flat') {
				shaderType = 'flat';
			}

			// Render using pipeline with the appropriate shader
			this.pipeline.render(
				commandEncoder,
				textureView,
				depthTextureView,
				this.vertexBuffer,
				this.indexBuffer,
				this.uniformBuffer,
				this.totalIndices,
				shaderType,
				this.zetaParamsBuffer, // Pass zeta parameters buffer
				this.geometryParamsBuffer // Pass geometry parameters buffer
			);
		} catch (error) {
			console.error('Error in Riemann render:', error);
		}
	}

	handleResize(width, height) {
		if (this.resourceManager.camera) {
			this.resourceManager.camera.updateAspect(width, height);
		}

		if (this.resourceManager.updateDepthTexture) {
			this.resourceManager.updateDepthTexture(width, height);
		}
	}

	// Add handler for low memory conditions
	handleLowMemory() {
		// Decrease resolution dynamically if we're in a memory constrained situation
		if (this._originalResolution === undefined) {
			// Store original resolution first time
			this._originalResolution = this.resolution;
		}

		// If we're already at a reduced resolution, don't reduce further
		if (this.resolution <= 100) {
			return;
		}

		// Reduce resolution by half, but not below 100
		const newResolution = Math.max(100, Math.floor(this.resolution / 2));
		console.warn(
			`Reducing Riemann surface resolution from ${this.resolution} to ${newResolution} to conserve memory`
		);

		// Store current surface type
		const currentSurfaceType = this.currentSurface;

		// Update resolution
		this.resolution = newResolution;
		this.totalVertices = this.resolution * this.resolution;
		this.totalIndices = (this.resolution - 1) * (this.resolution - 1) * 6;

		// Recreate buffers at lower resolution
		this.createIndexBuffer();
		this.initializeVertexBuffers();

		// Reset the current surface to what it was
		this.updateSurface(currentSurfaceType);

		// Schedule resolution recovery after memory pressure subsides
		setTimeout(() => {
			if (window.performance && window.performance.memory) {
				const memUsage = window.performance.memory.usedJSHeapSize;
				const memLimit = window.performance.memory.jsHeapSizeLimit;
				const percentUsed = (memUsage / memLimit) * 100;

				// Only restore if memory usage is reasonable
				if (percentUsed < 75 && this._originalResolution) {
					// Restore original resolution
					console.info(`Restoring Riemann surface resolution to ${this._originalResolution}`);

					// Store current surface type
					const currentSurfaceType = this.currentSurface;

					// Update resolution
					this.resolution = this._originalResolution;
					this.totalVertices = this.resolution * this.resolution;
					this.totalIndices = (this.resolution - 1) * (this.resolution - 1) * 6;

					// Recreate buffers at original resolution
					this.createIndexBuffer();
					this.initializeVertexBuffers();

					// Reset the current surface
					this.updateSurface(currentSurfaceType);
				}
			}
		}, 30000); // Check after 30 seconds
	}

	// Add to cleanup method
	cleanup() {
		// Clean up pipeline
		if (this.pipeline) {
			this.pipeline.cleanup();
			this.pipeline = null;
		}

		// Clean up all vertex buffers
		if (this.vertexBuffers) {
			for (const [_, buffer] of this.vertexBuffers) {
				// Can't reassign buffer parameter, just remove the reference
			}
			this.vertexBuffers.clear();
		}

		// Clear current vertex buffer reference
		this.vertexBuffer = null;

		if (this.indexBuffer) {
			this.indexBuffer = null;
		}

		if (this.uniformBuffer) {
			this.uniformBuffer = null;
		}

		if (this.zetaParamsBuffer) {
			this.zetaParamsBuffer = null;
		}

		if (this.geometryParamsBuffer) {
			this.geometryParamsBuffer = null;
		}

		// Clean up cached arrays we added to prevent memory leaks
		this._verticesCache = null;
		this._timeUniformData = null;
		this._originalResolution = undefined; // Clear the original resolution

		// Reset state
		this.isLoading = true;
		this.loadingProgress = 0;
		this.time = 0;

		// Remove from resource manager
		if (this.resourceManager && this.resourceManager.experiences) {
			if (this.resourceManager.experiences.riemann === this) {
				this.resourceManager.experiences.riemann = null;
			}
		}

		// Clear device and resource manager references
		this.device = null;
		this.resourceManager = null;

		// Call parent cleanup
		super.cleanup();
	}

	// Replace the old createBuffers method
	createBuffers() {
		this.createIndexBuffer();
		this.initializeVertexBuffers();
	}
}

export default RiemannExperience;
