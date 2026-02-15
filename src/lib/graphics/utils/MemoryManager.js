/**
 * MemoryManager.js
 * Utility for managing memory and WebGPU resources across all experiences
 */

// Track all created WebGPU resources for debugging
const resourceRegistry = {
    buffers: new Set(),
    textures: new Set(),
    bindGroups: new Set(),
    pipelines: new Set(),
    shaderModules: new Set(),
    renderPipelines: new Set(),
    computePipelines: new Set(),
    samplers: new Set(),
    experiences: new Set(),
    others: new Set()
};

// Statistics for memory usage
let stats = {
    createdResources: 0,
    destroyedResources: 0,
    activeResources: 0,
    lastCleanupTime: Date.now(),
    peakResourceCount: 0,
    cleanupCount: 0
};

// Debug mode for extra logging
let debugMode = false;

/**
 * Enable or disable debug mode
 * @param {boolean} enabled - Whether debug mode should be enabled
 */
export function setDebugMode(enabled) {
    debugMode = enabled;
}

/**
 * Register a WebGPU resource for tracking
 * @param {Object} resource - The WebGPU resource to track
 * @param {string} type - The type of resource (buffer, texture, etc.)
 * @param {string} label - Optional label for the resource
 */
export function registerResource(resource, type = 'others', label = '') {
    if (!resource) return;
    
    // Add to appropriate registry
    if (resourceRegistry[type]) {
        resourceRegistry[type].add(resource);
    } else {
        resourceRegistry.others.add(resource);
    }
    
    // Add label if provided and not already set
    if (label && !resource.label) {
        resource.label = label;
    }
    
    stats.createdResources++;
    stats.activeResources++;
    
    // Update peak resource count
    if (stats.activeResources > stats.peakResourceCount) {
        stats.peakResourceCount = stats.activeResources;
    }
}

/**
 * Unregister a WebGPU resource from tracking
 * @param {Object} resource - The WebGPU resource to untrack
 * @param {string} type - The type of resource (buffer, texture, etc.)
 */
export function unregisterResource(resource, type = 'others') {
    if (!resource) return;
    
    // Remove from appropriate registry
    let removed = false;
    
    if (resourceRegistry[type] && resourceRegistry[type].has(resource)) {
        resourceRegistry[type].delete(resource);
        removed = true;
    } else {
        // Try to find in other registries if not found in the specified type
        for (const [registryType, registry] of Object.entries(resourceRegistry)) {
            if (registry.has(resource)) {
                registry.delete(resource);
                type = registryType; // Update type for logging
                removed = true;
                break;
            }
        }
    }
    
    if (removed) {
        stats.destroyedResources++;
        stats.activeResources--;
    }
}

/**
 * Clean up a WebGPU resource properly
 * @param {Object} resource - The WebGPU resource to clean up
 * @param {string} type - The type of resource (buffer, texture, etc.)
 */
export function cleanupResource(resource, type = 'others') {
    if (!resource) return null;
    
    try {
        // Call destroy method if available
        if (typeof resource.destroy === 'function') {
            resource.destroy();
        }
        
        // Unregister the resource
        unregisterResource(resource, type);
        
        // Return null to help with garbage collection
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Clean up all resources of a specific type
 * @param {string} type - The type of resources to clean up
 */
export function cleanupResourcesByType(type) {
    if (!resourceRegistry[type]) {
        return;
    }
    
    // Create a copy of the set to avoid modification during iteration
    const resourcesToCleanup = [...resourceRegistry[type]];
    
    // Clean up each resource
    for (const resource of resourcesToCleanup) {
        cleanupResource(resource, type);
    }
    
    // Clear the set
    resourceRegistry[type].clear();
}

/**
 * Clean up all tracked resources
 */
export function cleanupAllResources() {
    // Clean up each type of resource
    for (const type in resourceRegistry) {
        cleanupResourcesByType(type);
    }
    
    // Update stats
    stats.cleanupCount++;
    stats.lastCleanupTime = Date.now();
}

/**
 * Get memory usage statistics
 * @returns {Object} Memory usage statistics
 */
export function getMemoryStats() {
    // Add browser memory info if available
    let browserMemory = {};
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        browserMemory = {
            totalJSHeapSize: formatBytes(memory.totalJSHeapSize),
            usedJSHeapSize: formatBytes(memory.usedJSHeapSize),
            jsHeapSizeLimit: formatBytes(memory.jsHeapSizeLimit),
            raw: {
                totalJSHeapSize: memory.totalJSHeapSize,
                usedJSHeapSize: memory.usedJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit
            }
        };
    }
    
    return {
        ...stats,
        resourceCounts: {
            buffers: resourceRegistry.buffers.size,
            textures: resourceRegistry.textures.size,
            bindGroups: resourceRegistry.bindGroups.size,
            pipelines: resourceRegistry.pipelines.size,
            renderPipelines: resourceRegistry.renderPipelines.size,
            computePipelines: resourceRegistry.computePipelines.size,
            shaderModules: resourceRegistry.shaderModules.size,
            samplers: resourceRegistry.samplers.size,
            experiences: resourceRegistry.experiences.size,
            others: resourceRegistry.others.size,
            total: stats.activeResources
        },
        peakResourceCount: stats.peakResourceCount,
        browserMemory,
        uptime: Date.now() - stats.lastCleanupTime
    };
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - The number of bytes
 * @returns {string} Human-readable string
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    if (!bytes || isNaN(bytes)) return 'Unknown';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Force garbage collection if available
 */
export function forceGarbageCollection() {
    stats.lastCleanupTime = Date.now();
    stats.cleanupCount++;
    
    // First try to clean up remaining untracked resources
    for (const type in resourceRegistry) {
        cleanupResourcesByType(type);
    }
    
    // Force garbage collection if available
    if (typeof window !== 'undefined') {
        if (window.gc) {
            window.gc();
        }
    }
}

/**
 * Get a list of all resources by type
 * @param {string} type - The type of resources to get
 * @returns {Array} Array of resources
 */
export function getResourcesByType(type) {
    if (!resourceRegistry[type]) {
        return [];
    }
    
    return [...resourceRegistry[type]];
}

/**
 * Reset all statistics
 */
export function resetStats() {
    stats = {
        createdResources: 0,
        destroyedResources: 0,
        activeResources: 0,
        lastCleanupTime: Date.now(),
        peakResourceCount: 0,
        cleanupCount: 0
    };
}

export default {
    registerResource,
    unregisterResource,
    cleanupResource,
    cleanupResourcesByType,
    cleanupAllResources,
    getMemoryStats,
    formatBytes,
    forceGarbageCollection,
    getResourcesByType,
    resetStats,
    setDebugMode
}; 