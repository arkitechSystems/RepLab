// Centered red→white→red gradient spinner used as an overlay on top of
// skeleton-shimmer loading states. Render alongside the skeleton, e.g.:
//   {loading && (
//     <>
//       <SkeletonRows />
//       <LoadingSpinnerOverlay />
//     </>
//   )}
// Position is fixed so it stays centered regardless of how the parent is
// laid out. pointer-events-none so it never blocks interaction underneath.
export default function LoadingSpinnerOverlay({ size = 64 }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
      aria-hidden="true"
    >
      <span
        className="replab-spinner-gradient"
        style={{ width: size, height: size, animationDuration: '0.91s' }}
      />
    </div>
  );
}
