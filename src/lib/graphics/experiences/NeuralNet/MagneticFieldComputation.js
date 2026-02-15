/**
 * MagneticFieldComputation - Computes the dual magnetic field from chip firing currents
 * 
 * Theory:
 * - Chip firing creates discrete "currents" along edges when chips flow
 * - These currents generate a magnetic field via a discrete Hodge star operator
 * - The field is the dual of the edge currents on the graph
 * - We compute field lines by integrating the dual 1-form
 */
export default class MagneticFieldComputation {
	constructor(graph, positions) {
		this.graph = graph;
		this.positions = positions;
		this.numNodes = graph.numNodes;
		this.edges = graph.getEdges();
		
		// Current state (flow on edges)
		this.edgeCurrents = new Map(); // Map: edge key -> current value
		
		// Magnetic field (dual to currents)
		this.fieldStrength = new Map(); // Map: face/region -> field strength
		
		// Field lines for visualization
		this.fieldLines = [];
		
		this.initializeEdgeCurrents();
	}
	
	/**
	 * Initialize edge currents to zero
	 */
	initializeEdgeCurrents() {
		for (const [source, target] of this.edges) {
			const key = this.getEdgeKey(source, target);
			this.edgeCurrents.set(key, 0);
		}
	}
	
	/**
	 * Get canonical edge key (sorted to make undirected)
	 */
	getEdgeKey(i, j) {
		return i < j ? `${i}-${j}` : `${j}-${i}`;
	}
	
	/**
	 * Update edge currents from chip firing events
	 * When node i fires, it sends chips to neighbors, creating currents along edges
	 */
	updateCurrentsFromFiring(firedNodes, neighborMap) {
		// Decay existing currents (simulates resistance/dissipation)
		for (const [key, current] of this.edgeCurrents) {
			this.edgeCurrents.set(key, current * 0.95);
		}
		
		// Add new currents from firing events
		for (const nodeIndex of firedNodes) {
			const neighbors = neighborMap[nodeIndex] || new Set();
			
			for (const neighbor of neighbors) {
				const key = this.getEdgeKey(nodeIndex, neighbor);
				const current = this.edgeCurrents.get(key) || 0;
				
				// Current flows from nodeIndex to neighbor
				// Sign convention: positive if nodeIndex < neighbor
				const sign = nodeIndex < neighbor ? 1 : -1;
				this.edgeCurrents.set(key, current + sign);
			}
		}
	}
	
	/**
	 * Compute magnetic field strength using discrete Hodge star
	 * 
	 * In the continuum: B = *J where * is the Hodge star and J is current
	 * Discretely: We compute circulation around each "face" (cycles in graph)
	 * 
	 * For 3D embedded graph, we use a simplified approach:
	 * - Each edge with current creates a circular field around it
	 * - Field strength at point p is sum of contributions from all edges
	 * - This approximates the continuous curl operator
	 */
	computeMagneticField() {
		// For each edge with current, compute its contribution to field
		this.fieldStrength.clear();
		
		// Sample field at grid points in 3D space
		const gridSize = 200; // 20x20x20 grid
		const bounds = 250; // Match neuron positions scale
		const step = (2 * bounds) / gridSize;
		
		for (let ix = 0; ix < gridSize; ix++) {
			for (let iy = 0; iy < gridSize; iy++) {
				for (let iz = 0; iz < gridSize; iz++) {
					const px = -bounds + ix * step;
					const py = -bounds + iy * step;
					const pz = -bounds + iz * step;
					
					const field = this.computeFieldAtPoint([px, py, pz]);
					const key = `${ix},${iy},${iz}`;
					this.fieldStrength.set(key, field);
				}
			}
		}
	}
	
	/**
	 * Compute magnetic field at a point using Biot-Savart-like formula
	 * B(r) = sum over edges of (I_e × r_e) / |r_e|^3
	 * where I_e is current on edge e, r_e is vector from edge to point
	 */
	computeFieldAtPoint(point) {
		const field = [0, 0, 0];
		
		for (const [source, target] of this.edges) {
			const key = this.getEdgeKey(source, target);
			const current = this.edgeCurrents.get(key) || 0;
			
			if (Math.abs(current) < 0.01) continue;
			
			const p1 = this.positions[source];
			const p2 = this.positions[target];
			
			// Edge midpoint
			const midpoint = [
				(p1[0] + p2[0]) / 2,
				(p1[1] + p2[1]) / 2,
				(p1[2] + p2[2]) / 2
			];
			
			// Edge direction (tangent)
			const tangent = [
				p2[0] - p1[0],
				p2[1] - p1[1],
				p2[2] - p1[2]
			];
			
			// Vector from edge to point
			const r = [
				point[0] - midpoint[0],
				point[1] - midpoint[1],
				point[2] - midpoint[2]
			];
			
			const rMag = Math.sqrt(r[0]*r[0] + r[1]*r[1] + r[2]*r[2]);
			
			if (rMag < 1e-6) continue; // Skip if too close
			
			// Cross product: I × r (current direction × position vector)
			const cross = [
				current * (tangent[1] * r[2] - tangent[2] * r[1]),
				current * (tangent[2] * r[0] - tangent[0] * r[2]),
				current * (tangent[0] * r[1] - tangent[1] * r[0])
			];
			
			// Divide by r^3 (Biot-Savart law)
			const factor = 1.0 / (rMag * rMag * rMag + 1e-6);
			
			field[0] += cross[0] * factor;
			field[1] += cross[1] * factor;
			field[2] += cross[2] * factor;
		}
		
		return field;
	}
	
