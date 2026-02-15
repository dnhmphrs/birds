// birdShader.wgsl

@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(3) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(4) var<storage, read> phases: array<f32>;
@group(0) @binding(5) var<uniform> mousePosition: vec2<f32>;
@group(0) @binding(6) var<storage, read> velocities: array<vec3<f32>>; // Velocity Buffer

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) vNormal: vec3<f32>,
};

@vertex
fn vertex_main(@location(0) vertexPosition: vec3<f32>, @builtin(instance_index) instance: u32) -> VertexOutput {
    var out: VertexOutput;

    // Get the bird's unique position and phase
    let birdPosition = positions[instance];
    let birdPhase = phases[instance];
    let birdVelocity = velocities[instance];

    // Calculate forward direction (negative velocity for correct orientation)
    let forward = normalize(-birdVelocity);

    // Use a stable up vector calculation
    var up = vec3<f32>(0.0, 1.0, 0.0);
    
    // Handle near-vertical cases
    let upAlignment = abs(dot(forward, up));
    if (upAlignment > 0.99) {
        // If looking almost straight up/down, use a different reference vector
        up = vec3<f32>(0.0, 0.0, 1.0);
    }

    // Calculate right vector
    let right = normalize(cross(forward, up));
    
    // Recalculate actual up vector to ensure orthogonality
    up = normalize(cross(right, forward));

    // Create rotation matrix from orthonormal basis
    let rotationMatrix = mat3x3<f32>(
        right.x, up.x, forward.x,
        right.y, up.y, forward.y,
        right.z, up.z, forward.z
    );

    // Apply rotation to vertex position
    var rotatedPosition = rotationMatrix * vertexPosition; // Changed to var

    // // Animate wings based on phase and velocity
    // let wingFlap = sin(birdPhase) * 5.0 + length(birdVelocity) * 0.1;
    // if (rotatedPosition.x > 0.0) { // Right wing
    //     rotatedPosition.y += wingFlap;
    // } else if (rotatedPosition.x < 0.0) { // Left wing
    //     rotatedPosition.y += wingFlap;
    // }

    // Combine with bird's global position
    let worldPosition = rotatedPosition + birdPosition;

    // Transform to clip space
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    out.color = vec3<f32>(0.0, 0.0, 0.0);

    // // Assign colors based on vertex position
    // if (vertexPosition.z > 15.0 || vertexPosition.z < -15.0) {
    //     // Wings
    //     out.color = vec3<f32>(1.0, 1.0, 1.0);
    // } else {
    //     // Body
    //     out.color = vec3<f32>(0.0, 0.0, 0.0);
    // }
    
    // // Add variation
    // out.color += vec3<f32>(
    //     fract(sin(birdVelocity.x) * 43758.5453123),
    //     fract(sin(birdVelocity.y) * 43758.5453123),
    //     fract(sin(birdVelocity.z) * 43758.5453123)
    // );

    // Set normal for potential lighting (optional)
    out.vNormal = normalize(rotationMatrix * vec3<f32>(0.0, 1.0, 0.0));

    return out;
}

@fragment
fn fragment_main(@location(0) color: vec3<f32>, @location(1) vNormal: vec3<f32>) -> @location(0) vec4<f32> {
    // Simple lighting
    let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));
    let lightIntensity = max(dot(vNormal, lightDir), 0.0);
    let finalColor = color * lightIntensity;
    return vec4<f32>(finalColor, 1.0);
}