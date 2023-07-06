// we use constants instead of static class fields to break cyclic dependencies.
// Keep this file free from @babylon (in)direct imports, to allow Svelte component referencing them
// Otherwise this would bloat production chunks with Babylonjs (1.6Mb uncompressed)
export const AnchorBehaviorName = 'anchorable'
export const AnimateBehaviorName = 'animatable'
export const DetailBehaviorName = 'detailable'
export const DrawBehaviorName = 'drawable'
export const FlipBehaviorName = 'flippable'
export const LockBehaviorName = 'lockable'
export const MoveBehaviorName = 'movable'
export const QuantityBehaviorName = 'quantifiable'
export const RandomBehaviorName = 'randomizable'
export const RotateBehaviorName = 'rotable'
export const StackBehaviorName = 'stackable'
export const TargetBehaviorName = 'targetable'
