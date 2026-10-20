# Performance Optimization Skill Reference

## Core Methodology
1. **Define target & budget**: 60 FPS = 16.67 ms/frame budget.
2. **Profile / Measure first, never guess**: Trace allocations, draw calls, particle counts, and CPU spikes.
3. **Object Pooling & Emitter Reuse**: Pre-warm emitters and pool entities. Do not allocate or destroy objects inside hot loops.
4. **Lifecycle & Cleanup**: Clear emitters, event listeners, intervals, and tweens on scene shutdown to prevent leaks across restarts.
