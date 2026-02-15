/**
 * ChipFiringSimulation - Implements chip firing dynamics on a graph
 * Uses standard Laplacian operator with parallel firing (no sink node)
 */
export default class ChipFiringSimulation {
	constructor(graph) {
		this.graph = graph;
		this.numNodes = graph.numNodes;
		this.sinkNodeIndex = graph.sinkNodeIndex;
		
		// Current chip distribution
		this.chips = new Array(this.numNodes).fill(0);
		
		// Activity state for visualization (0 to 1, decays over time)
		this.activity = new Array(this.numNodes).fill(0);
		
		// Track which nodes fired in the last step
		this.lastFired = new Set();
		
		// Activity history for each node (for visualization)
		this.activityHistory = Array.from({ length: this.numNodes }, () => []);
		this.maxHistoryLength = 100; // Keep last 100 firing events per node
		
		// Statistics
		this.totalFirings = 0;
		this.stepCount = 0;
		this.sinkChipsAbsorbed = 0; // Track chips absorbed by sink
	}
	
	/**
	 * Initialize chips with random distribution
	 * Each node gets a random number of chips between min and max
	 */
	initializeRandomChips(minChips = 0, maxChips = 10) {
		for (let i = 0; i < this.numNodes; i++) {
			this.chips[i] = Math.floor(Math.random() * (maxChips - minChips + 1)) + minChips;
		}
		
		console.log(`Initialized ${this.chips.reduce((sum, c) => sum + c, 0)} total chips across ${this.numNodes} nodes`);
	}
	
	/**
	 * Set chips for a specific node
	 */
	setChips(nodeIndex, amount) {
		if (nodeIndex >= 0 && nodeIndex < this.numNodes) {
			this.chips[nodeIndex] = amount;
		}
	}
	
	/**
	 * Get chips for a specific node
	 */
	getChips(nodeIndex) {
		return this.chips[nodeIndex] || 0;
	}
	
	/**
	 * Check if a node is unstable (has at least as many chips as its degree)
	 * A node fires when chips[i] >= degree[i]
	 */
	isUnstable(nodeIndex) {
		const degree = this.graph.getDegree(nodeIndex);
		return this.chips[nodeIndex] >= degree && degree > 0;
	}
	
	/**
	 * Find all unstable nodes
	 */
	getUnstableNodes() {
		const unstable = [];
		for (let i = 0; i < this.numNodes; i++) {
			if (this.isUnstable(i)) {
				unstable.push(i);
			}
		}
		return unstable;
	}
	
	/**
	 * Perform one step of parallel chip firing
	 * All unstable nodes fire simultaneously
	 * Sink node (if present) absorbs chips but never fires
	 * Returns the number of nodes that fired
	 */
	step() {
		const unstableNodes = this.getUnstableNodes();
		
		if (unstableNodes.length === 0) {
			return 0; // Stable configuration
		}
		
		// Create a delta array to track changes
		const delta = new Array(this.numNodes).fill(0);
		
		// Process all firings in parallel
		for (const nodeIndex of unstableNodes) {
			// Sink node never fires, just accumulates
			if (nodeIndex === this.sinkNodeIndex) {
				continue;
			}
			
			const degree = this.graph.getDegree(nodeIndex);
			const neighbors = this.graph.getNeighbors(nodeIndex);
			
			// Node loses 'degree' chips
			delta[nodeIndex] -= degree;
			
			// Each neighbor gains 1 chip
			for (const neighbor of neighbors) {
				delta[neighbor] += 1;
				
				// Track chips going to sink
				if (neighbor === this.sinkNodeIndex) {
					this.sinkChipsAbsorbed++;
				}
			}
			
			// Mark this node as having fired (for visualization)
			this.activity[nodeIndex] = 1.0;
			
			// Record firing event in history
			this.activityHistory[nodeIndex].push({
				step: this.stepCount,
				time: Date.now()
			});
			
			// Limit history length
			if (this.activityHistory[nodeIndex].length > this.maxHistoryLength) {
				this.activityHistory[nodeIndex].shift();
			}
		}
		
		// Apply all changes
		for (let i = 0; i < this.numNodes; i++) {
			this.chips[i] += delta[i];
		}
		
		// Update statistics
		this.lastFired = new Set(unstableNodes);
		this.totalFirings += unstableNodes.length;
		this.stepCount++;
		
		return unstableNodes.length;
	}
	
	/**
	 * Run the simulation until stable or max steps reached
	 */
	runUntilStable(maxSteps = 1000) {
		let steps = 0;
		let nodesFired;
		
		do {
			nodesFired = this.step();
			steps++;
		} while (nodesFired > 0 && steps < maxSteps);
		
		console.log(`Reached ${nodesFired === 0 ? 'stable' : 'max steps'} after ${steps} steps`);
		return steps;
	}
	
	/**
	 * Decay activity values over time (for smooth visualization)
	 * Call this every frame to create fading effect
	 */
	decayActivity(decayRate = 0.95) {
		for (let i = 0; i < this.numNodes; i++) {
			this.activity[i] *= decayRate;
		}
	}
	
	/**
	 * Add chips to random nodes (to keep the simulation going)
	 */
	addRandomChips(numChips = 1) {
		for (let i = 0; i < numChips; i++) {
			const randomNode = Math.floor(Math.random() * this.numNodes);
			this.chips[randomNode]++;
		}
	}
	
	/**
	 * Get current state for visualization
	 */
	getState() {
		return {
			chips: [...this.chips],
			activity: [...this.activity],
			lastFired: Array.from(this.lastFired)
		};
	}
	
	/**
	 * Get statistics
	 */
	getStats() {
		const totalChips = this.chips.reduce((sum, c) => sum + c, 0);
		const unstableCount = this.getUnstableNodes().length;
		
		const stats = {
			stepCount: this.stepCount,
			totalFirings: this.totalFirings,
			totalChips,
			unstableNodes: unstableCount,
			avgChipsPerNode: (totalChips / this.numNodes).toFixed(2)
		};
		
		// Add sink-specific stats
		if (this.sinkNodeIndex >= 0) {
			stats.sinkChips = this.chips[this.sinkNodeIndex];
			stats.sinkChipsAbsorbed = this.sinkChipsAbsorbed;
		}
		
		return stats;
	}
	
	/**
	 * Reset the simulation
	 */
	reset() {
		this.chips.fill(0);
		this.activity.fill(0);
		this.lastFired.clear();
		this.totalFirings = 0;
		this.stepCount = 0;
	}
}