struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>,
    @location(3) height: f32 // Store the actual height value
};

struct TimeUniform {
    unused: vec3<f32>,
    time: f32,
}

// Add new uniform for KP shader parameters
struct KPParams {
    // Scale index (0, 1, 2, 3, 4, 5) for discrete scales
    scaleIndex: f32,
    // Distortion amount (0.0 to 1.0)
    distortion: f32,
    // Padding to ensure alignment
    padding1: f32,
    padding2: f32,
}

@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> timeUniform: TimeUniform;
@group(0) @binding(3) var<uniform> kpParams: KPParams;

// Function to generate color based on height using a jet-like colormap (blue to red)
// Now with distortion parameter to bias toward yellow/red
fn gridCellColormap(height: f32, distortion: f32) -> vec3<f32> {
    // For negative heights, use dark blue for flat areas
    if (height <= 0.0) {
        return vec3<f32>(0.0, 0.0, 0.4);
    }
    
    // For positive heights, use a jet-like colormap (blue -> cyan -> green -> yellow -> red)
    // Normalize height to [0, 1] range with a fixed maximum
    let maxHeight = 0.2;
    let normalizedHeight = min(height / maxHeight, 1.0);
    
    // Apply a more subtle distortion bias to normalized height
    // Reduced from 0.8 to 0.4 for less severe color mapping
    let biasedHeight = normalizedHeight * (1.0 + distortion * 0.4);
    
    // Create a jet-like colormap with 5 color bands
    if (biasedHeight < 0.2) {
        // Blue to cyan (0.0 - 0.2)
        let t = biasedHeight / 0.2;
        return mix(vec3<f32>(0.0, 0.0, 0.8), vec3<f32>(0.0, 0.5, 1.0), t);
    } else if (biasedHeight < 0.4) {
        // Cyan to green (0.2 - 0.4)
        let t = (biasedHeight - 0.2) / 0.2;
        return mix(vec3<f32>(0.0, 0.5, 1.0), vec3<f32>(0.0, 0.8, 0.3), t);
    } else if (biasedHeight < 0.6) {
        // Green to yellow (0.4 - 0.6)
        let t = (biasedHeight - 0.4) / 0.2;
        return mix(vec3<f32>(0.0, 0.8, 0.3), vec3<f32>(1.0, 1.0, 0.0), t);
    } else if (biasedHeight < 0.8) {
        // Yellow to orange (0.6 - 0.8)
        let t = (biasedHeight - 0.6) / 0.2;
        return mix(vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.5, 0.0), t);
    } else {
        // Orange to red (0.8 - 1.0)
        let t = min((biasedHeight - 0.8) / 0.2, 1.0); // Clamp to avoid going beyond red
        return mix(vec3<f32>(1.0, 0.5, 0.0), vec3<f32>(1.0, 0.0, 0.0), t);
    }
}

// Function to get scale factor based on scale index
fn getScaleFactor(scaleIndex: f32) -> f32 {
    // Harmonic scaling ratio based on theta function properties
    // Each step multiplies by sqrt(2) for a natural scaling progression
    let baseScale = 1.5;
    
    if (scaleIndex <= 0.5) {
        return baseScale / 2.0; // Scale 0: zoomed out
    } else if (scaleIndex <= 1.5) {
        return baseScale / 1.414; // Scale 1: zoomed out / sqrt(2)
    } else if (scaleIndex <= 2.5) {
        return baseScale; // Scale 2: base scale
    } else if (scaleIndex <= 3.5) {
        return baseScale * 1.414; // Scale 3: base scale * sqrt(2)
    } else if (scaleIndex <= 4.5) {
        return baseScale * 2.0; // Scale 4: base scale * 2
    } else {
        return baseScale * 2.828; // Scale 5: base scale * 2*sqrt(2)
    }
}