	/**
	 * Generate field lines by integrating the field
	 * Start from seed points and follow the field direction
	 */
	generateFieldLines(numLines = 20, stepsPerLine = 100, stepSize = 10) {
		this.fieldLines = [];
		
		// Create seed points around the center
		const seedRadius = 150;
		
		for (let i = 0; i < numLines; i++) {
			const theta = (i / numLines) * 2 * Math.PI;
			const phi = Math.acos(2 * Math.random() - 1);
			
			const startPoint = [
				seedRadius * Math.sin(phi) * Math.cos(theta),
				seedRadius * Math.sin(phi) * Math.sin(theta),
				seedRadius * Math.cos(phi)
			];
			
		const line = this.integrateFieldLine(startPoint, stepsPerLine, stepSize);
		
		// Accept lines with at least 2 points (minimum for a visible line)
		if (line.length >= 2) {
			this.fieldLines.push(line);
		}
		}
		
		return this.fieldLines;
	}
	
	/**
	 * Integrate a single field line using RK2 (midpoint method)
	 */
	integrateFieldLine(startPoint, steps, stepSize) {
		const line = [startPoint];
		let currentPoint = [...startPoint];
		
		for (let i = 0; i < steps; i++) {
			// Get field at current point
			const field = this.computeFieldAtPoint(currentPoint);
			const fieldMag = Math.sqrt(field[0]*field[0] + field[1]*field[1] + field[2]*field[2]);
			
		// Stop if field is too weak or we're out of bounds
		// Lower threshold to generate more field lines even with weak fields
		if (fieldMag < 0.0001 || this.isOutOfBounds(currentPoint)) {
			break;
		}
			
			// Normalize field direction
			const direction = [
				field[0] / fieldMag,
				field[1] / fieldMag,
				field[2] / fieldMag
			];
			
			// Take step using RK2
			const midpoint = [
				currentPoint[0] + direction[0] * stepSize * 0.5,
				currentPoint[1] + direction[1] * stepSize * 0.5,
				currentPoint[2] + direction[2] * stepSize * 0.5
			];
			
			const midField = this.computeFieldAtPoint(midpoint);
			const midFieldMag = Math.sqrt(midField[0]*midField[0] + midField[1]*midField[1] + midField[2]*midField[2]);
			
			if (midFieldMag < 0.0001) break;
			
			const midDirection = [
				midField[0] / midFieldMag,
				midField[1] / midFieldMag,
				midField[2] / midFieldMag
			];
			
			// Update position
			currentPoint = [
				currentPoint[0] + midDirection[0] * stepSize,
				currentPoint[1] + midDirection[1] * stepSize,
				currentPoint[2] + midDirection[2] * stepSize
			];
			
			line.push([...currentPoint]);
		}
		
		return line;
	}
	
	/**
	 * Check if point is out of bounds
	 */
	isOutOfBounds(point) {
		const bound = 300;
		return Math.abs(point[0]) > bound || 
		       Math.abs(point[1]) > bound || 
		       Math.abs(point[2]) > bound;
	}
	
	/**
	 * Get current statistics for debugging
	 */
	getCurrentStats() {
		let totalCurrent = 0;
		let maxCurrent = 0;
		let activEdges = 0;
		
		for (const current of this.edgeCurrents.values()) {
			const absCurrent = Math.abs(current);
			totalCurrent += absCurrent;
			maxCurrent = Math.max(maxCurrent, absCurrent);
			if (absCurrent > 0.01) activEdges++;
		}
		
		return {
			totalCurrent: totalCurrent.toFixed(2),
			maxCurrent: maxCurrent.toFixed(2),
			activeEdges,
			fieldLines: this.fieldLines.length
		};
	}
}