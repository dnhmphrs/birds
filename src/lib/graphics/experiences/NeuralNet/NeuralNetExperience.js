import Experience from '../Experience';
import NeuronGeometry from './NeuronGeometry';
import NeuralNetPipeline from './NeuralNetPipeline';
import GraphStructure from './GraphStructure';
import ChipFiringSimulation from './ChipFiringSimulation';
import MagneticFieldComputation from './MagneticFieldComputation';

class NeuralNetExperience extends Experience {
	constructor(device, resourceManager) {
		super(device, resourceManager);

		// Graph parameters
		this.numNodes = 150; // Number of neurons in the network
		this.connectivity = 0.015; // Erdős-Rényi connectivity probability (adjust for desired density)
		
		// Simulation parameters
		this.minChips = 2;
		this.maxChips = 8;
		this.autoAddChips = true; // Continuously add chips to keep simulation active
		this.chipsPerStep = 1; // Number of random chips to add each step
		this.stepsPerFrame = 1; // Number of simulation steps per render frame
		
		// Create graph structure
		this.graph = new GraphStructure(this.numNodes, this.connectivity);
		
		// Create chip firing simulation
		this.chipFiring = new ChipFiringSimulation(this.graph);
		
		// Initialize with random chips
		this.chipFiring.initializeRandomChips(this.minChips, this.maxChips);
		
		// Magnetic field computation
		this.magneticFieldEnabled = true;
		this.magneticField = null; // Will be initialized after positions are set
		this.showMagneticField = true; // Toggle for visualization
		
		// Add neuron geometries
		this.addNeurons();
		
		console.log('Graph stats:', this.graph.getStats());
	}

	async initialize() {
		// Embed nodes in unit ball and scale to desired size
		const unitBallPositions = this.graph.embedInUnitBall();
		this.positions = this.graph.scalePositions(unitBallPositions, 200);
		
		// Get edges from graph
		const edges = this.graph.getEdges();
		
		// Convert edges to connection format expected by pipeline
		this.connections = edges.map(([source, target]) => ({
			source,
			target
		}));
		
		console.log(`Initialized ${this.numNodes} nodes with ${this.connections.length} edges`);

		// Initialize the pipeline (without cube)
		this.pipeline = new NeuralNetPipeline(
			this.device,
			this.resourceManager.camera,
			this.resourceManager.getViewportBuffer(),
			this.resourceManager.getMouseBuffer(),
			this.numNodes,
			this.connections.length
		);
		await this.pipeline.initialize();

		// Pass positions and connections to the pipeline
		this.pipeline.updatePositions(this.positions);
		this.pipeline.updateConnections(this.connections, this.positions);
		
		// Initialize magnetic field computation
		this.magneticField = new MagneticFieldComputation(this.graph, this.positions);
		console.log('Magnetic field computation initialized');
	}

	addNeurons() {
		// Add neuron geometries
		for (let i = 0; i < this.numNodes; i++) {
			this.addObject(new NeuronGeometry(this.device));
		}
	}

	render(commandEncoder, textureView) {
		// Run chip firing simulation steps
		const firedNodes = [];
		for (let i = 0; i < this.stepsPerFrame; i++) {
			const fired = this.chipFiring.step();
			
			// Track which nodes fired for magnetic field computation
			if (fired > 0 && this.magneticField) {
				firedNodes.push(...Array.from(this.chipFiring.lastFired));
			}
			
			// Optionally add random chips to keep simulation active
			if (this.autoAddChips) {
				this.chipFiring.addRandomChips(this.chipsPerStep);
			}
		}
		
		// Update magnetic field from firings
		if (this.magneticField && firedNodes.length > 0) {
			// Convert to neighbor map for current computation
			const neighborMap = [];
			for (let i = 0; i < this.numNodes; i++) {
				neighborMap[i] = this.graph.getNeighbors(i);
			}
			
			this.magneticField.updateCurrentsFromFiring(firedNodes, neighborMap);
		}
		
		// Periodically regenerate field lines (every 30 frames, or immediately when toggled on)
		if (!this._fieldLineCounter) this._fieldLineCounter = 0;
		this._fieldLineCounter++;
		
		// Check if magnetic field was just enabled
		const fieldJustEnabled = this.magneticFieldEnabled && !this._previousMagneticFieldEnabled;
		this._previousMagneticFieldEnabled = this.magneticFieldEnabled;
		
		if (this.magneticField && this.magneticFieldEnabled) {
			// Generate field lines immediately when enabled, or every 30 frames
			if (fieldJustEnabled || this._fieldLineCounter % 30 === 0) {
				const fieldLines = this.magneticField.generateFieldLines(30, 80, 10);
				
				// Pass field lines to pipeline for rendering
				if (fieldLines.length > 0) {
					this.pipeline.updateFieldLines(fieldLines);
					console.log(`Generated ${fieldLines.length} field lines with ${fieldLines.reduce((sum, line) => sum + line.length, 0)} total points`);
				} else {
					// Clear field lines if none generated
					this.pipeline.updateFieldLines([]);
				}
			}
		} else if (this.magneticField && !this.magneticFieldEnabled) {
			// Clear field lines when magnetic field is disabled
			this.pipeline.updateFieldLines([]);
		}
		
		// Decay activity for smooth visualization
		this.chipFiring.decayActivity(0.92);
		
		// Get current activity state
		const state = this.chipFiring.getState();
		
		// Update activity in pipeline (pass sink node index)
		this.pipeline.updateActivityFromChipFiring(state.activity, this.graph.sinkNodeIndex);
		
		// Dispatch event with current state for UI components
		if (typeof window !== 'undefined') {
			const event = new CustomEvent('chip-firing-update', {
				detail: {
					chips: this.chipFiring.chips,
					activity: state.activity,
					activityHistory: this.chipFiring.activityHistory,
					stats: this.chipFiring.getStats(),
					sinkNodeIndex: this.graph.sinkNodeIndex
				}
			});
			window.dispatchEvent(event);
		}

		// Render the pipeline
		const depthView = this.resourceManager.getDepthTextureView();
		const passDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: 'clear',
					storeOp: 'store',
					clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 }
				}
			],
			depthStencilAttachment: {
				view: depthView,
				depthLoadOp: 'clear',
				depthClearValue: 1.0,
				depthStoreOp: 'store'
			}
		};

		// Render
		this.pipeline.render(commandEncoder, passDescriptor, this.objects, this.numNodes);
	}


	cleanup() {
		// Clean up pipeline
		if (this.pipeline) {
			this.pipeline.cleanup();
			this.pipeline = null;
		}

		// Clean up simulation and graph
		if (this.chipFiring) {
			this.chipFiring.reset();
			this.chipFiring = null;
		}
		
		if (this.graph) {
			this.graph = null;
		}

		// Reset state
		this.connections = [];
		this.positions = null;
		
		// Call parent cleanup to handle objects and resource tracking
		super.cleanup();
	}
}

export default NeuralNetExperience;