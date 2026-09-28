import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { Modal } from "./ui";

/**
 * html5-qrcode's stop() throws a plain string synchronously when the scanner
 * is not running (e.g. it already stopped after a successful scan), so a
 * .catch() on its promise is not enough — an uncaught throw here escapes the
 * React effect cleanup and unmounts the whole app (white screen).
 */
const stopSafely = (scanner: Html5Qrcode | null) => {
  if (!scanner) return;
  try {
    scanner.stop().catch(() => undefined);
  } catch {
    // Scanner was not running — nothing to stop.
  }
};

/**
 * Camera barcode scanner (html5-qrcode, same engine as the original app).
 * Calls onScan with the decoded GTIN and closes.
 */
const BarcodeScanner = ({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest onScan without restarting the camera when the parent
  // re-renders and passes a new function identity.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) return;
    setError(null);
    let stopped = false;

    // html5-qrcode is heavy, so it's loaded on demand the first time the
    // scanner opens instead of shipping in the main bundle.
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (stopped) return;
      const scanner = new Html5Qrcode("ggg-scanner");
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decoded) => {
            if (stopped) return;
            stopped = true;
            stopSafely(scanner);
            onScanRef.current(decoded);
          },
          () => undefined
        )
        .catch((err) => {
          if (!stopped) {
            setError(
              typeof err === "string"
                ? err
                : err?.message || "Could not start the camera."
            );
          }
        });
    });

    return () => {
      stopped = true;
      stopSafely(scannerRef.current);
      scannerRef.current = null;
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Scan barcode">
      <div id="ggg-scanner" className="overflow-hidden rounded-lg" />
      {error ? (
        <p className="mt-3 text-center text-sm text-red-600">{error}</p>
      ) : (
        <p className="mt-3 text-center text-sm text-ink-muted">
          Point your camera at the product barcode.
        </p>
      )}
    </Modal>
  );
};

export default BarcodeScanner;
