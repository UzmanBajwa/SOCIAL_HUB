export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] animate-aurora rounded-full bg-violet-600/25 blur-[120px] dark:bg-violet-500/25" />
      <div
        className="absolute -right-40 top-1/3 h-[28rem] w-[28rem] animate-aurora rounded-full bg-cyan-500/20 blur-[120px] dark:bg-cyan-400/20"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] animate-aurora rounded-full bg-fuchsia-500/15 blur-[130px] dark:bg-fuchsia-500/20"
        style={{ animationDelay: "-11s" }}
      />
    </div>
  );
}
