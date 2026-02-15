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

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Store original position for fragment shader
    output.worldPos = position;
    
    // Force z to zero to ensure the surface is always flat
    var flatPosition = vec3<f32>(position.x, position.y, 0.0);
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(flatPosition, 1.0);
    
    // Use true flat normal
    output.normal = vec3<f32>(0.0, 0.0, 1.0);
    
    // Use a solid color for the flat surface
    output.color = vec3<f32>(0.2, 0.4, 0.8); // Consistent blue color
    
    return output;
}

@fragment
fn fragmentMain(
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>
) -> @location(0) vec4<f32> {
    // Just use the color with minimal lighting
    return vec4<f32>(color, 1.0);
} 