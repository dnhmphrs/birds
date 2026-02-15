// ZetaShader.wgsl - Riemann Zeta Function Surface with Prime Frequencies
// Creates a surface with prime waves where wave p has frequency log(p) and amplitude 1/p

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1)
var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2)
var<uniform> uniforms: vec4<f32>;
// [unused, unused, manualPhase, time]
@group(0) @binding(3)
var<uniform> zetaParams: vec4<f32>;
// [numPrimes, scale, scalingMode, phaseMode]
// scalingMode: 0=log, 1=quadratic/theta
// phaseMode: 0=auto, 1=manual
@group(0) @binding(4)
var<uniform> geometryParams: vec4<f32>;
// [geometryMode, waveMode, unused, unused]
// geometryMode: 0=euclidean, 1=poincare disc
// waveMode: 0=radial, 1=hexagonal

// Pre-computed list of first 50 primes
const PRIMES = array<i32, 50>(2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229);

@vertex
fn vertexMain(@location(0) position: vec3<f32>) -> VertexOutput {
    var output: VertexOutput;

    let time = uniforms.w;
    let manualPhase = uniforms.z;
    let numPrimes = i32(zetaParams.x);
    let scale = zetaParams.y;
    let scalingMode = zetaParams.z;
    let phaseMode = zetaParams.w;
    let geometryMode = geometryParams.x;
    let waveMode = geometryParams.y;
    
    // Transform position based on geometry mode
    var transformedPos: vec2<f32>;
    var isInsideDisc: bool = true;

    if (geometryMode == 1.0) {
        // Poincaré disc transformation
        let scaleToDisc = 5.0;
        let euclideanPos = position.xy / scaleToDisc;
        let r = length(euclideanPos);
        
        // Check if we're inside the unit disc
        if (r >= 1.0) {
            isInsideDisc = false;
            transformedPos = euclideanPos * scaleToDisc; // Will be discarded anyway
        } else {
            // Use the original Euclidean coordinates scaled to the disc
            // In Poincaré disc model, we work directly with the disc coordinates
            transformedPos = euclideanPos;
        }
    } else {
        // Euclidean geometry (default)
        transformedPos = position.xy;
    }

    // Calculate zeta surface height using prime frequencies
    var height: f32 = 0.0;
    // Determine phase
    let phase = select(-time, manualPhase, phaseMode == 1.0);

    // Only calculate waves if inside disc (for Poincaré mode)
    if (geometryMode == 0.0 || isInsideDisc) {
        // Sum waves for first numPrimes primes
        for (var i: i32 = 0; i < min(numPrimes, 50); i++) {
            let p = PRIMES[i];
            let pf = f32(p);
            
            let amplitude = 1.0 / pf;
            var wave: f32;
            
            if (waveMode == 1.0) {
                // Hexagonal 2D modes
                let baseFreq = select(log(pf), pf, scalingMode == 1.0) * scale * 0.1;
                
                // Get coordinates for wave calculation
                var x: f32;
                var y: f32;
                
                if (geometryMode == 1.0) {
                    // In Poincaré mode, use the disc coordinates directly
                    x = transformedPos.x;
                    y = transformedPos.y;
                } else {
                    // In Euclidean mode, use scaled coordinates
                    x = transformedPos.x * 0.5;
                    y = transformedPos.y * 0.5;
                }
                
                // Create hexagonal 2D modes using three directions: 0°, 60°, 120°
                let wave1 = sin(baseFreq * x + phase) * sin(baseFreq * y + phase);
                
                let x60 = x * 0.5 - y * 0.866;
                let y60 = x * 0.866 + y * 0.5;
                let wave2 = sin(baseFreq * x60 + phase) * sin(baseFreq * y60 + phase);
                
                let x120 = x * (-0.5) - y * 0.866;
                let y120 = x * 0.866 + y * (-0.5);
                let wave3 = sin(baseFreq * x120 + phase) * sin(baseFreq * y120 + phase);
                
                wave = (wave1 + wave2 + wave3) / 3.0;
            } else {
                // Radial modes (default)
                let frequency = select(log(pf) * scale, pf * scale, scalingMode == 1.0);
                
                var dist: f32;
                if (geometryMode == 1.0) {
                    // Hyperbolic distance in Poincaré disc
                    let r = length(transformedPos);
                    dist = log((1.0 + r) / (1.0 - r));
                } else {
                    // Euclidean distance
                    dist = length(transformedPos);
                }
                
                wave = sin(dist * frequency + phase * 2.0);
            }
            
            height += amplitude * wave;
        }
    }

    // Apply the height to the z-coordinate
    let worldPosition = vec3<f32>(position.x, position.y, height);
    output.worldPosition = worldPosition;

    // Calculate normal by finite differences for lighting
    let epsilon = 0.01;

    // Update normal calculation to handle Poincaré mode
    var heightX: f32 = 0.0;
    var heightY: f32 = 0.0;

    if (geometryMode == 0.0 || isInsideDisc) {
        for (var i: i32 = 0; i < min(numPrimes, 50); i++) {
            let p = PRIMES[i];
            let pf = f32(p);
            let amplitude = 1.0 / pf;
            
            var waveX: f32;
            var waveY: f32;
            
            if (waveMode == 1.0) {
                // Hexagonal 2D modes for normal calculation
                let baseFreq = select(log(pf), pf, scalingMode == 1.0) * scale * 0.1;
                
                var xPlus: f32;
                var yPlus: f32;
                var x: f32;
                var y: f32;
                
                if (geometryMode == 1.0) {
                    x = transformedPos.x;
                    y = transformedPos.y;
                    xPlus = transformedPos.x + epsilon;
                    yPlus = transformedPos.y + epsilon;
                } else {
                    x = transformedPos.x * 0.5;
                    y = transformedPos.y * 0.5;
                    xPlus = (transformedPos.x + epsilon) * 0.5;
                    yPlus = (transformedPos.y + epsilon) * 0.5;
                }
                
                // Calculate hexagonal waves for X offset
                let wave1X = sin(baseFreq * xPlus + phase) * sin(baseFreq * y + phase);
                let x60X = xPlus * 0.5 - y * 0.866;
                let y60X = xPlus * 0.866 + y * 0.5;
                let wave2X = sin(baseFreq * x60X + phase) * sin(baseFreq * y60X + phase);
                let x120X = xPlus * (-0.5) - y * 0.866;
                let y120X = xPlus * 0.866 + y * (-0.5);
                let wave3X = sin(baseFreq * x120X + phase) * sin(baseFreq * y120X + phase);
                waveX = (wave1X + wave2X + wave3X) / 3.0;
                
                // Calculate hexagonal waves for Y offset
                let wave1Y = sin(baseFreq * x + phase) * sin(baseFreq * yPlus + phase);
                let x60Y = x * 0.5 - yPlus * 0.866;
                let y60Y = x * 0.866 + yPlus * 0.5;
                let wave2Y = sin(baseFreq * x60Y + phase) * sin(baseFreq * y60Y + phase);
                let x120Y = x * (-0.5) - yPlus * 0.866;
                let y120Y = x * 0.866 + yPlus * (-0.5);
                let wave3Y = sin(baseFreq * x120Y + phase) * sin(baseFreq * y120Y + phase);
                waveY = (wave1Y + wave2Y + wave3Y) / 3.0;
            } else {
                // Radial modes for normal calculation
                let frequency = select(log(pf) * scale, pf * scale, scalingMode == 1.0);
                
                var distX: f32;
                var distY: f32;
                
                if (geometryMode == 1.0) {
                    let posX = vec2<f32>(transformedPos.x + epsilon, transformedPos.y);
                    let posY = vec2<f32>(transformedPos.x, transformedPos.y + epsilon);
                    let rX = length(posX);
                    let rY = length(posY);
                    distX = log((1.0 + rX) / (1.0 - rX));
                    distY = log((1.0 + rY) / (1.0 - rY));
                } else {
                    distX = length(vec2<f32>(transformedPos.x + epsilon, transformedPos.y));
                    distY = length(vec2<f32>(transformedPos.x, transformedPos.y + epsilon));
                }
                
                waveX = sin(distX * frequency + phase * 2.0);
                waveY = sin(distY * frequency + phase * 2.0);
            }
            
            heightX += amplitude * waveX;
            heightY += amplitude * waveY;
        }
    }

    let dx = vec3<f32>(epsilon, 0.0, heightX - height);
    let dy = vec3<f32>(0.0, epsilon, heightY - height);

    output.normal = normalize(cross(dx, dy));

    output.position = projectionMatrix * viewMatrix * vec4<f32>(worldPosition, 1.0);

    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // Check if we're in Poincaré mode and outside the disc
    let geometryMode = geometryParams.x;
    if (geometryMode == 1.0) {
        let discPos = input.worldPosition.xy / 5.0; // Same scale as in vertex shader
        if (length(discPos) >= 1.0) {
            discard; // Don't render outside the unit disc
        }
    }
    
    // Light direction
    let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));

    // Basic diffuse lighting
    let diffuse = max(dot(input.normal, lightDir), 0.0);

    // Color based on height using PARULA-like colormap
    let height = input.worldPosition.z;
    let numPrimes = zetaParams.x;

    // PARULA-like color transitions: deep blue (valleys) to yellow (peaks)
    var color: vec3<f32>;

    // Calculate the theoretical maximum height based on sum of prime amplitudes
    // Different calculation for radial vs hexagonal modes
    var maxHeight: f32 = 0.0;
    let waveMode = geometryParams.y;
    
    for (var i: i32 = 0; i < min(i32(numPrimes), 50); i++) {
        let p = PRIMES[i];
        let amplitude = 1.0 / f32(p);
        
        if (waveMode == 1.0) {
            // Hexagonal mode: waves are averaged, so max amplitude per wave is amplitude * 1.0
            // But the averaging of 3 sine waves can theoretically reach the full amplitude
            maxHeight += amplitude;
        } else {
            // Radial mode: direct sine wave with full amplitude
            maxHeight += amplitude;
        }
    }
    
    // Apply mode-specific scaling factor
    if (waveMode == 1.0) {
        // Hexagonal mode produces smaller effective range due to averaging
        maxHeight *= 0.7;  // Empirical adjustment for hexagonal averaging
    }
    
    // Normalize height to [0, 1] range using actual theoretical bounds
    let normalizedHeight = clamp((height + maxHeight) / (2.0 * maxHeight), 0.0, 1.0);
    
    // PARULA colormap interpolation
    if (normalizedHeight < 0.25) {
        // Deep blue to cyan transition
        let t = normalizedHeight * 4.0;
        let deepBlue = vec3<f32>(0.05, 0.05, 0.6);  // Much deeper, more saturated blue
        let cyan = vec3<f32>(0.0, 0.7, 0.9);
        color = mix(deepBlue, cyan, t);
    }
    else if (normalizedHeight < 0.5) {
        // Cyan to green transition
        let t = (normalizedHeight - 0.25) * 4.0;
        let cyan = vec3<f32>(0.0, 0.7, 0.9);
        let green = vec3<f32>(0.0, 0.8, 0.4);
        color = mix(cyan, green, t);
    }
    else if (normalizedHeight < 0.75) {
        // Green to yellow transition
        let t = (normalizedHeight - 0.5) * 4.0;
        let green = vec3<f32>(0.0, 0.8, 0.4);
        let yellow = vec3<f32>(0.9, 0.9, 0.1);
        color = mix(green, yellow, t);
    }
    else {
        // Yellow to bright yellow transition
        let t = (normalizedHeight - 0.75) * 4.0;
        let yellow = vec3<f32>(0.9, 0.9, 0.1);
        let brightYellow = vec3<f32>(1.0, 1.0, 0.0);
        color = mix(yellow, brightYellow, t);
    }

    // Subtle prime count influence (reduced to preserve PARULA colors)
    let primeInfluence = numPrimes / 50.0;
    color = mix(color, color * 0.9, primeInfluence * 0.1);

    // Apply lighting
    color = color * (0.3 + 0.7 * diffuse);

    return vec4<f32>(color, 1.0);
}