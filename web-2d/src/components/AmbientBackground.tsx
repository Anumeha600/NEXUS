// Purely decorative, low-contrast depth behind the app shell: a few large
// blurred color glows plus a couple of tiny floating shapes and a faint dot
// grid. Fixed to the viewport so it never scrolls with content and never
// competes with the game or the UI on top of it.
export default function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="dot-grid absolute inset-0 opacity-[0.35]" />

      <div className="absolute -top-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-purple/20 blur-[110px]" />
      <div className="absolute -top-24 right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-blue/15 blur-[110px]" />
      <div className="absolute bottom-[-14rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-pink-300/20 blur-[110px]" />

      <div className="absolute top-24 right-[18%] h-3 w-3 rounded-full bg-cyan/40 blur-[1px]" />
      <div className="absolute top-1/2 left-[8%] h-2 w-2 rounded-full bg-gold/50 blur-[1px]" />
      <div className="absolute bottom-32 right-[30%] h-4 w-4 rounded-2xl bg-purple/25 blur-[1px]" />
    </div>
  );
}
