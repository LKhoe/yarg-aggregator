export default function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl will-change-transform animate-[orb-float-1_20s_ease-in-out_infinite]" />
      <div className="absolute top-1/2 -left-40 w-96 h-96 bg-accent/15 rounded-full blur-3xl will-change-transform animate-[orb-float-2_25s_ease-in-out_infinite]" />
      <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-primary/10 rounded-full blur-3xl will-change-transform animate-[orb-float-3_18s_ease-in-out_infinite]" />
    </div>
  );
}
