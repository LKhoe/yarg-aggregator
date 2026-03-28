"use client";

export function GradientMesh() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden gradient-mesh-container">
      <div className="gradient-mesh-blob gradient-mesh-blob-1" />
      <div className="gradient-mesh-blob gradient-mesh-blob-2" />
      <div className="gradient-mesh-blob gradient-mesh-blob-3" />
      <div className="gradient-mesh-blob gradient-mesh-blob-4" />
    </div>
  );
}
