// predatorShader.wgsl

@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(3) var<storage, read> predatorPosition: vec3<f32>;
@group(0) @binding(4) var<storage, read> predatorVelocity: vec3<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) vNormal: vec3<f32>,
};

@vertex
fn vertex_main(@location(0) vertexPosition: vec3<f32>) -> VertexOutput {
    var out: VertexOutput;

    // Retrieve predator's velocity
    let velocity = predatorVelocity;
    let speed = length(velocity);

    // Calculate forward direction (negative velocity for correct orientation)
    let forward = normalize(velocity);

    // Use a stable up vector calculation
    var up = vec3<f32>(0.0, 1.0, 0.0);

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

    // Apply rotation to the vertex position
    let rotatedPosition = rotationMatrix * vertexPosition;

    // Combine with predator's global position
    let worldPosition = rotatedPosition + predatorPosition;

    // Transform to clip space
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    // Assign a distinct red color for the predator
    out.color = vec3<f32>(1.0, 0.0, 0.0);

    // Calculate normal for potential lighting (optional)
    out.vNormal = normalize(rotationMatrix * vec3<f32>(0.0, 1.0, 0.0));

    return out;
}

@fragment
fn fragment_main(@location(0) color: vec3<f32>, @location(1) vNormal: vec3<f32>) -> @location(0) vec4<f32> {
    // Simple lighting
    // let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));
    // let lightIntensity = max(dot(vNormal, lightDir), 0.0);
    // let finalColor = color * lightIntensity;
    return vec4<f32>(color, 1.0);
}