// Function to create a hexagonal pattern with controlled irregularity
fn createHexagonalPattern(position: vec2<f32>, time: f32, distortionAmount: f32) -> f32 {
    // Time evolution
    let t = time * 5.0;
    
    // At high distortion, use a completely different noise approach
    if (distortionAmount > 0.6) {
        // Calculate how far into the high distortion range we are (0.0 to 1.0)
        let highDistortionFactor = min(1.0, (distortionAmount - 0.6) / 0.4);
        
        // Create a cellular/Voronoi-like noise pattern
        // This creates a fundamentally different pattern than sine waves
        
        // Generate a set of random cell centers that move with time
        // We'll use 8 cells with different movement patterns
        var cellDistances: array<f32, 8>;
        
        // Cell 1
        let cell1 = vec2<f32>(
            sin(t * 0.31) * 2.5,
            cos(t * 0.27) * 2.5
        );
        cellDistances[0] = distance(position, cell1);
        
        // Cell 2
        let cell2 = vec2<f32>(
            sin(t * 0.41 + 1.7) * 3.2,
            cos(t * 0.37 + 2.3) * 3.2
        );
        cellDistances[1] = distance(position, cell2);
        
        // Cell 3
        let cell3 = vec2<f32>(
            sin(t * 0.23 + 3.1) * 4.1,
            cos(t * 0.29 + 1.2) * 4.1
        );
        cellDistances[2] = distance(position, cell3);
        
        // Cell 4
        let cell4 = vec2<f32>(
            sin(t * 0.17 + 4.3) * 3.7,
            cos(t * 0.19 + 5.1) * 3.7
        );
        cellDistances[3] = distance(position, cell4);
        
        // Cell 5
        let cell5 = vec2<f32>(
            sin(t * 0.13 + 2.5) * 5.3,
            cos(t * 0.11 + 3.7) * 5.3
        );
        cellDistances[4] = distance(position, cell5);
        
        // Cell 6
        let cell6 = vec2<f32>(
            sin(t * 0.07 + 1.3) * 4.7,
            cos(t * 0.05 + 2.9) * 4.7
        );
        cellDistances[5] = distance(position, cell6);
        
        // Cell 7
        let cell7 = vec2<f32>(
            sin(t * 0.03 + 5.7) * 6.1,
            cos(t * 0.02 + 4.3) * 6.1
        );
        cellDistances[6] = distance(position, cell7);
        
        // Cell 8
        let cell8 = vec2<f32>(
            sin(t * 0.05 + 3.3) * 5.9,
            cos(t * 0.03 + 1.7) * 5.9
        );
        cellDistances[7] = distance(position, cell8);
        
        // Sort distances (bubble sort - simple but works for small arrays)
        for (var i = 0; i < 7; i++) {
            for (var j = 0; j < 7 - i; j++) {
                if (cellDistances[j] > cellDistances[j + 1]) {
                    let temp = cellDistances[j];
                    cellDistances[j] = cellDistances[j + 1];
                    cellDistances[j + 1] = temp;
                }
            }
        }
        
        // Create cellular noise based on difference between closest and second closest points
        // This creates cell boundaries with no regular pattern
        let cellNoise = (cellDistances[1] - cellDistances[0]) * 0.5;
        
        // Add turbulence by using the position itself
        let turbulence = sin(position.x * 0.2 + position.y * 0.3 + t * 0.1) * 
                         cos(position.x * 0.3 - position.y * 0.2 + t * 0.15);
        
        // Create a completely different type of noise using domain warping
        // This distorts the coordinate space itself
        let warpedPos = position + vec2<f32>(
            sin(position.y * 0.4 + t * 0.2) * 2.0,
            cos(position.x * 0.3 + t * 0.1) * 2.0
        );
        
        let warpNoise = sin(warpedPos.x * 0.3 + warpedPos.y * 0.4 + t * 0.1) * 
                        cos(warpedPos.x * 0.4 - warpedPos.y * 0.3 + t * 0.15);
        
        // Combine the different noise types with non-linear operations
        // This ensures no regular patterns can form
        let combinedNoise = cellNoise * 0.5 + 
                           turbulence * 0.3 + 
                           warpNoise * 0.2 + 
                           (cellNoise * turbulence) * 0.3;
        
        // Apply final scaling and offset
        let finalNoise = combinedNoise * 0.6;
        
        // If we're fully in high distortion range, return pure noise
        if (highDistortionFactor >= 0.8) {
            return finalNoise;
        }
        
        // Otherwise, we'll blend with the regular pattern below
        // Continue with regular pattern calculation and blend at the end
    }
    
    // Create low-frequency noise fields
    let noiseAmplitude = 0.15 + distortionAmount * 0.5;
    
    let regionNoise1 = sin(position.x * 0.15 + position.y * 0.13 + t * 0.07) * 
                       cos(position.x * 0.11 - position.y * 0.17) * noiseAmplitude;
    let regionNoise2 = cos(position.x * 0.12 - position.y * 0.14 + t * 0.05) * 
                       sin(position.y * 0.19 + position.x * 0.08) * noiseAmplitude;
    
    // Base angles for hexagonal pattern - exactly 60° apart
    let angles = array<f32, 6>(
        0.0,                // 0°
        3.14159 / 3.0,      // 60°
        2.0 * 3.14159 / 3.0, // 120°
        3.14159,            // 180°
        4.0 * 3.14159 / 3.0, // 240°
        5.0 * 3.14159 / 3.0  // 300°
    );
    
    // Frequency variations
    let freqVariationScale = 1.0 + distortionAmount * 2.0;
    let freqVariations = array<f32, 6>(
        1.0 + 0.15 * regionNoise1 * freqVariationScale,
        1.0 - 0.1 * regionNoise2 * freqVariationScale,
        1.0 + 0.12 * regionNoise1 * freqVariationScale,
        1.0 - 0.08 * regionNoise2 * freqVariationScale,
        1.0 + 0.1 * regionNoise1 * freqVariationScale,
        1.0 - 0.12 * regionNoise2 * freqVariationScale
    );
    
    // Amplitude variations
    let ampVariationScale = 1.0 + distortionAmount * 1.5;
    let ampVariations = array<f32, 6>(
        1.0 + 0.2 * regionNoise2 * ampVariationScale,
        0.9 - 0.15 * regionNoise1 * ampVariationScale,
        0.95 + 0.18 * regionNoise2 * ampVariationScale,
        0.92 - 0.12 * regionNoise1 * ampVariationScale,
        0.97 + 0.14 * regionNoise2 * ampVariationScale,
        0.93 - 0.16 * regionNoise1 * ampVariationScale
    );
    
    // Add drift to the pattern
    let driftSpeed = 0.2 + distortionAmount * 0.3;
    let drift_x = sin(t * driftSpeed) * (0.3 + distortionAmount * 0.4);
    let drift_y = cos(t * (driftSpeed + 0.1)) * (0.3 + distortionAmount * 0.4);
    let pos = position + vec2<f32>(drift_x, drift_y);
    
    // Generate waves with varying properties
    var waves = array<f32, 6>();
    var sumAmplitude = 0.0;
    
    for (var i = 0; i < 6; i++) {
        // Create wave vector with angle perturbation
        let anglePerturb = angles[i] + regionNoise1 * (0.2 + distortionAmount * 0.6) * sin(f32(i));
        let k = vec2<f32>(cos(anglePerturb), sin(anglePerturb)) * freqVariations[i];
        
        // Phase with spatial and temporal variation
        let phaseNoise = regionNoise2 * (1.0 + distortionAmount * 3.0) * cos(f32(i));
        let phase = dot(k, pos) * 3.14159 + t * (0.1 + 0.03 * f32(i)) + phaseNoise;
        
        // Add additional phase distortion
        let extraPhaseDistortion = distortionAmount * sin(position.x * 0.5 * f32(i+1) + position.y * 0.3 * f32(i)) * 2.0;
        
        // Store wave with amplitude variation
        let amplitude = ampVariations[i] * (0.8 + 0.2 * sin(position.x * 0.15 * f32(i) + position.y * 0.2 * f32(i+1)));
        waves[i] = amplitude * cos(phase + extraPhaseDistortion);
        sumAmplitude += amplitude;
    }
    
    // Create primary pattern from weighted sum of waves
    var primaryPattern = 0.0;
    for (var i = 0; i < 6; i++) {
        primaryPattern += waves[i];
    }
    primaryPattern /= sumAmplitude; // Normalize
    
    // Create secondary interference pattern
    var interferenceTerm = 1.0;
    for (var i = 0; i < 3; i++) {
        let waveBalance = 0.6 - distortionAmount * 0.3;
        interferenceTerm *= (waveBalance + (1.0 - waveBalance) * waves[i]) * 
                           (waveBalance + (1.0 - waveBalance) * waves[i+3]);
    }
    
    // Mix patterns with position-dependent weights
    let mixFactor = 0.3 + 0.2 * sin(position.x * 0.1 + position.y * 0.15);
    let distortedMixFactor = mix(mixFactor, 0.8, distortionAmount);
    let pattern = distortedMixFactor * primaryPattern + (1.0 - distortedMixFactor) * interferenceTerm;
    
    // Apply non-linear transformation
    let powerFactor = 0.9 + 0.2 * regionNoise1 * (1.0 + distortionAmount);
    let nonLinearPattern = sign(pattern) * pow(abs(pattern), powerFactor);
    
    // Apply soft threshold
    let threshold = max(0.01, 0.08 - distortionAmount * 0.05);
    let thresholdedPattern = max(0.0, nonLinearPattern - threshold) * (1.0 / (1.0 - threshold));
    
    // For high distortion (0.6-1.0), blend with cellular noise
    if (distortionAmount > 0.6) {
        let highDistortionFactor = min(1.0, (distortionAmount - 0.6) / 0.4);
        
        // Create a cellular/Voronoi-like noise pattern
        var cellDistances: array<f32, 8>;
        
        // Cell 1
        let cell1 = vec2<f32>(
            sin(t * 0.31) * 2.5,
            cos(t * 0.27) * 2.5
        );
        cellDistances[0] = distance(position, cell1);
        
        // Cell 2
        let cell2 = vec2<f32>(
            sin(t * 0.41 + 1.7) * 3.2,
            cos(t * 0.37 + 2.3) * 3.2
        );
        cellDistances[1] = distance(position, cell2);
        
        // Cell 3
        let cell3 = vec2<f32>(
            sin(t * 0.23 + 3.1) * 4.1,
            cos(t * 0.29 + 1.2) * 4.1
        );
        cellDistances[2] = distance(position, cell3);
        
        // Cell 4
        let cell4 = vec2<f32>(
            sin(t * 0.17 + 4.3) * 3.7,
            cos(t * 0.19 + 5.1) * 3.7
        );
        cellDistances[3] = distance(position, cell4);
        
        // Cell 5
        let cell5 = vec2<f32>(
            sin(t * 0.13 + 2.5) * 5.3,
            cos(t * 0.11 + 3.7) * 5.3
        );
        cellDistances[4] = distance(position, cell5);
        
        // Cell 6
        let cell6 = vec2<f32>(
            sin(t * 0.07 + 1.3) * 4.7,
            cos(t * 0.05 + 2.9) * 4.7
        );
        cellDistances[5] = distance(position, cell6);
        
        // Cell 7
        let cell7 = vec2<f32>(
            sin(t * 0.03 + 5.7) * 6.1,
            cos(t * 0.02 + 4.3) * 6.1
        );
        cellDistances[6] = distance(position, cell7);
        
        // Cell 8
        let cell8 = vec2<f32>(
            sin(t * 0.05 + 3.3) * 5.9,
            cos(t * 0.03 + 1.7) * 5.9
        );
        cellDistances[7] = distance(position, cell8);
        
        // Sort distances (bubble sort - simple but works for small arrays)
        for (var i = 0; i < 7; i++) {
            for (var j = 0; j < 7 - i; j++) {
                if (cellDistances[j] > cellDistances[j + 1]) {
                    let temp = cellDistances[j];
                    cellDistances[j] = cellDistances[j + 1];
                    cellDistances[j + 1] = temp;
                }
            }
        }
        
        // Create cellular noise based on difference between closest and second closest points
        let cellNoise = (cellDistances[1] - cellDistances[0]) * 0.5;
        
        // Add turbulence by using the position itself
        let turbulence = sin(position.x * 0.2 + position.y * 0.3 + t * 0.1) * 
                         cos(position.x * 0.3 - position.y * 0.2 + t * 0.15);
        
        // Create a completely different type of noise using domain warping
        let warpedPos = position + vec2<f32>(
            sin(position.y * 0.4 + t * 0.2) * 2.0,
            cos(position.x * 0.3 + t * 0.1) * 2.0
        );
        
        let warpNoise = sin(warpedPos.x * 0.3 + warpedPos.y * 0.4 + t * 0.1) * 
                        cos(warpedPos.x * 0.4 - warpedPos.y * 0.3 + t * 0.15);
        
        // Combine the different noise types with non-linear operations
        let combinedNoise = cellNoise * 0.5 + 
                           turbulence * 0.3 + 
                           warpNoise * 0.2 + 
                           (cellNoise * turbulence) * 0.3;
        
        // Apply final scaling
        let finalNoise = combinedNoise * 0.6;
        
        // Blend between pattern and cellular noise based on how far into high distortion we are
        return mix(thresholdedPattern, finalNoise, highDistortionFactor);
    }
    
    return thresholdedPattern;
}

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;
    
    // Store original position
    output.worldPos = position;
    
    // Get time
    let time = timeUniform.time;
    
    // Get scale factor from uniform based on scale index
    let scaleFactor = getScaleFactor(kpParams.scaleIndex);
    
    // Scale the position directly (no distortion applied to position)
    let scaledPos = vec2<f32>(position.x, position.y) * scaleFactor;
    
    // Calculate height using hexagonal pattern with distortion parameter
    let rawHeight = createHexagonalPattern(scaledPos, time, kpParams.distortion);
    
    // Add height offset based on distortion
    let heightOffset = kpParams.distortion * 0.1;
    
    // Apply height offset to raw height
    let height = rawHeight * 0.2 + heightOffset;
    
    // For high distortion, add domain warping micro-noise
    var finalHeight = height;
    if (kpParams.distortion > 0.5) {
        let microNoiseStrength = (kpParams.distortion - 0.5) * 2.0; // 0.0 to 1.0
        
        // Create warped coordinates for truly non-lattice noise
        let warpedX = position.x + sin(position.y * 13.7 + time * 1.3) * 0.2;
        let warpedY = position.y + cos(position.x * 11.9 + time * 1.7) * 0.2;
        
        // Use warped coordinates for noise
        let microNoise = sin(warpedX * 17.3 + warpedY * 19.1 + time * 1.1) * 
                         cos(warpedX * 23.5 - warpedY * 13.7 + time * 0.9);
                         
        // Scale and apply micro-noise
        finalHeight += microNoise * 0.04 * microNoiseStrength;
    }
    
    // Store the actual height for fragment shader
    output.height = finalHeight;
    
    // Create modified position - use max(0, height) for z to create flat areas
    var modifiedPosition = position;
    modifiedPosition.z = max(0.0, finalHeight);
    
    // Transform position with view and projection matrices
    output.position = projection * view * vec4<f32>(modifiedPosition, 1.0);
    
    // Calculate normal
    if (finalHeight <= 0.0) {
        // Flat area - normal points straight up
        output.normal = vec3<f32>(0.0, 0.0, 1.0);
    } else {
        // For non-flat areas, calculate normal from neighboring points
        let epsilon = 0.01;
        
        // Calculate heights at neighboring points
        let pos1 = vec2<f32>(position.x + epsilon/scaleFactor, position.y) * scaleFactor;
        let pos2 = vec2<f32>(position.x, position.y + epsilon/scaleFactor) * scaleFactor;
        
        let rawHeight1 = createHexagonalPattern(pos1, time, kpParams.distortion);
        let rawHeight2 = createHexagonalPattern(pos2, time, kpParams.distortion);
        
        var height1 = rawHeight1 * 0.2 + heightOffset;
        var height2 = rawHeight2 * 0.2 + heightOffset;
        
        // Apply the same micro-noise to neighboring points
        if (kpParams.distortion > 0.5) {
            let microNoiseStrength = (kpParams.distortion - 0.5) * 2.0;
            
            // Create warped coordinates for neighboring points
            let warpedX1 = (position.x + epsilon/scaleFactor) + 
                          sin((position.y) * 13.7 + time * 1.3) * 0.2;
            let warpedY1 = position.y + 
                          cos((position.x + epsilon/scaleFactor) * 11.9 + time * 1.7) * 0.2;
                          
            let warpedX2 = position.x + 
                          sin((position.y + epsilon/scaleFactor) * 13.7 + time * 1.3) * 0.2;
            let warpedY2 = (position.y + epsilon/scaleFactor) + 
                          cos(position.x * 11.9 + time * 1.7) * 0.2;
            
            // Use warped coordinates for noise
            let microNoise1 = sin(warpedX1 * 17.3 + warpedY1 * 19.1 + time * 1.1) * 
                             cos(warpedX1 * 23.5 - warpedY1 * 13.7 + time * 0.9);
                             
            let microNoise2 = sin(warpedX2 * 17.3 + warpedY2 * 19.1 + time * 1.1) * 
                             cos(warpedX2 * 23.5 - warpedY2 * 13.7 + time * 0.9);
                             
            height1 += microNoise1 * 0.04 * microNoiseStrength;
            height2 += microNoise2 * 0.04 * microNoiseStrength;
        }
        
        // Ensure flat areas in neighboring points too
        height1 = max(0.0, height1);
        height2 = max(0.0, height2);
        
        let tangent1 = vec3<f32>(epsilon, 0.0, height1 - modifiedPosition.z);
        let tangent2 = vec3<f32>(0.0, epsilon, height2 - modifiedPosition.z);
        
        // At high distortion, blend with upward normal for a flatter appearance
        let normalFromCross = normalize(cross(tangent1, tangent2));
        let upNormal = vec3<f32>(0.0, 0.0, 1.0);
        
        // Stronger normal blending at high distortion
        let normalBlendFactor = min(1.0, kpParams.distortion * 2.0);
        output.normal = normalize(mix(normalFromCross, upNormal, normalBlendFactor));
    }
    
    // Set color based on height value and distortion parameter
    output.color = gridCellColormap(finalHeight, kpParams.distortion);
    
    return output;
}

@fragment
fn fragmentMain(
    @location(0) color: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>,
    @location(3) height: f32
) -> @location(0) vec4<f32> {
    // Enhanced lighting
    let light_dir = normalize(vec3<f32>(0.5, 0.5, 1.0));
    let diffuse = max(dot(normal, light_dir), 0.0);
    let ambient = 0.2;
    
    let view_dir = normalize(vec3<f32>(0.0, 0.0, 1.0));
    let half_dir = normalize(light_dir + view_dir);
    let specular = pow(max(dot(normal, half_dir), 0.0), 32.0) * 0.6;
    
    let lighting = ambient + diffuse * 0.8 + specular;
    
    // Add subtle pattern to flat areas
    var finalColor = color;
    if (height <= 0.0) {
        // Subtle pattern for flat areas
        let pattern = sin(worldPos.x * 20.0) * sin(worldPos.y * 20.0) * 0.03;
        finalColor = vec3<f32>(0.0, 0.0, 0.4 + pattern);
    }
    
    return vec4<f32>(finalColor * lighting, 1.0);
} 