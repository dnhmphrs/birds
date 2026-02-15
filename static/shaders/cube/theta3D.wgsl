// shaders/theta3D.wgsl
@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> modelMatrix: mat4x4<f32>;
@group(0) @binding(3) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(4) var<uniform> mousePosition: vec2<f32>;

// Constants
const pi = 3.14159265358979323846;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>
};

@vertex
fn vertex_main(@location(0) position: vec3<f32>) -> VertexOutput {
    var out: VertexOutput;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(position, 1.0);
    out.color = vec3<f32>(position.x * 0.5 + 0.5, position.y * 0.5 + 0.5, position.z * 0.5 + 0.5);
    return out;
}


@fragment
fn fragment_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, 1.0); // Output color with full opacity
}
