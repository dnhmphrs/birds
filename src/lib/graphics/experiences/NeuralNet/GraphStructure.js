/**
 * GraphStructure - Handles graph generation and embedding
 * Generates Erdős-Rényi random graphs and embeds nodes in a unit ball
 */
export default class GraphStructure {
	constructor(numNodes, connectivity, useSinkNode = true) {
		this.numNodes = numNodes;
		this.connectivity = connectivity; // Probability of edge between any two nodes (0 to 1)
		this.useSinkNode = useSinkNode;
		this.sinkNodeIndex = useSinkNode ? 0 : -1; // First node is the sink if enabled
		
		this.adjacencyList = new Map(); // Map of node -> Set of neighbors
		this.edgeList = []; // Array of [source, target] pairs
		
		this.generateGraph();
	}
	
	/**
	 * Generate an Erdős-Rényi random graph
	 * For each pair of nodes, add an edge with probability p (connectivity)
	 * If sink node is enabled, connect all nodes to the sink
	 */
	generateGraph() {
		// Initialize adjacency list
		for (let i = 0; i < this.numNodes; i++) {
			this.adjacencyList.set(i, new Set());
		}
		
		// If using sink node, connect all nodes to it
		if (this.useSinkNode) {
			for (let i = 1; i < this.numNodes; i++) {
				// Connect node i to sink (node 0)
				this.adjacencyList.get(i).add(this.sinkNodeIndex);
				this.adjacencyList.get(this.sinkNodeIndex).add(i);
				this.edgeList.push([i, this.sinkNodeIndex]);
			}
		}
		
		// Generate edges using Erdős-Rényi model (between non-sink nodes)
		const startIdx = this.useSinkNode ? 1 : 0;
		for (let i = startIdx; i < this.numNodes; i++) {
			for (let j = i + 1; j < this.numNodes; j++) {
				if (Math.random() < this.connectivity) {
					// Add undirected edge
					this.adjacencyList.get(i).add(j);
					this.adjacencyList.get(j).add(i);
					
					this.edgeList.push([i, j]);
				}
			}
		}
		
		console.log(`Generated Erdős-Rényi graph with ${this.numNodes} nodes and ${this.edgeList.length} edges`);
		if (this.useSinkNode) {
			console.log(`Sink node at index ${this.sinkNodeIndex} with degree ${this.getDegree(this.sinkNodeIndex)}`);
		}
		console.log(`Average degree: ${(2 * this.edgeList.length / this.numNodes).toFixed(2)}`);
	}
	
	/**
	 * Embed nodes randomly in a unit ball (sphere with radius 1)
	 * Uses rejection sampling to ensure uniform distribution
	 * If sink node exists, it's placed at the center (0, 0, 0)
	 */
	embedInUnitBall() {
		const positions = [];
		
		for (let i = 0; i < this.numNodes; i++) {
			// If this is the sink node, place it at center
			if (this.useSinkNode && i === this.sinkNodeIndex) {
				positions.push([0, 0, 0]);
				continue;
			}
			
			let x, y, z, radiusSquared;
			
			// Rejection sampling: generate points until we get one inside unit sphere
			do {
				x = Math.random() * 2 - 1; // Range [-1, 1]
				y = Math.random() * 2 - 1;
				z = Math.random() * 2 - 1;
				radiusSquared = x * x + y * y + z * z;
			} while (radiusSquared > 1.0);
			
			positions.push([x, y, z]);
		}
		
		return positions;
	}
	
	/**
	 * Scale positions to fit in a box of given size
	 */
	scalePositions(positions, scale = 200) {
		return positions.map(([x, y, z]) => [
			x * scale,
			y * scale,
			z * scale
		]);
	}
	
	/**
	 * Get the neighbors of a node
	 */
	getNeighbors(nodeIndex) {
		return this.adjacencyList.get(nodeIndex) || new Set();
	}
	
	/**
	 * Get degree (number of connections) of a node
	 */
	getDegree(nodeIndex) {
		return this.adjacencyList.get(nodeIndex)?.size || 0;
	}
	
	/**
	 * Get all edges as array of [source, target] pairs
	 */
	getEdges() {
		return this.edgeList;
	}
	
	/**
	 * Get graph statistics
	 */
	getStats() {
		const degrees = Array.from(this.adjacencyList.values()).map(neighbors => neighbors.size);
		const avgDegree = degrees.reduce((sum, d) => sum + d, 0) / this.numNodes;
		const maxDegree = Math.max(...degrees);
		const minDegree = Math.min(...degrees);
		
		return {
			numNodes: this.numNodes,
			numEdges: this.edgeList.length,
			avgDegree: avgDegree.toFixed(2),
			maxDegree,
			minDegree,
			connectivity: this.connectivity
		};
	}
}