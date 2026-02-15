// shaders/basic2D.wgsl
@group(0) @binding(0) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(1) var<uniform> mousePosition: vec2<f32>;

// Simple noise function based on fragment coordinates
fn noise(coord: vec2<f32>) -> f32 {
    let n = sin(dot(coord, vec2<f32>(12.9898, 78.233))) * (1.0 + mousePosition.x) * 43758.5453;
    return fract(n);
}

@vertex
fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    // Full screen triangle setup
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),  // Bottom-left corner
        vec2<f32>(3.0, -1.0),   // Bottom-right (extends past to cover right)
        vec2<f32>(-1.0, 3.0)    // Top-left (extends past to cover top)
    );
    return vec4<f32>(positions[vertexIndex], 0.0, 1.0);
}

@fragment
fn fragment_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    // Aspect ratio calculation
    let aspectRatio = viewportSize.x / viewportSize.y;

    // Normalize coordinates to [-1.0, 1.0] with center at (0,0), adjusted for aspect ratio
    let screenCoord = ((fragCoord.xy / viewportSize) * 2.0 - vec2<f32>(1.0)) * vec2<f32>(aspectRatio, 1.0);

    // Calculate distance from the center
    let dist = length(screenCoord);

    // Generate a ripple effect based on distance and add mouse influence
    let wave = sin((dist * 10.0 - mousePosition.x * 5.0)) * 0.5 + 0.5;

    // Apply noise to add randomness to the pattern
    let noiseFactor = noise(screenCoord * 10.0) * 0.1;

    // Calculate color using the ripple and noise, centered around the middle of the screen
    let color = vec3<f32>(
        wave + noiseFactor,
        0.3 + 0.5 * wave + noiseFactor,
        0.7 - wave + noiseFactor
    );

    return vec4<f32>(color, 1.0);
}
