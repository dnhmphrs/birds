struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>
};

struct TimeUniform {
    unused: vec3<f32>,
    time: f32,
}

@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> timeUniform: TimeUniform;

// Function to generate a color based on distance from center and height
fn generateColor(position: vec3<f32>, height: f32, time: f32) -> vec3<f32> {
    // Calculate distance from center
    let distance = sqrt(position.x * position.x + position.y * position.y);
    
    // Create a ripple pattern that moves with time
    let ripple = sin(distance * 10.0 - time * 2.0) * 0.5 + 0.5;
    
    // Base colors
    let innerColor = vec3<f32>(0.0, 0.5, 1.0); // Blue
    let outerColor = vec3<f32>(0.0, 0.8, 0.8); // Teal
    
    // Mix colors based on distance and ripple pattern
    let normalizedDistance = clamp(distance / 2.0, 0.0, 1.0);
    let colorMix = mix(innerColor, outerColor, normalizedDistance + ripple * 0.3);
    
    return colorMix;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Store original position for coloring
    output.worldPos = position;
    
    // Calculate ripple wave with animation
    let time = timeUniform.time;
    let frequency = 5.0;
    let amplitude = 0.2;
    let phase = time * 1.0;
    
    // Calculate distance from center
    let distance = sqrt(position.x * position.x + position.y * position.y);
    
    // Create a modified position with ripple wave as z-coordinate
    var modifiedPosition = position;
    modifiedPosition.z = sin(distance * frequency - phase) * amplitude;
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
    
    // Calculate normal for lighting
    // For a ripple wave, we need to calculate the gradient
    let epsilon = 0.01;
    let dx = (sin((distance + epsilon) * frequency - phase) - 
             sin(distance * frequency - phase)) * amplitude / epsilon;
    
    // The normal points in the direction of the gradient
    let nx = -position.x / distance * dx;
    let ny = -position.y / distance * dx;
    output.normal = normalize(vec3<f32>(nx, ny, 1.0));
    
    // Generate color based on distance and height
    output.color = generateColor(position, modifiedPosition.z, time);
    
    return output;
}

@fragment
fn fragmentMain(
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>
) -> @location(0) vec4<f32> {
    // Enhanced lighting with fixed view direction
    let light_dir = normalize(vec3<f32>(0.5, 0.5, 1.0));
    let diffuse = max(dot(normal, light_dir), 0.0);
    let ambient = 0.3;
    
    // Use a fixed view direction for specular to avoid zoom issues
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    let specular = pow(max(dot(normal, half_dir), 0.0), 32.0) * 0.3;
    
    // Combine lighting components
    let lighting = ambient + diffuse * 0.6 + specular;
    
    return vec4<f32>(color * lighting, 1.0);
} 