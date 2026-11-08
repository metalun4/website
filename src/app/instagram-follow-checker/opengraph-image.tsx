import { ImageResponse } from "next/og";

export const alt = "Instagram Follow Checker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function InstagramFollowCheckerImage() {
  return new ImageResponse(
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      padding: 80,
      background: "#f3f2ef",
      color: "#333331",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: "#2458a6" }}>
        <span style={{ padding: "6px 12px", border: "1px solid #d6d4ce", borderRadius: 12, background: "#faf9f6", fontWeight: 700 }}>ba.</span>
        aydemir.website
      </div>
      <div style={{ display: "flex", marginTop: 38, fontSize: 70, letterSpacing: "-0.04em", fontWeight: 700 }}>{alt}</div>
      <div style={{ display: "flex", marginTop: 10, fontSize: 32, color: "#66645f" }}>Compare your Instagram exports privately in your browser.</div>
    </div>,
    size,
  );
}
