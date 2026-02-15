// FlockingExperience.js

import Experience from '../Experience';
import BirdGeometry from './BirdGeometry';
import PredatorGeometry from './PredatorGeometry';
import GuidingLineGeometry from './GuidingLineGeometry'
import FlockingPipeline from './FlockingPipeline';

class FlockingExperience extends Experience {
    constructor(device, resourceManager) {
        super(device, resourceManager);

        this.birdCount = 8192; // Adjusted for performance
        this.lastTime = performance.now(); // Initialize lastTime

        // Timer variables
        this.targetChangeInterval = 10000; // 10 seconds in milliseconds
        this.lastTargetChangeTime = this.lastTime;

        // Separate storage for birds and predator
        this.birds = []; // Array to hold all bird geometries
        this.predator = null; // Single reference for the predator

        // Get initial dimensions from the viewport buffer
        const viewportArray = new Float32Array(2);
        device.queue.writeBuffer(resourceManager.getViewportBuffer(), 0, viewportArray);

        // Initialize the Flocking pipeline with dimensions from ResourceManager
        this.pipeline = new FlockingPipeline(
            this.device,
            resourceManager.camera,
            resourceManager.getViewportBuffer(),
            resourceManager.getMouseBuffer(),
            this.birdCount,
            this.canvas ? this.canvas.width : 800,  // Default to 800 if canvas not available
            this.canvas ? this.canvas.height : 600,  // Default to 600 if canvas not available
            this.canvas
        );

        this.addBirds();
        this.addPredator();

        this.guidingLine = new GuidingLineGeometry(this.device);
        this.addObject(this.guidingLine);

        // Bind the visibility change handler
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    async initialize() {
        // Initialize the pipeline
        await this.pipeline.initialize();

        // Generate initial positions and velocities for birds
        const initialPositions = [];
        const initialVelocities = [];
        const initialPhases = [];
        const bounds = 2500;
        const boundsHalf = bounds / 2;

        for (let i = 0; i < this.birdCount; i++) {
            // Random positions within bounds
            const posX = Math.random() * bounds - boundsHalf;
            const posY = Math.random() * bounds - boundsHalf;
            const posZ = Math.random() * bounds - boundsHalf;
            initialPositions.push([posX, posY, posZ]);

            // Random velocities with a small magnitude
            const velX = (Math.random() - 0.5);
            const velY = (Math.random() - 0.5);
            const velZ = (Math.random() - 0.5);
            initialVelocities.push([velX, velY, velZ]);

            // Random wing phases
            const wingPhase = 0;
            initialPhases.push(wingPhase);
        }

        // Initialize position and velocity buffers in the pipeline
        this.pipeline.initializeBirdBuffers(initialPositions, initialVelocities, initialPhases);

        const initialPredatorPosition = new Float32Array([0.0, 0.0, 0.0]); // Starting at origin
        const initialPredatorVelocity = new Float32Array([0.0, 0.0, 0.0]); // Initially stationary

        // Initialize predator position and velocity buffers in the pipeline
        this.pipeline.initializePredatorBuffers(initialPredatorPosition, initialPredatorVelocity);

        // Set initial targetIndex to a random bird
        const initialTargetIndex = Math.floor(Math.random() * this.birdCount);
        this.pipeline.updateTargetIndex(initialTargetIndex);
    }

    addBirds() {
        // Add multiple birds to the scene and store references
        for (let i = 0; i < this.birdCount; i++) {
            const bird = new BirdGeometry(this.device);
            this.birds.push(bird);
            this.addObject(bird);
        }
    }

    addPredator() {
        // Add a single predator to the scene and store its reference
        const predator = new PredatorGeometry(this.device);
        this.predator = predator;
        this.addObject(predator);
    }

    render(commandEncoder, textureView) {
        // Calculate deltaTime
        const now = performance.now();
        let deltaTime = (now - this.lastTime) / 1000; // in seconds

        if (document.visibilityState !== 'visible') {
            // If not visible, set deltaTime to zero to pause updates
            deltaTime = 0;
        }

        this.lastTime = now;

        // Update deltaTime in the compute shader
        this.pipeline.updateDeltaTime(deltaTime);

        // Update wing phases
        // this.pipeline.updatePhases(now);

        // Handle target change every 10 seconds
        if (now - this.lastTargetChangeTime >= this.targetChangeInterval) {
            this.changeTarget();
            this.lastTargetChangeTime = now;
        }

        // Optionally, adjust flocking parameters dynamically here
        // Example: this.pipeline.setFlockingParameters(separation, alignment, cohesion, centerGravity);

        // Render the pipeline (includes compute pass and render pass)
        const depthView = this.resourceManager.getDepthTextureView();
        const passDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.2, g: 0.5, b: 0.9, a: 1.0 }
                }
            ],
            depthStencilAttachment: {
                view: depthView,
                depthLoadOp: 'clear',
                depthClearValue: 1.0,
                depthStoreOp: 'store'
            }
        };

        this.pipeline.render(commandEncoder, passDescriptor, this.birds, this.predator, textureView, depthView);
    }

    changeTarget() {
        // Select a new target index different from the current one
        let newTargetIndex = Math.floor(Math.random() * this.birdCount);

        // Update the target index in the pipeline
        this.pipeline.updateTargetIndex(newTargetIndex);

        // console.log(`Predator target changed to bird index: ${newTargetIndex}`);
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Reset lastTime to prevent large deltaTime
            this.lastTime = performance.now();
        }
    }

    cleanup() {
        if (this.pipeline) {
            this.pipeline.cleanup();
        }

        // Cleanup birds
        this.birds.forEach((bird) => {
            if (bird.cleanup) {
                bird.cleanup();
            }
        });
        this.birds = [];

        // Cleanup predator
        if (this.predator) {
            this.predator.cleanup();
            this.predator = null;
        }

        document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    onResize(width, height) {
        if (this.pipeline) {
            this.pipeline.updateViewportDimensions(width, height);
        }
    }
}

export default FlockingExperience;