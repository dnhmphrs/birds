// shaders/theta2D.wgsl
@group(0) @binding(0) var<uniform> viewportSize: vec2<f32>;
@group(0) @binding(1) var<uniform> mousePosition: vec2<f32>;

// Constants
const pi = 3.14159265358979323846;

// Jacobi Theta function implementation
// fn jacobiTheta(z: f32, tau: f32) -> vec2<f32> {
//     var sum = vec2<f32>(0.0, 0.0); // (real part, imaginary part)
//     let N = 25; // Number of terms in the series for approximation

//     for (var n = -N; n <= N; n = n + 1) {
//         let nSquaredTau = f32(n * n) * tau;
//         let nZ = f32(n) * z;

//         // Compute the angle for e^{2 * pi * i * (n^2 * tau + n * z)}
//         let angle = 2.0 * pi * (nSquaredTau  + nZ ) ;

//         // Real and imaginary parts of e^{i * angle}
//         sum.x = sum.x + cos(angle);
//         sum.y = sum.y + sin(angle);
//     }

//     return sum; // Return the complex result as (real, imaginary)
// }

fn jacobiTheta(z: vec2<f32>, tau: vec2<f32>) -> vec2<f32> {
    var sum = vec2<f32>(0.0, 0.0); // Initialize (real part, imaginary part) of the sum
    let N = 20; // Number of terms for approximation

    for (var n = -N; n <= N; n = n + 1) {
        // Compute the real and imaginary parts of n^2 * tau and 2 * n * z
        let n2TauReal = f32(n * n) * tau.x;
        let n2TauImag = f32(n * n) * tau.y;
        let nZReal = 2.0 * f32(n) * z.x;
        let nZImag = 2.0 * f32(n) * z.y;

        // Calculate the exponent angle = π * (n^2 * tau + 2 * n * z)
        let angleReal = pi * (n2TauReal + nZReal);
        let angleImag = pi * (n2TauImag + nZImag);

        // Compute e^{i * (angleReal + i * angleImag)} = e^{i * angleReal} * e^{-angleImag}
        let expFactor = exp(-angleImag);
        let realPart = expFactor * cos(angleReal);
        let imagPart = expFactor * sin(angleReal);

        // Accumulate real and imaginary parts in the sum
        sum.x += realPart;
        sum.y += imagPart;
    }

    return sum; // Return the complex result as (real, imaginary)
}


@vertex
fn vertex_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    // Full screen triangle setup
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),  // Bottom-left corner
        vec2<f32>(3.0, -1.0),   // Bottom-right (extends past to cover right)
        vec2<f32>(-1.0, 3.0)    // Top-left (extends past to cover top)
    );
    return vec4<f32>(positions[vertexIndex], 0.0, 1.0);
}

@fragment
fn fragment_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    // Aspect ratio calculation
    let aspectRatio = viewportSize.x / viewportSize.y;

    // Normalize coordinates to [-1.0, 1.0] with center at (0,0), adjusted for aspect ratio
    let screenCoord = ((fragCoord.xy / viewportSize) * 2.0 - vec2<f32>(1.0)) * vec2<f32>(aspectRatio, 1.0);

    // Define z and tau as vec2<f32> values based on screen coordinates and other parameters
    let z = vec2<f32>(screenCoord.x * 5.0, screenCoord.y * 5.0);
    let tau = vec2<f32>(mousePosition.x * 10.0, mousePosition.y);

    // Use z and tau as inputs to the Jacobi Theta function
    let jacobi = jacobiTheta(z, tau);

    // // Calculate the phase (angle) of the complex result
    // let phase = atan2(jacobi.y, jacobi.x);

    // // Declare color as mutable variable and assign based on condition
    // var color: vec3<f32>;
    // if (phase >= 0.0 && phase <= pi / 6.0) {
    //     color = vec3<f32>(
    //         (phase / (pi / 3.0)) * 0.6,  // Scale phase to range for red channel
    //         (phase / (pi / 3.0)) * 0.8,  // Scale for green channel
    //         (phase / (pi / 3.0)) * 1.0   // Scale for blue channel
    //     );
    // } else {
    //     color = vec3<f32>(0.0, 0.0, 0.0); // Black when outside the range
    // }

    // Map the real and imaginary parts of Jacobi Theta to RGB color channels
    let color = vec3<f32>(
        jacobi.x * 0.5 + 0.5, // Map real part to [0,1] range for red channel
        jacobi.y * 0.5 + 0.5, // Map imaginary part to [0,1] range for green channel
        1.0 - (jacobi.x * 0.5 + jacobi.y * 0.5) // Invert for blue channel for contrast
    );

    return vec4<f32>(color, 1.0);
}
