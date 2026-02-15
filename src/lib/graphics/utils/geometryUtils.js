/**
 * Creates a full-screen quad for rendering shaders
 * @returns {Object} Object containing vertices and indices for a full-screen quad
 */
export function createFullScreenQuad() {
    // Vertices for a full-screen quad (positions only)
    const vertices = new Float32Array([
        // Position (x, y, z)
        -1.0, -1.0, 0.0, // bottom-left
         1.0, -1.0, 0.0, // bottom-right
         1.0,  1.0, 0.0, // top-right
        -1.0,  1.0, 0.0  // top-left
    ]);
    
    // Indices for two triangles
    const indices = new Uint16Array([
        0, 1, 2, // first triangle
        0, 2, 3  // second triangle
    ]);
    
    return { vertices, indices };
}

/**
 * Creates a grid of vertices for a plane
 * @param {number} width Width of the grid
 * @param {number} height Height of the grid
 * @param {number} segmentsX Number of segments along X axis
 * @param {number} segmentsY Number of segments along Y axis
 * @returns {Object} Object containing vertices and indices for a grid
 */
export function createGrid(width = 2, height = 2, segmentsX = 10, segmentsY = 10) {
    const vertices = [];
    const indices = [];
    
    // Create vertices
    for (let y = 0; y <= segmentsY; y++) {
        const v = y / segmentsY;
        const posY = (v - 0.5) * height;
        
        for (let x = 0; x <= segmentsX; x++) {
            const u = x / segmentsX;
            const posX = (u - 0.5) * width;
            
            // Position (x, y, z)
            vertices.push(posX, posY, 0);
        }
    }
    
    // Create indices
    for (let y = 0; y < segmentsY; y++) {
        for (let x = 0; x < segmentsX; x++) {
            const a = x + y * (segmentsX + 1);
            const b = x + 1 + y * (segmentsX + 1);
            const c = x + (y + 1) * (segmentsX + 1);
            const d = x + 1 + (y + 1) * (segmentsX + 1);
            
            // Two triangles per grid cell
            indices.push(a, b, c); // first triangle
            indices.push(c, b, d); // second triangle
        }
    }
    
    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
} 