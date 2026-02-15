// guidingLineShader.wgsl

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<storage, read> guidingLine: array<vec4<f32>, 2>;

@vertex
fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;

    // Fetch the corresponding position from the guidingLine buffer
    let pos = guidingLine[vertexIndex].xyz; // Use only x, y, z

    // Transform to clip space
    out.position = projectionMatrix * viewMatrix * vec4<f32>(pos, 1.0);
    return out;
}

@fragment
fn fragment_main() -> @location(0) vec4<f32> {
    // Solid red color for the line
    return vec4<f32>(0.0, 1.0, 0.0, 1.0);
}