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

// Function to generate a color based on height and position
fn generateColor(position: vec3<f32>, height: f32, time: f32) -> vec3<f32> {
    // Create a wave pattern that moves with time
    let wave = sin(position.x * 5.0 + time * 0.5) * 0.5 + 0.5;
    
    // Base colors
    let lowColor = vec3<f32>(0.0, 0.3, 0.8); // Blue
    let highColor = vec3<f32>(0.0, 0.8, 1.0); // Cyan
    
    // Mix colors based on height and wave pattern
    let normalizedHeight = (height + 0.5) * 0.5; // Map from [-0.5, 0.5] to [0, 0.5]
    let colorMix = mix(lowColor, highColor, normalizedHeight + wave * 0.3);
    
    return colorMix;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Store original position for coloring
    output.worldPos = position;
    
    // Calculate sine wave with animation
    let time = timeUniform.time;
    let frequency = 2.0;
    let amplitude = 0.5;
    let phase = time * 0.2;
    
    // Create a modified position with sine wave as z-coordinate
    var modifiedPosition = position;
    modifiedPosition.z = sin(position.x * frequency + phase) * amplitude;
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
    
    // Calculate normal for lighting
    // For a sine wave, the normal can be calculated analytically
    let dx = frequency * cos(position.x * frequency + phase) * amplitude;
    output.normal = normalize(vec3<f32>(-dx, 0.0, 1.0));
    
    // Generate color based on height and position
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