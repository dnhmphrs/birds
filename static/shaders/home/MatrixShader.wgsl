struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// Use a simpler uniform structure with explicit alignment
@group(0) @binding(0) var<uniform> time: f32;
@group(0) @binding(1) var<uniform> resolution: vec2<f32>;
@group(0) @binding(2) var<uniform> mouse: vec2<f32>;

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(position, 1.0);
    output.uv = position.xy * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
    return output;
}

// Random function
fn random(st: vec2<f32>) -> f32 {
    return fract(sin(dot(st.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

// Improved hash function for matrix effect
fn hash(p: vec2<f32>) -> f32 {
    // Better quality hash function
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.103, 0.0973));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

// Smooth hash for better transitions
fn smoothHash(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    
    // Cubic interpolation
    let u = f * f * (3.0 - 2.0 * f);
    
    // Mix 4 corners
    let a = hash(i);
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));
    
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

@fragment
fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Adjust UV to maintain aspect ratio
    var uv_aspect = uv;
    uv_aspect.x *= resolution.x / resolution.y;
    
    // Create a grid for the matrix effect
    let grid_size = 40.0;
    var grid_uv = floor(uv_aspect * grid_size) / grid_size;
    
    // Create digital rain effect - offset initial time to fill screen
    let rain_speed = 0.25;
    let initial_offset = 3.0; // Increased initial offset to better fill screen
    let rain_offset = (time + initial_offset) * rain_speed;
    
    // Different columns move at different speeds with more interesting variation
    let column_index = floor(uv_aspect.x * grid_size);
    let column_phase = hash(vec2<f32>(column_index, 0.0)) * 6.28; // Random phase offset per column
    let column_variation = 0.6 + 0.4 * sin(time * 0.1 + column_phase); // Subtle pulsing variation
    let column_offset = rain_offset * column_variation;
    
    // Create falling characters
    var char_pos = grid_uv.y + column_offset;
    char_pos = fract(char_pos);
    
    // Determine which characters are visible with more variation
    let char_hash = hash(grid_uv);
    let density_variation = 0.3 + 0.1 * sin(time * 0.2 + grid_uv.x * 10.0); // Varying density
    let char_threshold = density_variation + char_hash * 0.3;
    
    // Character brightness based on position - smoother fade with head glow
    let fade_pos = char_pos * 1.8;
    let head_glow = smoothstep(0.0, 0.3, char_pos) * smoothstep(0.5, 0.0, char_pos); // Brighter head
    let char_brightness = smoothstep(1.0, 0.0, fade_pos) + head_glow * 0.5;
    
    // Only show characters that meet the threshold
    let char_visible = step(char_pos, char_threshold);
    
    // Very occasional glitch effect - much more subtle and rare
    let glitch_time = floor(time * 0.8);
    let glitch_seed = smoothHash(vec2<f32>(glitch_time, grid_uv.y * 0.5));
    let glitch_amount = step(0.985, glitch_seed) * 0.03;
    let glitch_offset = smoothHash(vec2<f32>(grid_uv.y * 0.3, glitch_time)) * 2.0 - 1.0;
    
    // Apply glitch to grid_uv if needed - avoid southern edge
    if (glitch_amount > 0.0 && uv.y > 0.1) {
        grid_uv.x += glitch_offset * glitch_amount;
    }
    
    // Depth effect - characters further away are dimmer
    let depth_factor = 0.7 + 0.3 * smoothHash(vec2<f32>(grid_uv.x * 2.0, 0.5));
    
    // Subtle color variations - more interesting patterns
    let time_factor = time * 0.2;
    let x_pattern = sin(grid_uv.x * 20.0 + time * 0.1) * 0.5 + 0.5; // Horizontal pattern
    let color_seed = smoothHash(vec2<f32>(grid_uv.x * 0.5, time_factor));
    let color_shift = smoothstep(0.95, 1.0, color_seed * x_pattern); // Smoother transition
    
    // Smoother color amount transition with pattern
    let y_pattern = sin(grid_uv.y * 15.0 - time * 0.05) * 0.5 + 0.5; // Vertical pattern
    let color_amount = smoothHash(vec2<f32>(grid_uv.y * 0.3, time_factor * 0.5)) * y_pattern;
    
    // Base matrix color with more interesting variation
    let base_intensity = 1.3 + 0.3 * head_glow; // Brighter heads
    let matrix_green = 0.8 + 0.2 * sin(time * 0.3 + grid_uv.x * 5.0); // Subtle green variation
    let matrix_color = vec3<f32>(0.0, matrix_green, 0.35) * char_brightness * char_visible * base_intensity * depth_factor;
    
    // More interesting color variations
    let alt_color1 = vec3<f32>(0.0, 0.7, 0.9) * char_brightness * char_visible * base_intensity * depth_factor;
    let alt_color2 = vec3<f32>(0.8, 0.5, 0.0) * char_brightness * char_visible * base_intensity * depth_factor;
    
    // Smoother color mixing with better transitions
    var color = matrix_color;
    color = mix(color, alt_color1, color_shift * color_amount * 0.7); // More subtle mixing
    color = mix(color, alt_color2, color_shift * (1.0 - color_amount) * 0.5); // Even more subtle
    
    // Add subtle scan lines with variation
    let scan_freq = 0.5 + 0.1 * sin(time * 0.2); // Varying scan line frequency
    let scan_line = sin(uv.y * resolution.y * scan_freq) * 0.5 + 0.5;
    color *= 0.95 + scan_line * 0.1;
    
    // Add subtle vignette
    let vignette = 1.0 - length((uv - 0.5) * 1.1);
    color *= vignette;
    
    // Add very subtle noise with variation
    let noise_amount = 0.02 + 0.01 * sin(time * 0.1); // Varying noise
    let noise = random(uv + time * 0.01) * noise_amount;
    color += noise;
    
    return vec4<f32>(color, 1.0);
} 