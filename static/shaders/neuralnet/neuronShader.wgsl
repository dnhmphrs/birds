// Common uniforms
@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(7) var<uniform> mousePosition: vec2<f32>;

// Neuron-specific
@group(0) @binding(3) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> activities: array<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) activity: f32,
};

// Vertex shader for neurons
@vertex
fn vertex_main_neuron(
    @location(0) position: vec3<f32>,
    @builtin(instance_index) instance: u32,
) -> VertexOutput {
    var out: VertexOutput;
    let neuronPosition = positions[instance].xyz;
    let worldPosition = position + neuronPosition;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);
    out.activity = activities[instance];
    return out;
}

// Fragment shader for neurons
@fragment
fn fragment_main_neuron(
    @location(0) activity: f32,
    @builtin(position) fragCoord: vec4<f32>
) -> @location(0) vec4<f32> {
    // Check if this is the sink node (instance 0) by checking if activity is exactly -1.0
    // We'll use a special marker value passed from the vertex shader
    let isSink = activity < -0.5;
    
    if (isSink) {
        // Sink node: bright cyan/blue with pulsing effect
        let pulse = sin(fragCoord.x * 0.01 + fragCoord.y * 0.01) * 0.2 + 0.8;
        return vec4<f32>(0.0, 0.8 * pulse, 1.0 * pulse, 0.9);
    } else {
        // Regular neurons
        let inactiveColor = vec4<f32>(0.8, 0.2, 0.2, 0.1); // Default color (dim red)
        let activeColor = vec4<f32>(1.0, 0.5, 0.0, 1.0); // Firing color (bright orange)
        let baseColor = mix(inactiveColor, activeColor, activity);
        return baseColor;
    }
}

// Vertex shader for dendrites (edges)
@vertex
fn vertex_main_dendrite(
    @location(0) position: vec3<f32>
) -> VertexOutput {
    var out: VertexOutput;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(position, 1.0);
    out.activity = 0.0; // Dendrites don't use activity
    return out;
}

// Fragment shader for dendrites
@fragment
fn fragment_main_dendrite() -> @location(0) vec4<f32> {
    let baseColor = vec4<f32>(0.8, 0.2, 0.2, 0.2); // Semi-transparent red for edges
    return baseColor;
}

// Vertex shader for magnetic field lines
@vertex
fn vertex_main_fieldline(
    @location(0) position: vec3<f32>
) -> VertexOutput {
    var out: VertexOutput;
    out.position = projectionMatrix * viewMatrix * vec4<f32>(position, 1.0);
    out.activity = 0.0;
    return out;
}

// Fragment shader for magnetic field lines
@fragment
fn fragment_main_fieldline() -> @location(0) vec4<f32> {
    // Bright cyan/magenta for magnetic field lines
    let fieldColor = vec4<f32>(0.3, 0.8, 1.0, 0.4); // Cyan with transparency
    return fieldColor;
}
