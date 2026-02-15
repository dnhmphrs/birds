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

// Function to generate color based on height only (no time variation)
fn heightColor(height: f32) -> vec3<f32> {
    // Map height to a [0, 1] range for coloring logic
    let normalizedHeight = clamp((height + 1.5) * 0.4, 0.0, 1.0);
    
    // Fixed vibrant color palette
    let color1 = vec3<f32>(0.5, 0.0, 0.8); // Purple
    let color2 = vec3<f32>(0.1, 0.3, 0.9); // Deep blue
    let color3 = vec3<f32>(0.0, 0.8, 0.8); // Cyan
    let color4 = vec3<f32>(0.0, 0.8, 0.2); // Green

    var finalColor: vec3<f32>;
    if (normalizedHeight < 0.33) {
        finalColor = mix(color1, color2, normalizedHeight * 3.0);
    } else if (normalizedHeight < 0.66) {
        finalColor = mix(color2, color3, (normalizedHeight - 0.33) * 3.0);
    } else {
        finalColor = mix(color3, color4, (normalizedHeight - 0.66) * 3.0);
    }

    return finalColor;
}

// A dramatically changing surface function with mathematically sound origin handling
fn surfaceFunction(x: f32, y: f32, time: f32) -> f32 {
    // Convert to polar coordinates
    let r = sqrt(x * x + y * y);
    let theta = atan2(y, x);
    
    // Meromorphic function components
    
    // Moving poles at controlled distances from origin
    let pole1X = sin(time * 0.3) * 1.0;
    let pole1Y = cos(time * 0.4) * 1.0;
    let pole2X = sin(time * 0.5 + 2.0) * 1.0;
    let pole2Y = cos(time * 0.2 + 1.0) * 1.0;
    
    // Distances to poles for meromorphic function
    let dist1 = sqrt(pow(x - pole1X, 2.0) + pow(y - pole1Y, 2.0));
    let dist2 = sqrt(pow(x - pole2X, 2.0) + pow(y - pole2Y, 2.0));
    
    // Avoid true singularities by adding small epsilon
    let epsilon = 0.1;
    
    // Laurent series-like approach for poles
    let pole1Term = 1.0 / max(dist1, epsilon);
    let pole2Term = 0.8 / max(dist2, epsilon);
    
    // Scale down the effect for visual balance
    let poleEffect = (pole1Term + pole2Term) * 0.25;
    
    // Add a wave pattern based on distance and angle - maintains meromorphicity
    // using pure trigonometric functions of r and theta
    let waveFreq = 3.0 + sin(time * 0.2);
    let wave = 0.3 * sin(r * waveFreq + time * 1.5);
    
    // Add spiral term (varies with angle)
    let spiral = 0.2 * sin(theta * 3.0 + r * 2.0 + time * 0.7);
    
    // Combine effects in a way that maintains meromorphicity
    // Linear combination of meromorphic functions remains meromorphic
    var height = poleEffect + wave + spiral;
    
    // Add gentle overall pulsing
    let pulse = 0.2 * sin(time * 0.4) + 0.8;
    height *= pulse;
    
    return height;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;

    // Store original position for fragment calculations
    output.worldPos = position;

    // Use time with a reasonable scale
    let time = timeUniform.time * 1.0;

    // Calculate the new height using our surface function
    let height = surfaceFunction(position.x, position.y, time);

    // Adjust the vertex's z based on the calculated height
    var modifiedPosition = position;
    modifiedPosition.z = height;

    // Transform position with view and projection
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);

    // Calculate normals using central differences for better accuracy
    let distFromOrigin = sqrt(position.x * position.x + position.y * position.y);
    
    // Adaptive epsilon based on distance from origin for better derivatives
    let epsilon = max(0.05, 0.02 * distFromOrigin);
    
    // Central differences for more accurate normal calculation
    let dx = (surfaceFunction(position.x + epsilon, position.y, time) - 
              surfaceFunction(position.x - epsilon, position.y, time)) / (2.0 * epsilon);
    
    let dy = (surfaceFunction(position.x, position.y + epsilon, time) - 
              surfaceFunction(position.x, position.y - epsilon, time)) / (2.0 * epsilon);
    
    // Normal vector (-df/dx, -df/dy, 1.0)
    var normal = vec3<f32>(-dx, -dy, 1.0);
    
    // Normalize the normal vector
    let len = length(normal);
    if (len > 0.001) {
        normal = normal / len;
    } else {
        // Fallback if we have a degenerate normal (extremely unlikely with our new function)
        normal = vec3<f32>(0.0, 0.0, 1.0);
    }
    
    output.normal = normal;

    // Generate color from height only (no time influence)
    output.color = heightColor(height);

    return output;
}

@fragment
fn fragmentMain(
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>
) -> @location(0) vec4<f32> {
    // Enhanced lighting
    let light_dir = normalize(vec3<f32>(0.5, 0.5, 1.0));
    let diffuse = max(dot(normal, light_dir), 0.0);
    let ambient = 0.3;

    // Enhanced specular highlight
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    let specular = pow(max(dot(normal, half_dir), 0.0), 64.0) * 0.5;

    // Combine lighting with enhanced specular
    let lighting = ambient + diffuse * 0.7 + specular;

    return vec4<f32>(color * lighting, 1.0);
}
