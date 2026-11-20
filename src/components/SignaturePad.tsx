"use client";
import { useEffect, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Le libellé et le bouton d'effacement sont paramétrables : ce composant est aussi utilisé sur
 * les pages publiques, qui peuvent s'afficher en italien. Une invite en français au milieu d'un
 * devis traduit est exactement ce qui fait douter un client au moment de signer.
 */
export default function SignaturePad({
  onChange,
  invite = "Signez ici, au doigt ou à la souris",
  effacer = "Effacer",
}: {
  onChange: (dataUrl: string | null) => void;
  invite?: string;
  effacer?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const c = canvasRef.current!;
    c.width = c.offsetWidth * 2;
    c.height = 160 * 2;
    const ctx = c.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  return (
    <div className="relative">
      {!hasDrawn && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-500">
          <PenLine size={16} aria-hidden />
          {invite}
        </span>
      )}
      <canvas
        ref={canvasRef}
        className="h-[160px] w-full touch-none rounded-lg border border-gray-300 bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = canvasRef.current!.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          setHasDrawn(true);
          onChange(canvasRef.current!.toDataURL("image/png"));
        }}
      />
      {hasDrawn && (
        <Button
          type="button"
          variant="ghost"
          className="mt-1 !px-2 !py-1 text-xs"
          onClick={() => {
            const c = canvasRef.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setHasDrawn(false);
            onChange(null);
          }}
        >
          {effacer}
        </Button>
      )}
    </div>
  );
}
