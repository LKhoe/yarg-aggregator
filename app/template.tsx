export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-[fade-in_0.25s_ease-out]">{children}</div>
  );
}
